"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, authedUrl, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, Spinner, ErrorBox } from "@/components/ui";

interface Question { id: string; order: number; text: string; type: string }
interface Survey { id: string; title: string; description: string | null; status: string; token: string | null; questions: Question[] }
interface Result { totalResponses: number; perQuestion: { questionId: string; text: string; type: string; count: number; average: number | null }[] }

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [results, setResults] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState("rating");
  const [outcomeMsg, setOutcomeMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api.get<Survey>(`/api/surveys/${id}`);
      setSurvey(s);
      setResults(await api.get<Result>(`/api/surveys/${id}/results`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải khảo sát");
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!survey) return;
    await api.post(`/api/surveys/${id}/questions`, { text: qText, type: qType, order: survey.questions.length + 1 });
    setQText("");
    load();
  }
  async function openSurvey() {
    try {
      await api.post(`/api/surveys/${id}/open`);
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Lỗi mở khảo sát");
    }
  }
  async function toOutcome() {
    try {
      const o = await api.post<{ name: string; value: number }>(`/api/surveys/${id}/to-outcome`, {});
      setOutcomeMsg(`Đã đưa vào C8: "${o?.name}" = ${o?.value} điểm.`);
    } catch (e) {
      setOutcomeMsg(e instanceof ApiClientError ? e.message : "Lỗi đưa vào C8");
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!survey) return <Spinner />;

  const publicPath = survey.token ? authedUrl(`/survey/${survey.token}`) : null;
  const publicUrl = publicPath ? `${typeof window !== "undefined" ? window.location.origin : ""}${publicPath}` : null;

  return (
    <div>
      <PageHeader
        title={survey.title}
        subtitle={survey.description ?? "Chi tiết khảo sát"}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={survey.status} />
            {survey.status === "draft" && <button className="btn-primary" onClick={openSurvey}>Mở khảo sát</button>}
          </div>
        }
      />

      {publicUrl && (
        <div className="card mb-4 p-4">
          <p className="label">Link công khai (gửi cho người trả lời)</p>
          <div className="flex items-center gap-2">
            <input className="input font-mono text-xs" readOnly value={publicUrl} onFocus={(e) => e.target.select()} />
            <a className="btn-outline whitespace-nowrap" href={publicPath!} target="_blank" rel="noreferrer">Mở</a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Câu hỏi ({survey.questions.length})</h3>
          <ul className="mb-4 space-y-2">
            {survey.questions.length === 0 && <p className="text-sm text-slate-400">Chưa có câu hỏi</p>}
            {survey.questions.map((q) => (
              <li key={q.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{q.order}. {q.text}</span>
                <span className="badge bg-slate-100 text-slate-500">{q.type}</span>
              </li>
            ))}
          </ul>
          {survey.status === "draft" ? (
            <form onSubmit={addQuestion} className="space-y-2 border-t border-slate-100 pt-3">
              <input className="input" value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Nội dung câu hỏi" required />
              <div className="flex gap-2">
                <select className="input w-40" value={qType} onChange={(e) => setQType(e.target.value)}>
                  <option value="rating">Thang điểm (1–5)</option>
                  <option value="text">Tự luận</option>
                  <option value="choice">Lựa chọn</option>
                </select>
                <button className="btn-primary flex-1">+ Thêm câu hỏi</button>
              </div>
            </form>
          ) : (
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">Khảo sát đã mở — không sửa câu hỏi.</p>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Kết quả ({results?.totalResponses ?? 0} phản hồi)</h3>
            {results && results.totalResponses > 0 && (
              <button className="btn-outline text-xs" onClick={toOutcome}>Đưa vào C8</button>
            )}
          </div>
          {outcomeMsg && <p className="mb-2 text-xs text-emerald-600">{outcomeMsg}</p>}
          {!results || results.perQuestion.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có dữ liệu</p>
          ) : (
            <ul className="space-y-2">
              {results.perQuestion.map((p) => (
                <li key={p.questionId} className="text-sm">
                  <span className="text-slate-700">{p.text}</span>
                  <span className="ml-2 text-slate-500">
                    {p.type === "rating" && p.average != null ? `TB ${p.average} (${p.count})` : `${p.count} trả lời`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
