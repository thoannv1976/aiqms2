"use client";

import { useCallback, useEffect, useState } from "react";
import { api, apiUpload, authedUrl, ApiClientError } from "@/lib/api/client";

interface DocItem { id: string; title: string; fileName: string; category: string; size: number; createdAt: string }
interface Summary {
  counts: { peo: number; plo: number; pi: number; courses: number; ploCourseCells: number };
  documents: DocItem[];
}

const CAT_VI: Record<string, string> = { ctdt_source: "CTĐT gốc", syllabus: "Đề cương", regulation: "Quy chế", report: "Báo cáo", other: "Khác" };
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Tổng quan trích xuất CTĐT + tài liệu gốc + AI đánh giá (trên trang chi tiết CTĐT). */
export function ProgrammeOverviewPanel({ programmeId, versionId }: { programmeId: string; versionId: string }) {
  const [sum, setSum] = useState<Summary | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSum(await api.get<Summary>(`/api/programme-versions/${versionId}/summary`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải tổng quan"); }
  }, [versionId]);
  useEffect(() => { load(); }, [load]);

  async function uploadSource(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null); setNote(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      form.append("category", "ctdt_source");
      form.append("programmeId", programmeId);
      await apiUpload("/api/documents", form);
      e.target.value = "";
      setNote("Đã tải lên tài liệu CTĐT.");
      await load();
    } catch (e2) { setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tải lên"); }
    finally { setBusy(false); }
  }

  async function removeDoc(id: string) {
    if (!confirm("Xóa tài liệu này?")) return;
    try { await api.delete(`/api/documents/${id}`); await load(); }
    catch (e) { setErr(e instanceof ApiClientError ? e.message : "Lỗi xóa"); }
  }

  async function evaluate() {
    setBusy(true); setErr(null); setReview(null); setNote("🤖 AI đang đánh giá CTĐT… (có thể mất 30–60s)");
    try {
      const r = await api.post<{ review: string }>(`/api/ai/evaluate-programme?versionId=${versionId}`, {});
      setReview(r?.review ?? null); setNote(null);
    } catch (e) { setNote(null); setErr(e instanceof ApiClientError ? `Lỗi AI: ${e.message}` : "Lỗi AI đánh giá"); }
    finally { setBusy(false); }
  }

  const c = sum?.counts;
  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Tổng quan trích xuất & tài liệu CTĐT</h3>
        <button className="btn-outline" disabled={busy} onClick={evaluate}>✨ AI đánh giá CTĐT</button>
      </div>
      {err && <p className="mb-2 text-sm text-rose-600">{err}</p>}
      {note && <p className="mb-2 text-sm text-amber-600">{note}</p>}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[["PEO", c?.peo], ["PLO", c?.plo], ["PI/KPI", c?.pi], ["Học phần", c?.courses], ["Ô PLO×HP", c?.ploCourseCells]].map(([label, n]) => (
          <div key={label as string} className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xl font-semibold text-slate-800">{n ?? 0}</p>
            <p className="text-xs text-slate-500">{label as string}</p>
          </div>
        ))}
      </div>

      {review && (
        <div className="mb-4 whitespace-pre-wrap rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-sm text-slate-700">
          {review}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <p className="text-sm font-medium text-slate-700">Tài liệu gốc CTĐT ({sum?.documents.length ?? 0})</p>
        <label className="btn-outline cursor-pointer text-xs">
          + Tải lên tài liệu CTĐT
          <input type="file" accept=".docx,.pdf" className="hidden" onChange={uploadSource} disabled={busy} />
        </label>
      </div>
      {sum && sum.documents.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">Chưa có file gốc. Tải lên Word/PDF của CTĐT để xem/đối chiếu khi kiểm định.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {sum?.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-slate-700" title={d.fileName}>{d.title}</span>
                <span className="text-xs text-slate-400">{CAT_VI[d.category] ?? d.category} · {fmtSize(d.size)} · {new Date(d.createdAt).toLocaleDateString("vi-VN")}</span>
              </span>
              <span className="flex shrink-0 gap-3 text-xs">
                <a className="text-indigo-600 hover:underline" href={authedUrl(`/api/documents/${d.id}/download`)}>Xem/Tải</a>
                <button className="text-rose-500 hover:underline" onClick={() => removeDoc(d.id)}>Xóa</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
