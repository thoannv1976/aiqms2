"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiUpload, authedUrl, ApiClientError } from "@/lib/api/client";
import { Modal } from "@/components/Modal";
import { ErrorBox } from "@/components/ui";

interface Programme { id: string; code: string; name: string }
interface Doc { id: string; title: string; fileName: string; createdAt: string }
interface Extracted {
  code: string; name: string; credits?: number; prerequisites?: string;
  clos: { code: string; description: string }[];
  cloPlo: { cloCode: string; ploCode: string }[];
}

/** Kho đề cương: tải lên NHIỀU đề cương (gắn CTĐT) -> mở từng cái để TRÍCH XUẤT sau. */
export function SyllabusManager({ onChanged }: { onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [programmeId, setProgrammeId] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Trích xuất / xem trước theo từng tài liệu.
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    try {
      const q = `category=syllabus&pageSize=100${programmeId ? `&programmeId=${programmeId}` : ""}`;
      setDocs((await api.get<{ items: Doc[] }>(`/api/documents?${q}`))?.items ?? []);
    } catch { /* bỏ qua */ }
  }, [programmeId]);

  useEffect(() => { if (open) api.get<{ items: Programme[] }>("/api/programmes?pageSize=100").then((d) => setProgrammes(d?.items ?? [])).catch(() => {}); }, [open]);
  useEffect(() => { if (open) loadDocs(); }, [open, loadDocs]);

  async function upload() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) { setErr("Hãy chọn ít nhất 1 file"); return; }
    setBusy(true); setErr(null); setNote(null);
    let ok = 0;
    try {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        form.append("title", `Đề cương: ${f.name}`);
        form.append("category", "syllabus");
        if (programmeId) form.append("programmeId", programmeId);
        await apiUpload("/api/documents", form);
        ok++;
      }
      setNote(`Đã tải lên ${ok} đề cương vào kho.`);
      if (fileRef.current) fileRef.current.value = "";
      await loadDocs();
    } catch (e) {
      setErr(e instanceof ApiClientError ? `Lỗi sau khi tải ${ok} file: ${e.message}` : "Lỗi tải lên");
    } finally { setBusy(false); }
  }

  async function extract(docId: string) {
    setBusy(true); setErr(null); setNote(null); setPreviewDoc(docId); setExtracted(null);
    try {
      const r = await api.post<{ source: string; extracted: Extracted }>("/api/import/courses/doc/extract", { documentId: docId });
      setExtracted(r?.extracted ?? null); setSource(r?.source ?? null);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi trích xuất"); setPreviewDoc(null);
    } finally { setBusy(false); }
  }

  async function apply() {
    if (!extracted || !previewDoc) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ created: number; updated: number }>("/api/import/courses/doc/apply", {
        ...extracted, documentId: previewDoc, programmeId: programmeId || undefined,
      });
      setNote(`Đã ghi học phần ${extracted.code} (tạo ${r?.created ?? 0}, cập nhật ${r?.updated ?? 0}).`);
      setPreviewDoc(null); setExtracted(null); onChanged?.();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi ghi học phần");
    } finally { setBusy(false); }
  }

  async function remove(docId: string) {
    if (!confirm("Xóa đề cương này khỏi kho?")) return;
    try { await api.delete(`/api/documents/${docId}`); await loadDocs(); } catch { /* bỏ qua */ }
  }

  return (
    <>
      <button className="btn-outline" onClick={() => { setOpen(true); setNote(null); setErr(null); }}>Kho đề cương</button>
      <Modal open={open} title="Kho đề cương học phần (upload nhiều · trích xuất sau)" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="label">Chương trình đào tạo</label>
            <select className="input" value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
              <option value="">— Tất cả / chưa gán —</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">Tải lên nhiều đề cương (.docx/.pdf)</p>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".docx,.pdf" multiple className="input flex-1" />
              <button className="btn-primary" onClick={upload} disabled={busy}>{busy ? "Đang tải…" : "Tải lên kho"}</button>
            </div>
            <p className="mt-1 text-xs text-slate-400">File lưu vào kho Tài liệu (gắn CTĐT đã chọn). Trích xuất nội dung thực hiện sau khi mở từng đề cương.</p>
          </div>

          {note && <p className="text-sm text-emerald-600">{note}</p>}
          {err && <ErrorBox message={err} />}

          {previewDoc && extracted ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
              <p className="mb-1 text-xs text-slate-500">Nguồn trích xuất: <b>{source === "ai" ? "AI" : "Bộ luật"}</b></p>
              <p className="text-sm"><b>{extracted.code}</b> — {extracted.name} · {extracted.credits ?? "?"} TC · {extracted.clos.length} CLO · {extracted.cloPlo.length} liên kết CLO–PLO</p>
              {extracted.clos.length > 0 && (
                <ul className="my-2 max-h-28 overflow-y-auto text-xs text-slate-600">
                  {extracted.clos.slice(0, 12).map((c, i) => <li key={i}>• {c.code}: {c.description}</li>)}
                </ul>
              )}
              <div className="flex gap-2">
                <button className="btn-primary" onClick={apply} disabled={busy || !extracted.code}>Ghi vào hệ thống</button>
                <button className="btn-outline" onClick={() => { setPreviewDoc(null); setExtracted(null); }}>Bỏ</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Đề cương đã upload ({docs.length})</p>
              {docs.length === 0 ? (
                <p className="text-sm text-slate-400">Chưa có đề cương trong kho.</p>
              ) : (
                <ul className="max-h-60 space-y-1 overflow-y-auto">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1.5 text-sm">
                      <span className="line-clamp-1 text-slate-700" title={d.fileName}>{d.title}</span>
                      <span className="flex shrink-0 gap-3 text-xs">
                        <button className="text-indigo-600 hover:underline disabled:text-slate-300" disabled={busy} onClick={() => extract(d.id)}>Trích xuất</button>
                        <a className="text-slate-500 hover:underline" href={authedUrl(`/api/documents/${d.id}/download`)}>Tải</a>
                        <button className="text-rose-500 hover:underline" onClick={() => remove(d.id)}>Xóa</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
