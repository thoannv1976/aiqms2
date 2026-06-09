"use client";

import { useState } from "react";
import { api, authedUrl, ApiClientError } from "@/lib/api/client";

type ExportType = "sar_docx" | "sar_pdf" | "evidence_xlsx" | "evidence_zip";

interface Job { id: string; status: string }

/** Nút xuất báo cáo: tạo job -> poll -> tải file khi xong. */
export function ExportButton({
  type,
  sarId,
  criterionId,
  label,
}: {
  type: ExportType;
  sarId?: string;
  criterionId?: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setNote("Đang tạo báo cáo…");
    try {
      const job = await api.post<Job>("/api/exports", { type, sarId, criterionId });
      if (!job) throw new Error("Không tạo được job");
      // Poll tới khi done/failed (job chạy inline nên thường done ngay).
      let status = job.status;
      for (let i = 0; i < 30 && status !== "done" && status !== "failed"; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const polled = await api.get<Job>(`/api/exports/${job.id}`);
        status = polled?.status ?? "failed";
      }
      if (status !== "done") throw new Error("Xuất báo cáo thất bại");
      // Tải file (navigation kèm ?tenant + cookie auth).
      const a = document.createElement("a");
      a.href = authedUrl(`/api/exports/${job.id}/download`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setNote("Đã tải xuống.");
    } catch (e) {
      setNote(e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Lỗi xuất báo cáo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button className="btn-outline" onClick={run} disabled={busy}>
        {busy ? "Đang xuất…" : label}
      </button>
      {note && <span className="mt-1 text-xs text-slate-400">{note}</span>}
    </div>
  );
}
