"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, Spinner, ErrorBox } from "@/components/ui";
import { ExportButton } from "@/components/ExportButton";
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

// Nhãn tiếng Việt cho trạng thái SAR (vòng đời).
const SAR_STATUS_VI: Record<string, string> = {
  not_started: "Chưa bắt đầu",
  collecting: "Đang thu thập dữ liệu",
  drafting: "Đang viết báo cáo",
  faculty_review: "Chờ rà soát cấp khoa",
  needs_revision: "Cần chỉnh sửa",
  university_review: "Chờ rà soát cấp trường",
  internal_done: "Hoàn thành nội bộ",
  ready_external: "Sẵn sàng đánh giá ngoài",
  external_done: "Đã đánh giá ngoài",
  improving: "Đang cải tiến",
  completed: "Hoàn tất",
};
const sarStatusVi = (s: string) => SAR_STATUS_VI[s] ?? s;

export default function SarEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [sar, setSar] = useState<Sar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Response>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "review" | "comments">("edit");

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
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={sar.status} />
            {nextStates.map((s) => (
              <button key={s} className="btn-outline" onClick={() => changeStatus(s)}>→ {sarStatusVi(s)}</button>
            ))}
            <ExportButton type="sar_docx" sarId={sar.id} label="Xuất Word" />
            <ExportButton type="sar_pdf" sarId={sar.id} label="Xuất PDF" />
          </div>
        }
      />

      {/* Tab: Soạn báo cáo | Đánh giá nội bộ | Nhận xét */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {([["edit", "Soạn báo cáo"], ["review", "Đánh giá nội bộ"], ["comments", "Nhận xét / Góp ý"]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "review" && (
        <ReviewTab
          sarId={sar.id}
          criteria={sar.responses.map((r) => ({ criterionId: r.criterionId, code: r.criterion?.code ?? "?", titleVi: r.criterion?.titleVi ?? "" }))}
        />
      )}

      {tab === "comments" && (
        <CommentsTab
          sarId={sar.id}
          criteria={sar.responses.map((r) => ({ criterionId: r.criterionId, code: r.criterion?.code ?? "?" }))}
        />
      )}

      {/* Chọn tiêu chí */}
      {tab === "edit" && (
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
      )}

      {tab === "edit" && selected && (
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

interface Agg { criterionId: string; reviewerCount: number; average: number; min: number; max: number }
interface CriterionRef { criterionId: string; code: string; titleVi: string }

function ReviewTab({ sarId, criteria }: { sarId: string; criteria: CriterionRef[] }) {
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [agg, setAgg] = useState<Agg[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, { score: string; recommendation: string }>>({});

  const loadAgg = useCallback(async () => {
    try {
      setAgg((await api.get<Agg[]>(`/api/sars/${sarId}/reviews`)) ?? []);
    } catch {
      /* SAR_REVIEW cần thiết */
    }
  }, [sarId]);
  useEffect(() => { loadAgg(); }, [loadAgg]);

  async function openReview() {
    setNote(null);
    try {
      const r = await api.post<{ id: string }>(`/api/sars/${sarId}/reviews`);
      setReviewId(r?.id ?? null);
    } catch (e) {
      setNote(e instanceof ApiClientError && e.status === 403 ? "Bạn không có quyền rà soát (cần vai trò hội đồng rà soát)." : "Lỗi mở phiên rà soát");
    }
  }

  async function saveScore(criterionId: string) {
    if (!reviewId) return;
    const s = scores[criterionId];
    const val = Number(s?.score);
    if (!val || val < 1 || val > 7) { setNote("Điểm phải trong khoảng 1–7"); return; }
    try {
      await api.post(`/api/reviews/${reviewId}/scores`, { criterionId, score: val, recommendation: s?.recommendation || undefined });
      setNote("Đã lưu điểm.");
      await loadAgg();
    } catch (e) {
      setNote(e instanceof ApiClientError ? e.message : "Lỗi lưu điểm");
    }
  }

  const aggOf = (cid: string) => agg.find((a) => a.criterionId === cid);

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between p-4">
        <p className="text-sm text-slate-600">Chấm điểm độc lập từng tiêu chí; hệ thống tổng hợp & so sánh giữa các thành viên hội đồng.</p>
        {reviewId ? (
          <span className="badge bg-emerald-100 text-emerald-700">Đã mở phiên rà soát</span>
        ) : (
          <button className="btn-primary" onClick={openReview}>Mở phiên rà soát của tôi</button>
        )}
      </div>
      {note && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">{note}</div>}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Tiêu chí</th>
              <th className="th w-32">Điểm của tôi</th>
              <th className="th">Khuyến nghị</th>
              <th className="th w-40">Tổng hợp hội đồng</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const a = aggOf(c.criterionId);
              return (
                <tr key={c.criterionId}>
                  <td className="td"><span className="font-medium">{c.code}</span> {c.titleVi}</td>
                  <td className="td">
                    <input
                      type="number" min={1} max={7} className="input h-9 py-1" disabled={!reviewId}
                      value={scores[c.criterionId]?.score ?? ""}
                      onChange={(e) => setScores({ ...scores, [c.criterionId]: { ...scores[c.criterionId], score: e.target.value, recommendation: scores[c.criterionId]?.recommendation ?? "" } })}
                    />
                  </td>
                  <td className="td">
                    <input
                      className="input h-9 py-1" disabled={!reviewId} placeholder="Khuyến nghị cải tiến"
                      value={scores[c.criterionId]?.recommendation ?? ""}
                      onChange={(e) => setScores({ ...scores, [c.criterionId]: { ...scores[c.criterionId], recommendation: e.target.value, score: scores[c.criterionId]?.score ?? "" } })}
                    />
                  </td>
                  <td className="td text-xs text-slate-500">
                    {a ? `${a.reviewerCount} người · TB ${a.average} (${a.min}–${a.max})` : "—"}
                    {reviewId && (
                      <button className="ml-2 text-indigo-600 hover:underline" onClick={() => saveScore(c.criterionId)}>Lưu</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SarComment { id: string; body: string; criterionId: string | null; authorId: string | null; createdAt: string }

function CommentsTab({ sarId, criteria }: { sarId: string; criteria: { criterionId: string; code: string }[] }) {
  const [comments, setComments] = useState<SarComment[]>([]);
  const [body, setBody] = useState("");
  const [criterionId, setCriterionId] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setComments((await api.get<SarComment[]>(`/api/sars/${sarId}/comments`)) ?? []);
  }, [sarId]);
  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!body.trim()) return;
    setBusy(true); setNote(null);
    try {
      await api.post(`/api/sars/${sarId}/comments`, { body, criterionId: criterionId || undefined });
      setBody(""); setCriterionId("");
      await load();
    } catch (e) {
      setNote(e instanceof ApiClientError ? e.message : "Lỗi gửi góp ý");
    } finally {
      setBusy(false);
    }
  }

  const codeOf = (cid: string | null) => (cid ? criteria.find((c) => c.criterionId === cid)?.code ?? "" : "");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Góp ý rà soát (cấp khoa / cấp trường)</h3>
          {comments.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có góp ý nào.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                    {c.criterionId && <span className="badge bg-indigo-100 text-indigo-700">{codeOf(c.criterionId)}</span>}
                    <span>{new Date(c.createdAt).toLocaleString("vi-VN")}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="lg:col-span-1">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Thêm góp ý</h3>
          <label className="label">Gắn tiêu chí (tùy chọn)</label>
          <select className="input mb-2" value={criterionId} onChange={(e) => setCriterionId(e.target.value)}>
            <option value="">Góp ý chung</option>
            {criteria.map((c) => <option key={c.criterionId} value={c.criterionId}>{c.code}</option>)}
          </select>
          <textarea className="input min-h-24" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Nội dung góp ý…" />
          <button className="btn-primary mt-2 w-full" onClick={send} disabled={busy}>{busy ? "Đang gửi…" : "Gửi góp ý"}</button>
          {note && <p className="mt-2 text-sm text-amber-600">{note}</p>}
        </div>
      </div>
    </div>
  );
}
