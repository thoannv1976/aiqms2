"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiUpload, authedUrl, ApiClientError } from "@/lib/api/client";
import { Modal } from "@/components/Modal";
import { ErrorBox } from "@/components/ui";

interface Programme { id: string; code: string; name: string }
interface Doc {
  id: string; title: string; fileName: string; createdAt: string;
  size: number; version: number; extracted: boolean; courseCode: string | null; courseName: string | null;
}
interface RepoData { items: Doc[]; total: number; extractedCount: number; storage: { driver: string; durable: boolean } }
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
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
  // Chọn nhiều để trích xuất & ghi hàng loạt.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const [durable, setDurable] = useState<boolean | null>(null);
  const [extractedCount, setExtractedCount] = useState(0);

  const loadDocs = useCallback(async () => {
    try {
      const q = programmeId ? `?programmeId=${programmeId}` : "";
      const r = await api.get<RepoData>(`/api/documents/syllabus${q}`);
      setDocs(r?.items ?? []);
      setExtractedCount(r?.extractedCount ?? 0);
      if (r?.storage) setDurable(r.storage.durable);
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
    setErr(null);
    try { await api.delete(`/api/documents/${docId}`); setNote("Đã xóa đề cương."); await loadDocs(); }
    catch (e) { setErr(e instanceof ApiClientError ? `Không xóa được: ${e.message}` : "Lỗi xóa đề cương"); }
  }

  async function cleanupMissing() {
    if (!confirm("Quét và dọn các đề cương đã MẤT FILE (bản ghi mồ côi) khỏi danh sách?")) return;
    setBusy(true); setErr(null); setNote("Đang kiểm tra file trong kho…");
    try {
      const r = await api.post<{ checked: number; removed: number }>(`/api/documents/syllabus/cleanup${programmeId ? `?programmeId=${programmeId}` : ""}`, {});
      setNote(`Đã kiểm tra ${r?.checked ?? 0} đề cương · dọn ${r?.removed ?? 0} bản đã mất file.`);
      await loadDocs();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi dọn kho");
    } finally { setBusy(false); }
  }

  function toggleSel(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((s) => (s.size === docs.length ? new Set() : new Set(docs.map((d) => d.id))));
  }

  /** Trích xuất + ghi học phần cho tất cả đề cương đã chọn (tuần tự, có tiến độ). */
  async function bulkExtract() {
    const ids = docs.filter((d) => selected.has(d.id)).map((d) => d.id);
    if (ids.length === 0) return;
    setBusy(true); setErr(null); setNote(null); setProgress(null);
    let okN = 0; const errs: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      setProgress(`Đang xử lý ${i + 1}/${ids.length}…`);
      try {
        await api.post("/api/import/courses/doc/extract-apply", { documentId: ids[i], programmeId: programmeId || undefined });
        okN++;
      } catch (e) {
        errs.push(e instanceof ApiClientError ? e.message : "lỗi");
      }
    }
    setProgress(null);
    setNote(`Đã trích xuất & ghi ${okN}/${ids.length} đề cương${errs.length ? ` · ${errs.length} lỗi` : ""}.`);
    setSelected(new Set()); await loadDocs(); onChanged?.();
    setBusy(false);
  }

  return (
    <>
      <button className="btn-outline" onClick={() => { setOpen(true); setNote(null); setErr(null); }}>Kho đề cương</button>
      <Modal open={open} title="Kho đề cương học phần (upload nhiều · trích xuất sau)" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {durable === false && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              ⚠ <b>Kho lưu trữ đang ở chế độ TẠM (local /tmp)</b> — trên Cloud Run, file sẽ bị mất khi máy chủ
              khởi động lại/mở rộng. Vì vậy file cũ có thể báo “không còn trong kho”. Hãy <b>bật lưu trữ bền vững GCS</b>
              (STORAGE_DRIVER=s3 + S3_*; xem scripts/setup-gcs.sh / DEPLOY.md mục 7b). Trong lúc chờ: nên
              <b> upload và Trích xuất ngay</b>, hoặc dùng “Tải lên phiên bản mới” để thay file đã mất.
            </div>
          )}
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
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">
                  Đề cương đã upload ({docs.length}) · <span className="text-emerald-600">{extractedCount} đã trích xuất</span> ·
                  <span className={durable ? "text-emerald-600" : "text-amber-600"}> lưu trữ: {durable ? "GCS (bền vững)" : "tạm (local)"}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-outline h-8 py-0 text-xs" disabled={busy} onClick={loadDocs} title="Tải lại danh sách mới nhất">🔄 Làm mới</button>
                  <button className="btn-outline h-8 py-0 text-xs" disabled={busy} onClick={cleanupMissing} title="Xóa khỏi danh sách những đề cương đã mất file">🧹 Dọn file đã mất</button>
                  {docs.length > 0 && (
                    <>
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input type="checkbox" checked={selected.size === docs.length && docs.length > 0} onChange={toggleAll} /> Chọn tất cả
                      </label>
                      <button className="btn-primary h-8 py-0 text-xs disabled:opacity-50" disabled={busy || selected.size === 0} onClick={bulkExtract}>
                        Trích xuất & ghi đã chọn ({selected.size})
                      </button>
                    </>
                  )}
                </div>
              </div>
              {progress && <p className="mb-1 text-xs text-indigo-600">{progress}</p>}
              {docs.length === 0 ? (
                <p className="text-sm text-slate-400">Chưa có đề cương trong kho cho chương trình này.</p>
              ) : (
                <div className="max-h-72 overflow-auto rounded border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="th w-6"></th>
                        <th className="th">Đề cương / Tệp</th>
                        <th className="th">Dung lượng</th>
                        <th className="th">Ngày upload</th>
                        <th className="th">Trích xuất</th>
                        <th className="th">PB</th>
                        <th className="th"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((d) => (
                        <tr key={d.id} className="border-t border-slate-50 align-top hover:bg-slate-50/50">
                          <td className="td"><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSel(d.id)} /></td>
                          <td className="td">
                            <p className="line-clamp-1 font-medium text-slate-700" title={d.title}>{d.title}</p>
                            <p className="line-clamp-1 text-xs text-slate-400" title={d.fileName}>{d.fileName}</p>
                          </td>
                          <td className="td whitespace-nowrap text-slate-500">{fmtSize(d.size)}</td>
                          <td className="td whitespace-nowrap text-slate-500">{new Date(d.createdAt).toLocaleDateString("vi-VN")}</td>
                          <td className="td">
                            {d.extracted
                              ? <span className="badge bg-emerald-100 text-emerald-700" title={d.courseName ?? ""}>✓ {d.courseCode}</span>
                              : <span className="badge bg-slate-100 text-slate-400">Chưa</span>}
                          </td>
                          <td className="td text-center text-slate-400">v{d.version}</td>
                          <td className="td">
                            <span className="flex gap-2 text-xs">
                              <button className="text-indigo-600 hover:underline disabled:text-slate-300" disabled={busy} onClick={() => extract(d.id)}>Trích xuất</button>
                              <a className="text-slate-500 hover:underline" href={authedUrl(`/api/documents/${d.id}/download`)}>Tải</a>
                              <button className="text-rose-500 hover:underline" onClick={() => remove(d.id)}>Xóa</button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
