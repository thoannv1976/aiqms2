"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { Modal } from "@/components/Modal";
import { ErrorBox } from "@/components/ui";

/** AI đánh giá hệ ma trận PLO theo AUN-QA (constructive alignment, độ phủ, I→R→M…). */
export function EvaluateMatrixButton({ versionId }: { versionId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setOpen(true); setBusy(true); setErr(null); setReview(null);
    try {
      const r = await api.post<{ review: string }>(`/api/ai/evaluate-matrix?versionId=${versionId}`, {});
      setReview(r?.review ?? "");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi gọi AI (cần bật AI + có quyền)");
    } finally { setBusy(false); }
  }

  return (
    <>
      <button className="btn-outline disabled:opacity-50" disabled={!versionId} onClick={run}>✨ AI đánh giá ma trận</button>
      <Modal open={open} title="AI đánh giá hệ ma trận PLO (AUN-QA)" onClose={() => setOpen(false)}>
        {busy && <p className="text-sm text-slate-500">Đang đánh giá…</p>}
        {err && <ErrorBox message={err} />}
        {review && <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-100 p-3 text-sm text-slate-700">{review}</pre>}
        <div className="mt-3 flex justify-end"><button className="btn-primary" onClick={() => setOpen(false)}>Đóng</button></div>
      </Modal>
    </>
  );
}
