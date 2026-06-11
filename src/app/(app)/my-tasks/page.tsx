"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, authedUrl, ApiClientError } from "@/lib/api/client";
import { PageHeader, ErrorBox, Spinner } from "@/components/ui";
import { TaskEvidenceUpload } from "@/components/TaskEvidenceUpload";

interface Task {
  id: string; title: string; status: string; priority: string;
  deliverables: string | null; dueDate: string | null;
  cycleId: string | null; cycleName: string | null; criterionCode: string | null; fileCount: number;
}

const STATUS_VI: Record<string, string> = { todo: "Cần làm", in_progress: "Đang làm", review: "Rà soát", done: "Hoàn thành" };
const PRIORITY: Record<string, string> = { low: "bg-slate-100 text-slate-500", normal: "bg-blue-100 text-blue-700", high: "bg-rose-100 text-rose-700" };
const NO_CYCLE = "__none__";

interface Group { key: string; name: string; cycleId: string | null; tasks: Task[]; done: number; overdue: number }

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cycleFilter, setCycleFilter] = useState("all");
  const [hideDone, setHideDone] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try { setTasks((await api.get<Task[]>("/api/tasks/mine")) ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi tải công việc"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    try { await api.patch(`/api/tasks/${id}`, { status }); setNote("Đã cập nhật trạng thái."); }
    catch (e) { setNote(e instanceof ApiClientError ? e.message : "Lỗi cập nhật"); load(); }
  }

  // Nhóm công việc theo ĐỢT kiểm định (việc không thuộc đợt → "Nhiệm vụ khác").
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const t of tasks) {
      const key = t.cycleId ?? NO_CYCLE;
      const name = t.cycleName ?? "Nhiệm vụ khác (ngoài đợt)";
      const g = map.get(key) ?? { key, name, cycleId: t.cycleId, tasks: [], done: 0, overdue: 0 };
      g.tasks.push(t);
      if (t.status === "done") g.done++;
      else if (t.dueDate && new Date(t.dueDate).getTime() < now) g.overdue++;
      map.set(key, g);
    }
    // Sắp xếp việc trong nhóm: chưa xong trước, theo hạn rồi tiêu chí.
    const order: Record<string, number> = { todo: 0, in_progress: 1, review: 2, done: 3 };
    for (const g of map.values()) {
      g.tasks.sort((a, b) =>
        (order[a.status] ?? 9) - (order[b.status] ?? 9) ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
        (a.criterionCode ?? "").localeCompare(b.criterionCode ?? ""));
    }
    // Đợt có việc quá hạn / chưa xong nhiều lên trước; "ngoài đợt" cuối cùng.
    return [...map.values()].sort((a, b) =>
      (a.key === NO_CYCLE ? 1 : 0) - (b.key === NO_CYCLE ? 1 : 0) ||
      b.overdue - a.overdue ||
      a.name.localeCompare(b.name));
  }, [tasks, now]);

  const cycleOptions = useMemo(() => groups.map((g) => ({ key: g.key, name: g.name })), [groups]);
  const visibleGroups = groups
    .filter((g) => cycleFilter === "all" || g.key === cycleFilter)
    .map((g) => ({ ...g, tasks: hideDone ? g.tasks.filter((t) => t.status !== "done") : g.tasks }))
    .filter((g) => g.tasks.length > 0);

  if (error) return <ErrorBox message={error} />;

  const totalPending = tasks.filter((t) => t.status !== "done").length;

  return (
    <div>
      <PageHeader
        title="Công việc của tôi"
        subtitle="Công việc được giao — sắp xếp theo từng ĐỢT kiểm định; cập nhật trạng thái & nộp minh chứng"
        action={tasks.length > 0 ? (
          <div className="flex gap-2">
            <a className="btn-outline" href={authedUrl("/api/tasks/mine/export?format=xlsx")}>⬇ Excel</a>
            <a className="btn-outline" href={authedUrl("/api/tasks/mine/export?format=docx")}>⬇ Word</a>
          </div>
        ) : undefined}
      />
      {note && <p className="mb-3 text-sm text-emerald-600">{note}</p>}

      {loading ? <Spinner /> : tasks.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">Bạn chưa được giao công việc nào.</div>
      ) : (
        <>
          <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
            <div>
              <label className="label">Lọc theo đợt kiểm định</label>
              <select className="input" value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)}>
                <option value="all">Tất cả ({tasks.length} việc · {totalPending} cần xử lý)</option>
                {cycleOptions.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
              Ẩn việc đã hoàn thành
            </label>
            <span className="ml-auto text-xs text-slate-400">{groups.filter((g) => g.cycleId).length} đợt kiểm định</span>
          </div>

          {visibleGroups.map((g) => {
            const pct = g.tasks.length ? Math.round((g.done / g.tasks.length) * 100) : 0;
            const isCollapsed = collapsed[g.key];
            return (
              <div key={g.key} className="card mb-4 overflow-hidden">
                <button
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50/50"
                  onClick={() => setCollapsed((s) => ({ ...s, [g.key]: !s[g.key] }))}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-slate-700">
                      {isCollapsed ? "▸" : "▾"} {g.cycleId ? <Link href={`/cycles/${g.cycleId}`} onClick={(e) => e.stopPropagation()} className="text-indigo-600 hover:underline">{g.name}</Link> : g.name}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      {g.tasks.length} việc · {g.done} xong{g.overdue > 0 ? <span className="text-rose-500"> · {g.overdue} quá hạn</span> : ""}
                    </span>
                  </div>
                  <div className="flex w-40 shrink-0 items-center gap-2">
                    <div className="h-1.5 flex-1 rounded bg-slate-100"><div className={`h-1.5 rounded ${pct === 100 ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} /></div>
                    <span className="w-9 text-right text-xs text-slate-500">{pct}%</span>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-slate-50">
                    {g.tasks.map((t) => (
                      <div key={t.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${t.status === "done" ? "opacity-60" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800">
                            {t.criterionCode && <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t.criterionCode}</span>}
                            {t.title}
                            <span className={`ml-2 badge ${PRIORITY[t.priority] ?? ""}`}>{t.priority}</span>
                          </p>
                          {t.deliverables && <p className="mt-0.5 text-xs text-amber-700">📎 Minh chứng phải nộp: {t.deliverables}</p>}
                        </div>
                        {t.dueDate && <span className={`text-xs ${t.status !== "done" && new Date(t.dueDate).getTime() < now ? "font-medium text-rose-500" : "text-slate-400"}`}>Hạn: {new Date(t.dueDate).toLocaleDateString("vi-VN")}</span>}
                        <select className="input h-9 w-32 py-0 text-sm" value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}>
                          {Object.entries(STATUS_VI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <TaskEvidenceUpload taskId={t.id} initialCount={t.fileCount} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {visibleGroups.length === 0 && <div className="card p-8 text-center text-sm text-slate-400">Không có công việc phù hợp bộ lọc.</div>}
        </>
      )}
    </div>
  );
}
