"use client";

import { useRef, useState } from "react";
import { apiUpload, authedUrl, ApiClientError } from "@/lib/api/client";
import { Modal } from "@/components/Modal";
import { ErrorBox } from "@/components/ui";

interface Result { created: number; updated: number; errors: string[]; details: Record<string, number> }

/** Nút import Excel: tải file mẫu + upload file + hiển thị kết quả nạp. */
export function ImportButton({
  label = "Import Excel",
  endpoint,
  onDone,
}: {
  label?: string;
  endpoint: string; // ví dụ /api/import/programmes
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Hãy chọn file Excel (.xlsx)"); return; }
    setBusy(true); setErr(null); setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await apiUpload<Result>(endpoint, form);
      setResult(r);
      onDone?.();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi nạp dữ liệu");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn-outline" onClick={() => { setOpen(true); setResult(null); setErr(null); }}>{label}</button>
      <Modal open={open} title="Nạp dữ liệu từ Excel" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Bước 1: <a className="text-indigo-600 hover:underline" href={authedUrl(endpoint)}>Tải file Excel mẫu</a> và điền theo các cột/sheet có sẵn.
          </p>
          <div>
            <label className="label">Bước 2: chọn file .xlsx đã điền</label>
            <input ref={fileRef} type="file" accept=".xlsx" className="input" />
          </div>
          {err && <ErrorBox message={err} />}
          {result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="font-medium text-emerald-700">Đã nạp xong.</p>
              <p>Tạo mới: <b>{result.created}</b> · Cập nhật: <b>{result.updated}</b></p>
              <p className="text-slate-600">{Object.entries(result.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
              {result.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-rose-600">
                  {result.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 8 && <li>… và {result.errors.length - 8} lỗi khác</li>}
                </ul>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setOpen(false)}>Đóng</button>
            <button className="btn-primary" onClick={upload} disabled={busy}>{busy ? "Đang nạp…" : "Nạp dữ liệu"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
