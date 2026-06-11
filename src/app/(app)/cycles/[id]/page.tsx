"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, Spinner, ErrorBox } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { CyclePlanPanel } from "@/components/CyclePlanPanel";
import { CycleProgressPanel } from "@/components/CycleProgressPanel";

interface Sar { id: string; title: string; status: string }
interface Cycle { id: string; name: string; year: number | null; status: string; reports: Sar[]; programme: { code: string; name: string } | null }
interface Programme { id: string; code: string; name: string; versions: { id: string; version: string }[] }

export default function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try { setCycle(await api.get<Cycle>(`/api/cycles/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi tải đợt"); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function toggle() {
    try { await api.post(`/api/cycles/${id}/status`); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Lỗi đổi trạng thái"); }
  }

  if (error) return <ErrorBox message={error} />;
  if (!cycle) return <Spinner />;

  return (
    <div>
      <PageHeader
        title={cycle.name}
        subtitle={`Đợt tự đánh giá${cycle.year ? ` · ${cycle.year}` : ""}${cycle.programme ? ` · CTĐT: ${cycle.programme.code} — ${cycle.programme.name}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={cycle.status} />
            <button className="btn-outline" onClick={toggle}>{cycle.status === "open" ? "Đóng đợt" : "Mở lại"}</button>
            <button className="btn-primary" onClick={() => setOpen(true)}>+ Tạo SAR</button>
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          Báo cáo tự đánh giá trong đợt ({cycle.reports.length})
        </div>
        {cycle.reports.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Chưa có SAR nào. Bấm nút “+ Tạo SAR” để bắt đầu.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50"><tr><th className="th">Tiêu đề</th><th className="th">Trạng thái</th></tr></thead>
            <tbody>
              {cycle.reports.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="td"><Link href={`/sars/${s.id}`} className="font-medium text-indigo-600 hover:underline">{s.title}</Link></td>
                  <td className="td"><StatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CycleProgressPanel cycleId={cycle.id} />

      <CyclePlanPanel cycleId={cycle.id} />

      <CreateSar cycleId={cycle.id} open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(); }} />
    </div>
  );
}

function CreateSar({ cycleId, open, onClose, onCreated }: { cycleId: string; open: boolean; onClose: () => void; onCreated: () => void }) {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [title, setTitle] = useState(""); const [programmeId, setProgrammeId] = useState(""); const [versionId, setVersionId] = useState("");
  const [err, setErr] = useState<string | null>(null); const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) api.get<{ items: Programme[] }>("/api/programmes?pageSize=100").then((d) => setProgrammes(d?.items ?? [])).catch(() => {}); }, [open]);
  const programme = programmes.find((p) => p.id === programmeId);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setSaving(true);
    try {
      await api.post("/api/sars", { assessmentCycleId: cycleId, programmeVersionId: versionId, title });
      setTitle(""); setProgrammeId(""); setVersionId(""); onCreated();
    } catch (e2) { setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo SAR"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} title="Tạo SAR trong đợt" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Tiêu đề SAR *</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
        <div>
          <label className="label">Chương trình *</label>
          <select className="input" value={programmeId} onChange={(e) => { setProgrammeId(e.target.value); setVersionId(""); }} required>
            <option value="">-- chọn --</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </div>
        {programme && (
          <div>
            <label className="label">Phiên bản *</label>
            <select className="input" value={versionId} onChange={(e) => setVersionId(e.target.value)} required>
              <option value="">-- chọn --</option>
              {programme.versions.map((v) => <option key={v.id} value={v.id}>{v.version}</option>)}
            </select>
          </div>
        )}
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang tạo…" : "Tạo SAR"}</button>
        </div>
      </form>
    </Modal>
  );
}
