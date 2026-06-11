"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { ErrorBox } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface Member { id: string; fullName: string }
interface Task {
  id: string; title: string; status: string; priority: string;
  assigneeId: string | null; assigneeName: string | null;
  criterionCode: string | null; deliverables: string | null; dueDate: string | null;
}
interface PlanItem { title: string; criterionCode?: string; deliverables?: string; role?: string; priority?: string; dueOffsetDays?: number }

const STATUS_VI: Record<string, string> = { todo: "Cần làm", in_progress: "Đang làm", review: "Rà soát", done: "Hoàn thành" };

/** Kế hoạch & phân công công việc cho một đợt tự đánh giá (kèm minh chứng phải nộp). */
export function CyclePlanPanel({ cycleId }: { cycleId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setTasks((await api.get<Task[]>(`/api/cycles/${cycleId}/tasks`)) ?? []); }
    catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải công việc"); }
  }, [cycleId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<Member[]>("/api/members").then((m) => setMembers(m ?? [])).catch(() => {}); }, []);

  async function patch(id: string, data: Record<string, unknown>) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...data } : t)));
    try { await api.patch(`/api/tasks/${id}`, data); await load(); }
    catch (e) { setNote(e instanceof ApiClientError ? e.message : "Lỗi cập nhật"); load(); }
  }

  async function aiPlan() {
    setBusy(true); setNote(null);
    try { setPlan((await api.post<{ tasks: PlanItem[] }>(`/api/ai/cycle-plan?cycleId=${cycleId}`, {}))?.tasks ?? []); }
    catch (e) { setNote(e instanceof ApiClientError ? e.message : "Lỗi gọi AI (cần bật AI + có quyền)"); }
    finally { setBusy(false); }
  }
  async function applyPlan() {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await api.post<{ created: number }>(`/api/cycles/${cycleId}/plan`, { tasks: plan });
      setNote(`Đã tạo ${r?.created ?? 0} công việc.`); setPlan(null); await load();
    } catch (e) { setNote(e instanceof ApiClientError ? e.message : "Lỗi tạo kế hoạch"); }
    finally { setBusy(false); }
  }
  async function notifyMembers() {
    setBusy(true); setNote(null);
    try {
      const r = await api.post<{ sent: number }>(`/api/cycles/${cycleId}/notify`, {});
      setNote(`Đã gửi thông báo tới ${r?.sent ?? 0} thành viên.`);
    } catch (e) { setNote(e instanceof ApiClientError ? e.message : "Lỗi gửi thông báo"); }
    finally { setBusy(false); }
  }

  return (
    <div className="card mt-4 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Kế hoạch & phân công ({tasks.length})</h3>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={aiPlan} disabled={busy}>{busy ? "…" : "🤖 AI tạo kế hoạch"}</button>
          <button className="btn-outline" onClick={notifyMembers} disabled={busy}>🔔 Thông báo thành viên</button>
          <button className="btn-primary" onClick={() => setAddOpen(true)}>+ Thêm công việc</button>
        </div>
      </div>
      {err && <ErrorBox message={err} />}
      {note && <p className="mb-2 text-sm text-amber-600">{note}</p>}

      {plan && (
        <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm">
          <p className="font-medium text-indigo-700">AI đề xuất {plan.length} công việc — duyệt rồi tạo.</p>
          <ul className="my-2 max-h-44 space-y-1 overflow-y-auto text-xs text-slate-600">
            {plan.map((t, i) => (
              <li key={i}>• {t.criterionCode ? `[${t.criterionCode}] ` : ""}{t.title}{t.role ? ` — ${t.role}` : ""}{t.deliverables ? ` · MC: ${t.deliverables}` : ""}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={applyPlan} disabled={busy}>Tạo {plan.length} công việc</button>
            <button className="btn-outline" onClick={() => setPlan(null)}>Bỏ</button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có công việc. Dùng “🤖 AI tạo kế hoạch” hoặc “+ Thêm công việc”.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-100 text-left">
                <th className="py-1 pr-2">Công việc</th><th className="px-2">Tiêu chí</th>
                <th className="px-2">Người phụ trách</th><th className="px-2">Minh chứng phải nộp</th>
                <th className="px-2">Hạn</th><th className="px-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 align-top">
                  <td className="py-2 pr-2 font-medium text-slate-800">{t.title}</td>
                  <td className="px-2">{t.criterionCode ?? "—"}</td>
                  <td className="px-2">
                    <select className="input h-8 py-0 text-xs" value={t.assigneeId ?? ""} onChange={(e) => patch(t.id, { assigneeId: e.target.value || null })}>
                      <option value="">— Chưa giao —</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                    </select>
                  </td>
                  <td className="px-2 text-xs text-slate-600">
                    <input className="input h-8 py-0 text-xs" defaultValue={t.deliverables ?? ""} placeholder="vd: file biên bản, bảng số liệu…" onBlur={(e) => { if (e.target.value !== (t.deliverables ?? "")) patch(t.id, { deliverables: e.target.value || null }); }} />
                  </td>
                  <td className="px-2 text-xs text-slate-500">{t.dueDate ? new Date(t.dueDate).toLocaleDateString("vi-VN") : "—"}</td>
                  <td className="px-2">
                    <select className="input h-8 py-0 text-xs" value={t.status} onChange={(e) => patch(t.id, { status: e.target.value })}>
                      {Object.entries(STATUS_VI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddTask cycleId={cycleId} members={members} open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load(); }} />
    </div>
  );
}

function AddTask({ cycleId, members, open, onClose, onAdded }: { cycleId: string; members: Member[]; open: boolean; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState(""); const [criterionCode, setCrit] = useState("");
  const [assigneeId, setAssignee] = useState(""); const [deliverables, setDeliv] = useState("");
  const [dueDate, setDue] = useState(""); const [err, setErr] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setSaving(true);
    try {
      await api.post(`/api/cycles/${cycleId}/tasks`, {
        title, criterionCode: criterionCode || undefined, assigneeId: assigneeId || undefined,
        deliverables: deliverables || undefined, dueDate: dueDate || undefined,
      });
      setTitle(""); setCrit(""); setAssignee(""); setDeliv(""); setDue(""); onAdded();
    } catch (e2) { setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo công việc"); }
    finally { setSaving(false); }
  }
  return (
    <Modal open={open} title="Thêm công việc cho đợt" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Công việc *</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Tiêu chí (C1–C8)</label><input className="input" value={criterionCode} onChange={(e) => setCrit(e.target.value)} placeholder="C1" /></div>
          <div><label className="label">Hạn</label><input type="date" className="input" value={dueDate} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <div>
          <label className="label">Người phụ trách</label>
          <select className="input" value={assigneeId} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">— Chưa giao —</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
          </select>
        </div>
        <div><label className="label">Minh chứng phải nộp</label><textarea className="input min-h-16" value={deliverables} onChange={(e) => setDeliv(e.target.value)} placeholder="vd: biên bản họp, bảng số liệu PLO, đề cương đã duyệt…" /></div>
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang lưu…" : "Tạo"}</button>
        </div>
      </form>
    </Modal>
  );
}
