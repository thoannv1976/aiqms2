"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, Spinner, ErrorBox } from "@/components/ui";
import { SAR_TRANSITIONS } from "@/lib/sar/state";

interface Criterion { code: string; titleVi: string }
interface Response {
  id: string;
  criterionId: string;
  currentState: string | null;
  analysis: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvementDone: string | null;
  improvementPlan: string | null;
  selfScore: number | null;
  status: string;
  criterion: Criterion | null;
}
interface Sar { id: string; title: string; status: string; responses: Response[] }

type FieldKey =
  | "currentState" | "analysis" | "strengths" | "weaknesses"
  | "improvementDone" | "improvementPlan";

const FIELDS: { key: FieldKey; label: string; ai?: boolean }[] = [
  { key: "currentState", label: "Mô tả hiện trạng" },
  { key: "analysis", label: "Phân tích mức độ đáp ứng", ai: true },
  { key: "strengths", label: "Điểm mạnh", ai: true },
  { key: "weaknesses", label: "Điểm tồn tại", ai: true },
  { key: "improvementDone", label: "Cải tiến đã thực hiện" },
  { key: "improvementPlan", label: "Kế hoạch cải tiến" },
];

export default function SarEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [sar, setSar] = useState<Sar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Response>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Sar>(`/api/sars/${id}`);
      setSar(data);
      setSelectedId((cur) => cur ?? data?.responses[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải SAR");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const selected = sar?.responses.find((r) => r.id === selectedId) ?? null;
  useEffect(() => {
    if (selected) setForm({ ...selected });
  }, [selectedId, selected]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of FIELDS) payload[f.key] = form[f.key] ?? null;
      payload.selfScore = form.selfScore ?? undefined;
      payload.status = form.status;
      await api.patch(`/api/sar-responses/${selected.id}`, payload);
      setMsg("Đã lưu");
      await load();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : "Lỗi lưu");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(to: string) {
    try {
      await api.post(`/api/sars/${id}/status`, { to });
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Lỗi đổi trạng thái");
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!sar) return <Spinner />;

  const nextStates = SAR_TRANSITIONS[sar.status as keyof typeof SAR_TRANSITIONS] ?? [];

  return (
    <div>
      <PageHeader
        title={sar.title}
        subtitle="Soạn báo cáo tự đánh giá theo từng tiêu chí — có AI hỗ trợ"
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={sar.status} />
            {nextStates.map((s) => (
              <button key={s} className="btn-outline" onClick={() => changeStatus(s)}>→ {s}</button>
            ))}
          </div>
        }
      />

      {/* Chọn tiêu chí */}
      <div className="mb-4 flex flex-wrap gap-2">
        {sar.responses.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              selectedId === r.id ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {r.criterion?.code ?? "?"} <StatusBadge status={r.status} />
          </button>
        ))}
      </div>

      {selected && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Cột soạn thảo */}
          <div className="space-y-4 lg:col-span-2">
            <div className="card p-5">
              <h2 className="mb-1 text-lg font-semibold text-slate-900">
                {selected.criterion?.code}. {selected.criterion?.titleVi}
              </h2>
              <div className="mt-4 space-y-4">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="label">{f.label}</label>
                    <textarea
                      className="input min-h-20"
                      value={(form[f.key] as string) ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Điểm tự đánh giá (1–7)</label>
                    <input
                      type="number" min={1} max={7} className="input"
                      value={form.selfScore ?? ""}
                      onChange={(e) => setForm({ ...form, selfScore: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                  <div>
                    <label className="label">Trạng thái tiêu chí</label>
                    <select className="input" value={form.status ?? "not_started"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="not_started">Chưa bắt đầu</option>
                      <option value="in_progress">Đang làm</option>
                      <option value="needs_more">Cần bổ sung</option>
                      <option value="completed">Đã hoàn thành</option>
                      <option value="reviewed">Đã rà soát</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Đang lưu…" : "Lưu"}</button>
                {msg && <span className="text-sm text-slate-500">{msg}</span>}
              </div>
            </div>
          </div>

          {/* Panel AI bên cạnh nội dung đang soạn (đặc tả mục 7) */}
          <AiPanel responseId={selected.id} onApplied={load} />
        </div>
      )}
    </div>
  );
}

function AiPanel({ responseId, onApplied }: { responseId: string; onApplied: () => void }) {
  const [field, setField] = useState<"analysis" | "strengths" | "weaknesses">("analysis");
  const [draft, setDraft] = useState<{ id: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function generate() {
    setLoading(true); setNote(null); setDraft(null);
    try {
      const d = await api.post<{ id: string; content: string }>("/api/ai/draft-sar", { sarResponseId: responseId, field });
      setDraft(d);
    } catch (e) {
      setNote(e instanceof ApiClientError && e.status === 403 ? "AI đang tắt cho trường này (bật trong cấu hình AI)." : e instanceof Error ? e.message : "Lỗi AI");
    } finally {
      setLoading(false);
    }
  }
  async function approve() {
    if (!draft) return;
    await api.post(`/api/ai/drafts/${draft.id}/approve`);
    setDraft(null); setNote("Đã duyệt và ghi vào báo cáo.");
    onApplied();
  }
  async function reject() {
    if (!draft) return;
    await api.post(`/api/ai/drafts/${draft.id}/reject`);
    setDraft(null); setNote("Đã bỏ bản nháp.");
  }

  return (
    <div className="lg:col-span-1">
      <div className="card sticky top-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-xs font-bold text-white">AI</span>
          <h3 className="text-sm font-semibold text-slate-700">Trợ lý viết SAR</h3>
        </div>
        <p className="mb-3 text-xs text-slate-400">Nội dung AI là <b>bản nháp</b> — chỉ vào báo cáo khi bạn duyệt.</p>

        <label className="label">Mục cần viết nháp</label>
        <select className="input mb-3" value={field} onChange={(e) => setField(e.target.value as typeof field)}>
          <option value="analysis">Phân tích mức độ đáp ứng</option>
          <option value="strengths">Điểm mạnh</option>
          <option value="weaknesses">Điểm tồn tại</option>
        </select>
        <button className="btn-primary w-full" onClick={generate} disabled={loading}>
          {loading ? "Đang tạo…" : "✨ AI viết nháp"}
        </button>

        {note && <p className="mt-3 text-sm text-amber-600">{note}</p>}

        {draft && (
          <div className="mt-4">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm text-slate-700">
              <span className="badge mb-2 bg-indigo-100 text-indigo-700">bản nháp AI</span>
              <p className="whitespace-pre-wrap">{draft.content}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1" onClick={approve}>Duyệt & ghi vào báo cáo</button>
              <button className="btn-outline" onClick={reject}>Bỏ</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
