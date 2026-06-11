"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";

interface Criterion {
  criterionId: string; code: string; titleVi: string; completionPercent: number;
  hasAnalysis: boolean; hasScore: boolean; evidenceCount: number;
  requirementsAssessed: number; requirementsTotal: number;
}
interface Progress {
  sar: { id: string; title: string } | null;
  criteria: Criterion[];
  overallPercent: number;
  evidenceTotal: number;
  tasks: { total: number; done: number; overdue: number };
  behind: { assigneeId: string; assigneeName: string; overdue: number }[];
}

function Bar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="h-2 w-full rounded bg-slate-100">
      <div className={`h-2 rounded ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

/** Bảng theo dõi tiến độ đợt (D4). */
export function CycleProgressPanel({ cycleId }: { cycleId: string }) {
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.get<Progress>(`/api/cycles/${cycleId}/progress`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi tải tiến độ"); }
  }, [cycleId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="card mt-4 p-4 text-sm text-rose-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="card mt-4 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Theo dõi tiến độ đợt</h3>
        <button className="btn-outline text-xs" onClick={load}>Làm mới</button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-2xl font-semibold text-slate-800">{data.overallPercent}%</p>
          <p className="text-xs text-slate-500">Hoàn thiện chung</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-2xl font-semibold text-slate-800">{data.evidenceTotal}</p>
          <p className="text-xs text-slate-500">Minh chứng đã thu</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-2xl font-semibold text-slate-800">{data.tasks.done}/{data.tasks.total}</p>
          <p className="text-xs text-slate-500">Nhiệm vụ hoàn thành</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className={`text-2xl font-semibold ${data.tasks.overdue > 0 ? "text-rose-600" : "text-slate-800"}`}>{data.tasks.overdue}</p>
          <p className="text-xs text-slate-500">Nhiệm vụ quá hạn</p>
        </div>
      </div>

      {!data.sar ? (
        <p className="text-sm text-slate-400">Chưa có SAR trong đợt để đo tiến độ theo tiêu chí.</p>
      ) : (
        <div className="space-y-2">
          {data.criteria.map((c) => (
            <div key={c.criterionId} className="flex items-center gap-3 text-sm">
              <span className="w-44 shrink-0 truncate text-slate-700" title={`${c.code}. ${c.titleVi}`}>{c.code}. {c.titleVi}</span>
              <div className="flex-1"><Bar pct={c.completionPercent} /></div>
              <span className="w-10 shrink-0 text-right text-xs text-slate-500">{c.completionPercent}%</span>
              <span className="hidden w-40 shrink-0 text-xs text-slate-400 sm:inline">
                {c.hasAnalysis ? "✓PT" : "·PT"} {c.hasScore ? "✓Điểm" : "·Điểm"} MC:{c.evidenceCount} YC:{c.requirementsAssessed}/{c.requirementsTotal}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.behind.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold text-rose-600">Đang trễ hạn</p>
          <ul className="space-y-1 text-sm">
            {data.behind.map((b) => (
              <li key={b.assigneeId} className="flex justify-between">
                <span className="text-slate-700">{b.assigneeName}</span>
                <span className="text-rose-600">{b.overdue} việc quá hạn</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
