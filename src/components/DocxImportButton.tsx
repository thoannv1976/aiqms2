"use client";

import { useRef, useState } from "react";
import { api, apiUpload, ApiClientError } from "@/lib/api/client";
import { Modal } from "@/components/Modal";
import { ErrorBox } from "@/components/ui";

interface Extracted {
  code: string; name: string; nameEn?: string; level?: string; totalCredits?: number; version?: string;
  peos: { code: string; description: string }[];
  plos: { code: string; description: string }[];
  courses: { code: string; name: string; credits?: number }[];
}
interface ExtractResp { source: "ai" | "rule"; extracted: Extracted; documentId: string }
interface ApplyResult { created: number; updated: number; errors: string[]; details: Record<string, number> }

/** Import CTĐT từ file Word (.docx): trích xuất (AI/luật) -> xem trước & sửa -> tạo/cập nhật. */
export function DocxImportButton({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Extracted | null>(null);
  const [source, setSource] = useState<"ai" | "rule" | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() { setData(null); setSource(null); setResult(null); setErr(null); }

  async function extract() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Hãy chọn file Word (.docx)"); return; }
    setBusy(true); setErr(null); setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await apiUpload<ExtractResp>("/api/import/programmes/docx", form);
      setData(r?.extracted ?? null);
      setSource(r?.source ?? null);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi trích xuất file");
    } finally { setBusy(false); }
  }

  async function apply() {
    if (!data) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.post<ApplyResult>("/api/import/programmes/docx/apply", data);
      setResult(r);
      onDone?.();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi tạo CTĐT");
    } finally { setBusy(false); }
  }

  const set = (k: keyof Extracted, v: string) => setData((d) => (d ? { ...d, [k]: v } : d));

  return (
    <>
      <button className="btn-outline" onClick={() => { setOpen(true); reset(); }}>Import Word (CTĐT)</button>
      <Modal open={open} title="Import CTĐT từ Word" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {!data && !result && (
            <>
              <p className="text-sm text-slate-600">
                Chọn file CTĐT (.docx). Hệ thống sẽ <b>trích xuất</b> mã ngành, tên, PEO/PLO và danh mục học phần
                (ưu tiên AI nếu đã bật; nếu tắt thì dùng bộ luật). File gốc được lưu vào kho <b>Tài liệu</b>.
              </p>
              <div><label className="label">File Word (.docx)</label><input ref={fileRef} type="file" accept=".docx" className="input" /></div>
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
                Nguồn trích xuất: <b>{source === "ai" ? "AI" : "Bộ luật (AI tắt)"}</b>. Hãy kiểm tra/sửa trước khi tạo.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Mã ngành *</label><input className="input" value={data.code} onChange={(e) => set("code", e.target.value)} /></div>
                <div><label className="label">Phiên bản</label><input className="input" value={data.version ?? ""} onChange={(e) => set("version", e.target.value)} placeholder="(năm hiện tại)" /></div>
              </div>
              <div><label className="label">Tên chương trình *</label><input className="input" value={data.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Trình độ</label>
                  <select className="input" value={data.level ?? "bachelor"} onChange={(e) => set("level", e.target.value)}>
                    <option value="bachelor">Đại học</option><option value="master">Thạc sĩ</option><option value="doctor">Tiến sĩ</option>
                  </select>
                </div>
                <div><label className="label">Tổng tín chỉ</label><input className="input" type="number" value={data.totalCredits ?? ""} onChange={(e) => setData((d) => d ? { ...d, totalCredits: e.target.value ? Number(e.target.value) : undefined } : d)} /></div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <Stat n={data.peos.length} label="PEO" />
                <Stat n={data.plos.length} label="PLO" />
                <Stat n={data.courses.length} label="Học phần" />
              </div>
              <PreviewList title="Chuẩn đầu ra (PLO)" items={data.plos.map((p) => `${p.code}: ${p.description}`)} />
              <PreviewList title="Học phần" items={data.courses.map((c) => `${c.code}${c.credits ? ` (${c.credits} TC)` : ""} — ${c.name}`)} />

              {err && <ErrorBox message={err} />}
              <div className="flex justify-end gap-2">
                <button className="btn-outline" onClick={reset}>Chọn file khác</button>
                <button className="btn-primary" onClick={apply} disabled={busy || !data.code}>{busy ? "Đang tạo…" : "Tạo / Cập nhật CTĐT"}</button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="font-medium text-emerald-700">Đã ghi vào hệ thống.</p>
                <p>Tạo mới CTĐT: <b>{result.created}</b> · Cập nhật: <b>{result.updated}</b></p>
                <p className="text-slate-600">{Object.entries(result.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                {result.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-rose-600">{result.errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}</ul>}
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
        {items.slice(0, 60).map((t, i) => <li key={i} className="line-clamp-2">• {t}</li>)}
        {items.length > 60 && <li className="text-slate-400">… và {items.length - 60} mục khác</li>}
      </ul>
    </div>
  );
}
