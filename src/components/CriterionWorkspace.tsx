"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api/client";

interface Req { id: string; code: string; title: string; guidance: string | null; indicators: { code: string; description: string }[]; status: string; note: string }
interface Ev { id: string; code: string; title: string; status: string; files: number }
interface Data { requirements: Req[]; suggestedEvidence: { description: string; type: string | null }[]; evidence: Ev[] }

const REQ_STATUS: Record<string, string> = { not_assessed: "Chưa đánh giá", met: "Đạt", partial: "Đạt một phần", not_met: "Chưa đạt", na: "Không áp dụng" };
const REQ_COLOR: Record<string, string> = { met: "bg-emerald-100 text-emerald-700", partial: "bg-amber-100 text-amber-700", not_met: "bg-rose-100 text-rose-700", na: "bg-slate-100 text-slate-500", not_assessed: "bg-slate-100 text-slate-400" };

/** Workspace theo tiêu chí: 53 yêu cầu (chấm mức đáp ứng) + minh chứng đã gắn + gợi ý. */
export function CriterionWorkspace({ sarId, criterionId }: { sarId: string; criterionId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.get<Data>(`/api/sars/${sarId}/criterion/${criterionId}`)); } catch { /* bỏ qua */ }
  }, [sarId, criterionId]);
  useEffect(() => { load(); }, [load]);

  async function setReq(requirementId: string, patch: { status?: string; note?: string }, current: Req) {
    const body = { requirementId, status: patch.status ?? current.status, note: patch.note ?? current.note };
    setData((d) => d ? { ...d, requirements: d.requirements.map((r) => r.id === requirementId ? { ...r, ...patch } : r) } : d);
    try { await api.post(`/api/sars/${sarId}/requirements`, body); }
    catch (e) { setNote(e instanceof ApiClientError ? e.message : "Lỗi lưu"); load(); }
  }

  if (!data) return null;
  const metN = data.requirements.filter((r) => r.status === "met").length;

  return (
    <div className="card p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Yêu cầu con & minh chứng của tiêu chí</h3>
      {note && <p className="mb-2 text-xs text-amber-600">{note}</p>}

      {/* Minh chứng đã gắn cho tiêu chí */}
      <div className="mb-4">
        <p className="label">Minh chứng đã gắn ({data.evidence.length})</p>
        {data.evidence.length === 0 ? (
          <p className="text-xs text-slate-400">Chưa có minh chứng nào gắn tiêu chí này. Vào <Link href="/evidence" className="text-indigo-600 hover:underline">Minh chứng</Link> để gắn.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {data.evidence.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <Link href={`/evidence/${e.id}`} className="font-mono text-indigo-600 hover:underline">{e.code}</Link>
                <span className="line-clamp-1 flex-1 text-slate-600">{e.title}</span>
                <span className="text-slate-400">{e.files} tệp · {e.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Checklist yêu cầu con */}
      {data.requirements.length > 0 && (
        <div className="mb-3">
          <p className="label">Đánh giá theo yêu cầu ({metN}/{data.requirements.length} đạt)</p>
          <ul className="space-y-2">
            {data.requirements.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-100 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800"><span className="font-mono text-xs text-slate-500">{r.code}</span> {r.title}</p>
                    {r.guidance && <p className="mt-0.5 text-xs text-slate-400">{r.guidance}</p>}
                  </div>
                  <select className={`shrink-0 rounded px-2 py-1 text-xs ${REQ_COLOR[r.status]}`} value={r.status} onChange={(e) => setReq(r.id, { status: e.target.value }, r)}>
                    {Object.entries(REQ_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <input className="input mt-1 h-8 py-0 text-xs" placeholder="Ghi chú / minh chứng cho yêu cầu này…" defaultValue={r.note} onBlur={(e) => { if (e.target.value !== r.note) setReq(r.id, { note: e.target.value }, r); }} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gợi ý minh chứng cần có */}
      {data.suggestedEvidence.length > 0 && (
        <div>
          <p className="label">Gợi ý minh chứng cần có</p>
          <ul className="list-disc pl-5 text-xs text-slate-500">
            {data.suggestedEvidence.map((s, i) => <li key={i}>{s.description}{s.type ? ` (${s.type})` : ""}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
