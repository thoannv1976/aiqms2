"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api, setTenant, ApiClientError } from "@/lib/api/client";

interface Question { id: string; order: number; text: string; type: string; options?: string[] }
interface Survey { id: string; title: string; description: string | null; questions: Question[] }

export default function PublicSurveyPage() {
  const { token } = useParams<{ token: string }>();
  const search = useSearchParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    // tenant lấy từ ?tenant trên link công khai.
    const t = search.get("tenant");
    if (t) setTenant(t);
    try {
      setSurvey(await api.get<Survey>(`/api/survey/${token}`));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Khảo sát không khả dụng");
    }
  }, [token, search]);
  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/survey/${token}`, { answers });
      setDone(true);
    } catch (e2) {
      setError(e2 instanceof ApiClientError ? e2.message : "Lỗi gửi phản hồi");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return <div className="flex min-h-screen items-center justify-center px-4"><div className="card max-w-md p-6 text-center text-rose-600">{error}</div></div>;
  }
  if (done) {
    return <div className="flex min-h-screen items-center justify-center px-4"><div className="card max-w-md p-8 text-center"><p className="text-2xl">✅</p><p className="mt-2 font-medium text-slate-800">Cảm ơn bạn đã phản hồi!</p></div></div>;
  }
  if (!survey) return <div className="flex min-h-screen items-center justify-center text-slate-400">Đang tải…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="card p-6">
        <h1 className="text-xl font-semibold text-slate-900">{survey.title}</h1>
        {survey.description && <p className="mt-1 text-sm text-slate-500">{survey.description}</p>}
        <form onSubmit={submit} className="mt-6 space-y-5">
          {survey.questions.map((q) => (
            <div key={q.id}>
              <label className="label">{q.order}. {q.text}</label>
              {q.type === "rating" ? (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border text-sm ${answers[q.id] === n ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300"}`}>
                      <input type="radio" className="hidden" name={q.id} onChange={() => setAnswers({ ...answers, [q.id]: n })} />
                      {n}
                    </label>
                  ))}
                </div>
              ) : q.type === "choice" && q.options?.length ? (
                <select className="input" value={String(answers[q.id] ?? "")} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}>
                  <option value="">-- chọn --</option>
                  {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <textarea className="input min-h-16" value={String(answers[q.id] ?? "")} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              )}
            </div>
          ))}
          <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? "Đang gửi…" : "Gửi phản hồi"}</button>
        </form>
      </div>
    </div>
  );
}
