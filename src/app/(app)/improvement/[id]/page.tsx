"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, authedUrl, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, Spinner, ErrorBox } from "@/components/ui";

interface Progress { id: string; note: string; percent: number | null; createdAt: string }
interface Action { id: string; action: string; pdcaPhase: string; status: string; responsibleUnit: string | null; dueDate: string | null; progress: Progress[] }
interface Kpi { id: string; name: string; unit: string | null; target: number | null; actual: number | null }
interface Plan { id: string; title: string; issue: string | null; cause: string | null; status: string; actions: Action[]; kpis: Kpi[] }

const PHASE: Record<string, string> = { plan: "Plan", do: "Do", check: "Check", act: "Act" };

export default function ImprovementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlan(await api.get<Plan>(`/api/improvement-plans/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải kế hoạch");
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function exportWord() {
    setExporting(true); setExportNote(null);
    try {
      const job = await api.post<{ id: string; status: string }>("/api/exports", { type: "improvement_docx", planId: id });
      if (job?.status === "done") window.location.href = authedUrl(`/api/exports/${job.id}/download`);
      else setExportNote("Xuất chưa hoàn tất — xem ở trang Xuất báo cáo");
    } catch (e) {
      setExportNote(e instanceof ApiClientError ? e.message : "Lỗi xuất Word (cần quyền xuất báo cáo)");
    } finally {
      setExporting(false);
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!plan) return <Spinner />;

  return (
    <div>
      <PageHeader
        title={plan.title}
        subtitle="Chi tiết kế hoạch cải tiến (PDCA)"
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={plan.status} />
            <button className="btn-outline" onClick={exportWord} disabled={exporting}>{exporting ? "Đang xuất…" : "Xuất Word"}</button>
          </div>
        }
      />
      {exportNote && <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{exportNote}</div>}

      {(plan.issue || plan.cause) && (
        <div className="card mb-4 grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <div><p className="label">Vấn đề</p><p className="text-sm text-slate-600">{plan.issue ?? "—"}</p></div>
          <div><p className="label">Nguyên nhân</p><p className="text-sm text-slate-600">{plan.cause ?? "—"}</p></div>
        </div>
      )}

      <AiSuggestPanel planId={plan.id} onChanged={load} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ActionsPanel planId={plan.id} actions={plan.actions} onChanged={load} />
        </div>
        <KpisPanel planId={plan.id} kpis={plan.kpis} onChanged={load} />
      </div>
    </div>
  );
}

function ActionsPanel({ planId, actions, onChanged }: { planId: string; actions: Action[]; onChanged: () => void }) {
  const [action, setAction] = useState("");
  const [phase, setPhase] = useState("plan");
  const [unit, setUnit] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function addAction(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post(`/api/improvement-plans/${planId}/actions`, { action, pdcaPhase: phase, responsibleUnit: unit || undefined });
      setAction(""); setUnit("");
      onChanged();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi thêm hành động");
    }
  }
  async function logProgress(actionId: string) {
    const note = prompt("Ghi chú tiến độ:");
    if (note === null) return;
    const pctStr = prompt("Phần trăm hoàn thành (0–100):", "100");
    const percent = pctStr ? Number(pctStr) : undefined;
    await api.post(`/api/improvement-actions/${actionId}/progress`, { note, percent });
    onChanged();
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Hành động cải tiến (PDCA)</h3>
      <div className="mb-4 space-y-3">
        {actions.length === 0 && <p className="text-sm text-slate-400">Chưa có hành động</p>}
        {actions.map((a) => (
          <div key={a.id} className="rounded-lg border border-slate-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="badge bg-indigo-100 text-indigo-700">{PHASE[a.pdcaPhase] ?? a.pdcaPhase}</span>
                <span className="ml-2 text-sm font-medium text-slate-800">{a.action}</span>
                {a.responsibleUnit && <p className="mt-1 text-xs text-slate-400">Đơn vị: {a.responsibleUnit}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={a.status} />
                <button className="text-xs text-indigo-600 hover:underline" onClick={() => logProgress(a.id)}>+ Tiến độ</button>
              </div>
            </div>
            {a.progress.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                {a.progress.map((p) => (
                  <li key={p.id}>• {p.note}{p.percent != null ? ` (${p.percent}%)` : ""}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={addAction} className="space-y-2 border-t border-slate-100 pt-3">
        <div className="flex gap-2">
          <input className="input flex-1" value={action} onChange={(e) => setAction(e.target.value)} placeholder="Hành động cải tiến…" required />
          <select className="input w-28" value={phase} onChange={(e) => setPhase(e.target.value)}>
            {Object.entries(PHASE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input className="input flex-1" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Đơn vị phụ trách (tùy chọn)" />
          <button className="btn-primary">+ Thêm hành động</button>
        </div>
        {err && <ErrorBox message={err} />}
      </form>
    </div>
  );
}

function KpisPanel({ planId, kpis, onChanged }: { planId: string; kpis: Kpi[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState("");

  async function addKpi(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/api/improvement-plans/${planId}/kpis`, { name, unit: unit || undefined, target: target ? Number(target) : undefined });
    setName(""); setUnit(""); setTarget("");
    onChanged();
  }

  return (
    <div className="lg:col-span-1">
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">KPI đo lường</h3>
        <ul className="mb-4 space-y-2">
          {kpis.length === 0 && <p className="text-sm text-slate-400">Chưa có KPI</p>}
          {kpis.map((k) => (
            <li key={k.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{k.name}</span>
              <span className="text-slate-500">{k.actual ?? "—"}/{k.target ?? "—"} {k.unit ?? ""}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={addKpi} className="space-y-2 border-t border-slate-100 pt-3">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên KPI" required />
          <div className="flex gap-2">
            <input className="input" type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Mục tiêu" />
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Đơn vị" />
          </div>
          <button className="btn-primary w-full">+ Thêm KPI</button>
        </form>
      </div>
    </div>
  );
}

interface SuggAction { action: string; pdcaPhase: string; responsibleUnit?: string }
interface SuggKpi { name: string; unit?: string; target?: number }
interface Suggestion { actions: SuggAction[]; kpis: SuggKpi[] }

/** AI gợi ý hành động/KPI cải tiến — human-in-the-loop: chỉ thêm khi người dùng bấm "Thêm". */
function AiSuggestPanel({ planId, onChanged }: { planId: string; onChanged: () => void }) {
  const [sugg, setSugg] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function generate() {
    setBusy(true); setNote(null);
    try {
      setSugg(await api.post<Suggestion>(`/api/ai/suggest-improvement?planId=${planId}`, {}));
    } catch (e) {
      setNote(e instanceof ApiClientError ? e.message : "Lỗi gọi AI (cần bật AI + quyền AI)");
    } finally {
      setBusy(false);
    }
  }
  async function addAction(a: SuggAction, key: string) {
    await api.post(`/api/improvement-plans/${planId}/actions`, { action: a.action, pdcaPhase: a.pdcaPhase, responsibleUnit: a.responsibleUnit || undefined });
    setAdded((s) => new Set(s).add(key)); onChanged();
  }
  async function addKpi(k: SuggKpi, key: string) {
    await api.post(`/api/improvement-plans/${planId}/kpis`, { name: k.name, unit: k.unit || undefined, target: k.target });
    setAdded((s) => new Set(s).add(key)); onChanged();
  }

  return (
    <div className="card mb-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">🤖 AI gợi ý cải tiến (PDCA)</h3>
        <button className="btn-outline" onClick={generate} disabled={busy}>{busy ? "Đang gợi ý…" : "Gợi ý bằng AI"}</button>
      </div>
      <p className="mt-1 text-xs text-slate-400">AI đề xuất hành động & KPI dựa trên vấn đề/nguyên nhân. Bạn xem rồi chọn “Thêm” mới đưa vào kế hoạch.</p>
      {note && <p className="mt-2 text-sm text-amber-600">{note}</p>}
      {sugg && (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="label">Hành động đề xuất</p>
            <ul className="space-y-2">
              {sugg.actions.map((a, i) => {
                const key = `a${i}`;
                return (
                  <li key={key} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-2 text-sm">
                    <span><span className="badge bg-indigo-100 text-indigo-700">{PHASE[a.pdcaPhase] ?? a.pdcaPhase}</span> {a.action}{a.responsibleUnit ? ` — ${a.responsibleUnit}` : ""}</span>
                    <button className="shrink-0 text-xs text-indigo-600 hover:underline disabled:text-slate-300" disabled={added.has(key)} onClick={() => addAction(a, key)}>{added.has(key) ? "Đã thêm" : "Thêm"}</button>
                  </li>
                );
              })}
              {sugg.actions.length === 0 && <li className="text-xs text-slate-400">Không có gợi ý</li>}
            </ul>
          </div>
          <div>
            <p className="label">KPI đề xuất</p>
            <ul className="space-y-2">
              {sugg.kpis.map((k, i) => {
                const key = `k${i}`;
                return (
                  <li key={key} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-2 text-sm">
                    <span>{k.name}{k.target != null ? ` (mục tiêu ${k.target}${k.unit ?? ""})` : ""}</span>
                    <button className="shrink-0 text-xs text-indigo-600 hover:underline disabled:text-slate-300" disabled={added.has(key)} onClick={() => addKpi(k, key)}>{added.has(key) ? "Đã thêm" : "Thêm"}</button>
                  </li>
                );
              })}
              {sugg.kpis.length === 0 && <li className="text-xs text-slate-400">Không có gợi ý</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
