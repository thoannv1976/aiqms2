"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";

interface CritRow { criterionId: string; code: string; titleVi: string; score: number | null; strengths: string | null; areasForImprovement: string | null }
interface Assessment {
  id: string; title: string; assessorNames: string | null; status: string;
  overallScore: number | null; decision: string | null; note: string | null;
  siteVisitStart: string | null; siteVisitEnd: string | null; criteria: CritRow[];
}
interface ListItem { id: string; title: string; status: string; overallScore: number | null; _count: { scores: number } }

const STATUS_VI: Record<string, string> = { planned: "Lên kế hoạch", onsite: "Khảo sát tại chỗ", completed: "Hoàn thành" };

/** Module Đánh giá ngoài (đoàn ĐGN): tạo đợt + chấm điểm tiêu chí + kết luận — D8. */
export function ExternalAssessmentPanel({ sarId }: { sarId: string }) {
  const [list, setList] = useState<ListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const loadList = useCallback(async () => {
    try { setList((await api.get<ListItem[]>(`/api/sars/${sarId}/external-assessments`)) ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi tải"); }
  }, [sarId]);
  useEffect(() => { loadList(); }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    try { setDetail(await api.get<Assessment>(`/api/external-assessments/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi tải chi tiết"); }
  }, []);
  useEffect(() => { if (selectedId) loadDetail(selectedId); else setDetail(null); }, [selectedId, loadDetail]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const a = await api.post<{ id: string }>(`/api/sars/${sarId}/external-assessments`, { title: newTitle });
      setNewTitle("");
      await loadList();
      if (a?.id) setSelectedId(a.id);
    } catch (e2) { setError(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo đợt"); }
  }

  async function saveScore(c: CritRow, patch: Partial<CritRow>) {
    if (!detail) return;
    try {
      await api.post(`/api/external-assessments/${detail.id}/scores`, {
        criterionId: c.criterionId,
        score: patch.score ?? c.score,
        strengths: patch.strengths ?? c.strengths,
        areasForImprovement: patch.areasForImprovement ?? c.areasForImprovement,
      });
      await loadDetail(detail.id);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Lỗi lưu điểm"); }
  }

  async function patchAssessment(patch: Record<string, unknown>) {
    if (!detail) return;
    try { await api.patch(`/api/external-assessments/${detail.id}`, patch); await loadDetail(detail.id); await loadList(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Lỗi cập nhật"); }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Đợt đánh giá ngoài</h3>
          {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
          <ul className="mb-3 space-y-1">
            {list.length === 0 && <li className="text-sm text-slate-400">Chưa có đợt nào</li>}
            {list.map((a) => (
              <li key={a.id}>
                <button onClick={() => setSelectedId(a.id)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selectedId === a.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <span className="font-medium text-slate-700">{a.title}</span>
                  <span className="ml-1 text-xs text-slate-400">· {STATUS_VI[a.status] ?? a.status} · {a._count.scores} điểm{a.overallScore != null ? ` · TB ${a.overallScore}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={create} className="flex gap-2 border-t border-slate-100 pt-3">
            <input className="input" placeholder="Tên đợt ĐGN" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
            <button className="btn-primary whitespace-nowrap">+ Tạo</button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2">
        {!detail ? (
          <div className="card p-10 text-center text-sm text-slate-400">Chọn hoặc tạo một đợt đánh giá ngoài</div>
        ) : (
          <div className="card p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-800">{detail.title}</h3>
                <p className="text-xs text-slate-400">Điểm tổng thể: {detail.overallScore ?? "—"}</p>
              </div>
              <select className="input w-44" value={detail.status} onChange={(e) => patchAssessment({ status: e.target.value })}>
                {Object.entries(STATUS_VI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input className="input" placeholder="Thành viên đoàn ĐGN" defaultValue={detail.assessorNames ?? ""} onBlur={(e) => patchAssessment({ assessorNames: e.target.value })} />
              <input className="input" placeholder="Kết luận / khuyến nghị công nhận" defaultValue={detail.decision ?? ""} onBlur={(e) => patchAssessment({ decision: e.target.value })} />
            </div>

            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="th">Tiêu chí</th><th className="th w-20">Điểm</th><th className="th">Điểm mạnh</th><th className="th">Cần cải thiện</th></tr></thead>
              <tbody>
                {detail.criteria.map((c) => (
                  <tr key={c.criterionId} className="align-top">
                    <td className="td"><span className="font-medium">{c.code}</span> <span className="text-xs text-slate-400">{c.titleVi}</span></td>
                    <td className="td">
                      <select className="input" defaultValue={c.score ?? ""} onChange={(e) => saveScore(c, { score: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className="td"><textarea className="input min-h-[2.5rem]" defaultValue={c.strengths ?? ""} onBlur={(e) => saveScore(c, { strengths: e.target.value })} /></td>
                    <td className="td"><textarea className="input min-h-[2.5rem]" defaultValue={c.areasForImprovement ?? ""} onBlur={(e) => saveScore(c, { areasForImprovement: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
