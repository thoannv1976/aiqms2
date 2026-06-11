"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, ErrorBox, Spinner } from "@/components/ui";
import { TaskEvidenceUpload } from "@/components/TaskEvidenceUpload";

interface Task {
  id: string; title: string; status: string; priority: string;
  deliverables: string | null; dueDate: string | null;
  cycleId: string | null; cycleName: string | null; criterionCode: string | null; fileCount: number;
}

const STATUS_VI: Record<string, string> = { todo: "Cần làm", in_progress: "Đang làm", review: "Rà soát", done: "Hoàn thành" };
const PRIORITY: Record<string, string> = { low: "bg-slate-100 text-slate-500", normal: "bg-blue-100 text-blue-700", high: "bg-rose-100 text-rose-700" };

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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

  const pending = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      <PageHeader title="Công việc của tôi" subtitle="Các công việc được phân công (đợt kiểm định, nhiệm vụ) — cập nhật trạng thái & nộp minh chứng" />
      {note && <p className="mb-3 text-sm text-emerald-600">{note}</p>}
      {loading ? <Spinner /> : tasks.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">Bạn chưa được giao công việc nào.</div>
      ) : (
        <>
          <Section title={`Cần xử lý (${pending.length})`} tasks={pending} onStatus={setStatus} />
          {done.length > 0 && <Section title={`Đã hoàn thành (${done.length})`} tasks={done} onStatus={setStatus} muted />}
        </>
      )}
    </div>
  );
}

function Section({ title, tasks, onStatus, muted }: { title: string; tasks: Task[]; onStatus: (id: string, s: string) => void; muted?: boolean }) {
  return (
    <div className={`card mb-4 overflow-hidden ${muted ? "opacity-70" : ""}`}>
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{title}</div>
      <div className="divide-y divide-slate-50">
        {tasks.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-800">
                {t.criterionCode && <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t.criterionCode}</span>}
                {t.title}
                <span className={`ml-2 badge ${PRIORITY[t.priority] ?? ""}`}>{t.priority}</span>
              </p>
              {t.cycleName && (
                <p className="text-xs text-slate-400">
                  Đợt: {t.cycleId ? <Link href={`/cycles/${t.cycleId}`} className="text-indigo-500 hover:underline">{t.cycleName}</Link> : t.cycleName}
                </p>
              )}
              {t.deliverables && <p className="mt-0.5 text-xs text-amber-700">📎 Minh chứng phải nộp: {t.deliverables}</p>}
            </div>
            {t.dueDate && <span className="text-xs text-slate-400">Hạn: {new Date(t.dueDate).toLocaleDateString("vi-VN")}</span>}
            <select className="input h-9 w-32 py-0 text-sm" value={t.status} onChange={(e) => onStatus(t.id, e.target.value)}>
              {Object.entries(STATUS_VI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <TaskEvidenceUpload taskId={t.id} initialCount={t.fileCount} />
          </div>
        ))}
      </div>
    </div>
  );
}
