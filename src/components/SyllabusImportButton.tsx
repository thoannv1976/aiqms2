"use client";

import { useEffect, useRef, useState } from "react";
import { api, apiUpload, ApiClientError } from "@/lib/api/client";
import { Modal } from "@/components/Modal";
import { ErrorBox } from "@/components/ui";

interface Clo { code: string; description: string }
interface Extracted {
  code: string; name: string; nameEn?: string; credits?: number;
  prerequisites?: string; description?: string; content?: string;
  teachingMethods?: string; assessmentMethods?: string; materials?: string;
  clos: Clo[];
  cloPlo: { cloCode: string; ploCode: string; level?: string }[];
}
interface ExtractResp { source: "ai" | "rule"; extracted: Extracted; documentId: string }
interface ApplyResult { created: number; updated: number; errors: string[]; details: Record<string, number>; courseId: string }
interface Programme { id: string; code: string; name: string }

/** Import đề cương học phần từ file Word/PDF: trích xuất -> xem trước -> ghi + gắn file. */
export function SyllabusImportButton({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Extracted | null>(null);
  const [source, setSource] = useState<"ai" | "rule" | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [programmeId, setProgrammeId] = useState("");
  const [result, setResult] = useState<ApplyResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    api.get<{ items: Programme[] }>("/api/programmes?pageSize=100").then((d) => setProgrammes(d?.items ?? [])).catch(() => {});
  }, [open]);

  function reset() { setData(null); setSource(null); setDocumentId(null); setResult(null); setErr(null); }

  async function extract() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Hãy chọn file đề cương (.docx hoặc .pdf)"); return; }
    setBusy(true); setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await apiUpload<ExtractResp>("/api/import/courses/doc", form);
      setData(r?.extracted ?? null);
      setSource(r?.source ?? null);
      setDocumentId(r?.documentId ?? null);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi trích xuất file");
    } finally { setBusy(false); }
  }

  async function apply() {
    if (!data) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.post<ApplyResult>("/api/import/courses/doc/apply", {
        ...data,
        documentId: documentId ?? undefined,
        programmeId: programmeId || undefined,
      });
      setResult(r);
      onDone?.();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi ghi đề cương");
    } finally { setBusy(false); }
  }

  const set = (k: keyof Extracted, v: string) => setData((d) => (d ? { ...d, [k]: v } : d));

  return (
    <>
      <button className="btn-outline" onClick={() => { setOpen(true); reset(); }}>Import Word/PDF (đề cương)</button>
      <Modal open={open} title="Import đề cương học phần từ Word/PDF" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {!data && !result && (
            <>
              <p className="text-sm text-slate-600">
                Chọn file đề cương (.docx/.pdf). Hệ thống <b>trích xuất</b> mã, tên, tín chỉ, tiên quyết, mô tả,
                CLO, ma trận CLO–PLO, học liệu, phương pháp giảng dạy & đánh giá (ưu tiên AI; AI tắt dùng bộ luật).
                File gốc được lưu vào kho <b>Tài liệu</b> và gắn với học phần.
              </p>
              <div><label className="label">File đề cương (.docx / .pdf)</label><input ref={fileRef} type="file" accept=".docx,.pdf" className="input" /></div>
              {err && <ErrorBox message={err} />}
              <div className="flex justify-end gap-2">
                <button className="btn-outline" onClick={() => setOpen(false)}>Đóng</button>
                <button className="btn-primary" onClick={extract} disabled={busy}>{busy ? "Đang trích xuất…" : "Trích xuất"}</button>
              </div>
            </>
          )}

          {data && !result && (
            <>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Nguồn trích xuất: <b>{source === "ai" ? "AI" : "Bộ luật (AI tắt)"}</b>. Kiểm tra/sửa trước khi ghi.
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Mã học phần *</label><input className="input" value={data.code} onChange={(e) => set("code", e.target.value)} /></div>
                <div className="col-span-2"><label className="label">Tên học phần *</label><input className="input" value={data.name} onChange={(e) => set("name", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Số tín chỉ</label><input className="input" type="number" value={data.credits ?? ""} onChange={(e) => setData((d) => d ? { ...d, credits: e.target.value ? Number(e.target.value) : undefined } : d)} /></div>
                <div className="col-span-2"><label className="label">Tiên quyết</label><input className="input" value={data.prerequisites ?? ""} onChange={(e) => set("prerequisites", e.target.value)} /></div>
              </div>
              <div>
                <label className="label">Gắn với CTĐT đang kiểm định (tùy chọn)</label>
                <select className="input" value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
                  <option value="">— Không gắn —</option>
                  {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <Stat n={data.clos.length} label="CLO" />
                <Stat n={data.cloPlo.length} label="Liên kết CLO–PLO" />
                <Stat n={(data.materials ?? "").split("\n").filter(Boolean).length} label="Học liệu" />
                <Stat n={(data.content ?? "").split("\n").filter(Boolean).length} label="Chương/buổi" />
              </div>
              <PreviewList title="Chuẩn đầu ra học phần (CLO)" items={data.clos.map((c) => `${c.code}: ${c.description}`)} />
              {data.assessmentMethods && (
                <div>
                  <p className="label">Đánh giá</p>
                  <p className="line-clamp-3 rounded-lg border border-slate-100 p-2 text-xs text-slate-600">{data.assessmentMethods}</p>
                </div>
              )}

              {err && <ErrorBox message={err} />}
              <div className="flex justify-end gap-2">
                <button className="btn-outline" onClick={reset}>Chọn file khác</button>
                <button className="btn-primary" onClick={apply} disabled={busy || !data.code}>{busy ? "Đang ghi…" : "Ghi vào hệ thống"}</button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="font-medium text-emerald-700">Đã ghi đề cương vào hệ thống.</p>
                <p>Tạo mới: <b>{result.created}</b> · Cập nhật: <b>{result.updated}</b></p>
                <p className="text-slate-600">{Object.entries(result.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                {result.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-600">{result.errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}</ul>}
              </div>
              <div className="flex justify-end"><button className="btn-primary" onClick={() => setOpen(false)}>Xong</button></div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return <div className="rounded-lg bg-indigo-50 py-2"><div className="text-lg font-semibold text-indigo-700">{n}</div><div className="text-xs text-slate-500">{label}</div></div>;
}
function PreviewList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="label">{title} ({items.length})</p>
      <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2 text-xs text-slate-600">
        {items.slice(0, 20).map((t, i) => <li key={i} className="line-clamp-2">• {t}</li>)}
      </ul>
    </div>
  );
}
