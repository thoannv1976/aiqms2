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
  const [draftId, setDraftId] = useState<string | null>(null);
  const [sars, setSars] = useState<{ id: string; title: string }[]>([]);
  const [sarId, setSarId] = useState("");
  const [critCode, setCritCode] = useState("C1");
  const [field, setField] = useState("analysis");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSum(await api.get<Summary>(`/api/programme-versions/${versionId}/summary`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải tổng quan"); }
  }, [versionId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<{ items: { id: string; title: string }[] }>("/api/sars?pageSize=100").then((d) => setSars(d?.items ?? [])).catch(() => {}); }, []);

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
    setBusy(true); setErr(null); setReview(null); setDraftId(null); setNote("🤖 AI đang đánh giá CTĐT… (có thể mất 30–60s)");
    try {
      const r = await api.post<{ review: string; draftId: string }>(`/api/ai/evaluate-programme?versionId=${versionId}`, {});
      setReview(r?.review ?? null); setDraftId(r?.draftId ?? null);
      setNote("Đây là BẢN NHÁP — xem lại rồi “Duyệt & ghi vào SAR” để đưa vào tiêu chí C1/C2.");
    } catch (e) { setNote(null); setErr(e instanceof ApiClientError ? `Lỗi AI: ${e.message}` : "Lỗi AI đánh giá"); }
    finally { setBusy(false); }
  }

  async function applyToSar() {
    if (!draftId) return;
    if (!sarId) { setErr("Hãy chọn một SAR để ghi nhận xét vào."); return; }
    setBusy(true); setErr(null);
    try {
      await api.post("/api/ai/evaluate-programme/to-sar", { draftId, sarId, criterionCode: critCode, field });
      setNote(`✅ Đã duyệt & ghi nhận xét vào ${critCode} (${field === "analysis" ? "Phân tích" : field === "strengths" ? "Điểm mạnh" : "Điểm tồn tại"}) của SAR.`);
      setReview(null); setDraftId(null);
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Lỗi ghi vào SAR"); }
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
        <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
          <p className="mb-1 text-xs font-semibold text-indigo-700">Bản nháp AI đánh giá CTĐT</p>
          <div className="mb-3 whitespace-pre-wrap text-sm text-slate-700">{review}</div>
          <div className="flex flex-wrap items-end gap-2 border-t border-indigo-100 pt-2">
            <div>
              <label className="label text-xs">Ghi vào SAR</label>
              <select className="input h-9 py-0 text-sm" value={sarId} onChange={(e) => setSarId(e.target.value)}>
                <option value="">— chọn SAR —</option>
                {sars.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Tiêu chí</label>
              <select className="input h-9 py-0 text-sm" value={critCode} onChange={(e) => setCritCode(e.target.value)}>
                <option value="C1">C1 — Chuẩn đầu ra</option>
                <option value="C2">C2 — Cấu trúc & nội dung</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Mục</label>
              <select className="input h-9 py-0 text-sm" value={field} onChange={(e) => setField(e.target.value)}>
                <option value="analysis">Phân tích</option>
                <option value="strengths">Điểm mạnh</option>
                <option value="weaknesses">Điểm tồn tại</option>
              </select>
            </div>
            <button className="btn-primary h-9 py-0" disabled={busy} onClick={applyToSar}>Duyệt & ghi vào SAR</button>
            <button className="btn-outline h-9 py-0" disabled={busy} onClick={() => { setReview(null); setDraftId(null); }}>Bỏ nháp</button>
          </div>
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
