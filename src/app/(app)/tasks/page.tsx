"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, ErrorBox, Spinner } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
}
interface Column { status: string; tasks: Task[] }
interface Member { id: string; fullName: string }

const COLS: { status: string; label: string }[] = [
  { status: "todo", label: "Cần làm" },
  { status: "in_progress", label: "Đang làm" },
  { status: "review", label: "Rà soát" },
  { status: "done", label: "Hoàn thành" },
];
const PRIORITY: Record<string, string> = { low: "bg-slate-100 text-slate-500", normal: "bg-blue-100 text-blue-700", high: "bg-rose-100 text-rose-700" };

export default function TasksPage() {
  const [board, setBoard] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBoard((await api.get<Column[]>("/api/tasks?view=board")) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải nhiệm vụ");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<Member[]>("/api/members").then((m) => setMembers(m ?? [])).catch(() => {}); }, []);

  async function moveTo(taskId: string, status: string) {
    // Optimistic: cập nhật UI ngay rồi gọi API.
    setBoard((cols) => {
      const all = cols.flatMap((c) => c.tasks);
      const task = all.find((t) => t.id === taskId);
      if (!task || task.status === status) return cols;
      return cols.map((c) => ({
        ...c,
        tasks: c.status === status
          ? [...c.tasks.filter((t) => t.id !== taskId), { ...task, status }]
          : c.tasks.filter((t) => t.id !== taskId),
      }));
    });
    try {
      await api.patch(`/api/tasks/${taskId}`, { status });
    } catch {
      load(); // rollback bằng cách tải lại
    }
  }

  async function runReminders() {
    try {
      const r = await api.post<{ notified: number; emailsSent: number }>("/api/reminders/run", {});
      alert(`Đã nhắc ${r?.notified ?? 0} người (email gửi: ${r?.emailsSent ?? 0}).`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi gửi nhắc hạn");
    }
  }

  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      <PageHeader
        title="Nhiệm vụ"
        subtitle="Bảng Kanban — kéo‑thả thẻ giữa các cột để đổi trạng thái"
        action={
          <div className="flex items-center gap-2">
            <button className="btn-outline" onClick={runReminders}>Gửi nhắc hạn</button>
            <button className="btn-primary" onClick={() => setOpen(true)}>+ Tạo nhiệm vụ</button>
          </div>
        }
      />
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLS.map((col) => {
            const tasks = board.find((c) => c.status === col.status)?.tasks ?? [];
            return (
              <div
                key={col.status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) moveTo(dragId, col.status); setDragId(null); }}
                className="rounded-xl bg-slate-100/70 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                  <span className="rounded-full bg-white px-2 text-xs text-slate-500">{tasks.length}</span>
                </div>
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      className="card cursor-grab p-3 active:cursor-grabbing"
                    >
                      <p className="text-sm font-medium text-slate-800">{t.title}</p>
                      {t.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.description}</p>}
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`badge ${PRIORITY[t.priority] ?? ""}`}>{t.priority}</span>
                        {t.dueDate && <span className="text-xs text-slate-400">{new Date(t.dueDate).toLocaleDateString("vi-VN")}</span>}
                      </div>
                      {t.assigneeName && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-medium text-indigo-700">{t.assigneeName.charAt(0)}</span>
                          {t.assigneeName}
                        </div>
                      )}
                    </div>
                  ))}
                  {tasks.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">Trống</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateTask open={open} members={members} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(); }} />
    </div>
  );
}

function CreateTask({ open, members, onClose, onCreated }: { open: boolean; members: Member[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      await api.post("/api/tasks", {
        title, description: description || undefined, priority,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || undefined,
      });
      setTitle(""); setDesc(""); setDueDate(""); setAssigneeId("");
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo nhiệm vụ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Tạo nhiệm vụ" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Tiêu đề *</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
        <div><label className="label">Mô tả</label><textarea className="input min-h-16" value={description} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ưu tiên</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option>
            </select>
          </div>
          <div><label className="label">Hạn</label><input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
        <div>
          <label className="label">Người phụ trách</label>
          <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">— Chưa giao —</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
          </select>
        </div>
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang lưu…" : "Tạo"}</button>
        </div>
      </form>
    </Modal>
  );
}
