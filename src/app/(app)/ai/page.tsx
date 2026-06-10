"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatCard, ErrorBox, Spinner } from "@/components/ui";

interface Settings {
  enabled: boolean; provider?: string | null; baseUrl?: string | null; model?: string | null;
  hasApiKey: boolean; dailyTokenLimit: number;
}
interface Usage { totalRequests: number; totalTokens: number; totalCostUsd: number; byModule: { module: string; _count: number }[] }

export default function AiPage() {
  return (
    <div>
      <PageHeader title="AI hỗ trợ" subtitle="Cấu hình AI, theo dõi chi phí, kiểm tra khoảng trống hồ sơ" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SettingsCard />
        <UsageCard />
      </div>
      <div className="mt-4"><GapCheckCard /></div>
    </div>
  );
}

function SettingsCard() {
  const [s, setS] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  async function fetchModels() {
    setLoadingModels(true); setErr(null); setMsg(null);
    try {
      const r = await api.get<{ provider: string; models: string[] }>("/api/ai/models");
      setModels(r?.models ?? []);
      if (!r?.models?.length) setMsg("Key hợp lệ nhưng không có model nào khả dụng.");
      else setMsg(`Đã lấy ${r.models.length} model khả dụng (${r.provider}) — bấm để chọn.`);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi lấy danh sách model");
    } finally { setLoadingModels(false); }
  }

  const load = useCallback(async () => {
    try { setS(await api.get<Settings>("/api/ai/settings")); }
    catch (e) { setErr(e instanceof Error ? e.message : "Cần quyền quản trị"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setMsg(null); setErr(null);
    try {
      const payload: Record<string, unknown> = {
        enabled: s.enabled, provider: s.provider || undefined, baseUrl: s.baseUrl || undefined,
        model: s.model || undefined, dailyTokenLimit: s.dailyTokenLimit,
      };
      if (apiKey) payload.apiKey = apiKey;
      await api.put("/api/ai/settings", payload);
      setApiKey(""); setMsg("Đã lưu cấu hình."); load();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi lưu");
    }
  }

  if (err && !s) return <div className="card p-5"><ErrorBox message={err} /></div>;
  if (!s) return <div className="card p-5"><Spinner /></div>;

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Cấu hình AI (theo trường)</h3>
      <form onSubmit={save} className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          Bật AI cho trường này
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Provider</label>
            <select className="input" value={s.provider ?? "openai"} onChange={(e) => setS({ ...s, provider: e.target.value })}>
              {["openai", "azure", "gemini", "claude", "local"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Model</label>
              <button type="button" className="text-xs text-indigo-600 hover:underline disabled:text-slate-300" disabled={loadingModels} onClick={fetchModels}>
                {loadingModels ? "Đang lấy…" : "Lấy danh sách model khả dụng"}
              </button>
            </div>
            <input className="input" value={s.model ?? ""} onChange={(e) => setS({ ...s, model: e.target.value })} placeholder="gpt-4o-mini" autoComplete="off" />
            <div className="mt-1 flex flex-wrap gap-1">
              {(models.length ? models : ["gpt-4o-mini", "gpt-4o", "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"]).map((m) => (
                <button key={m} type="button"
                  className={`rounded border px-2 py-0.5 text-[11px] hover:bg-slate-50 ${s.model === m ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}
                  onClick={() => setS({ ...s, model: m, baseUrl: m.startsWith("claude") ? "https://api.anthropic.com" : (s.baseUrl || "https://api.openai.com/v1") })}>
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Bấm “Lấy danh sách model” để thấy đúng model tài khoản của bạn được phép dùng (tránh lỗi 404 model not found).</p>
          </div>
        </div>
        <div>
          <label className="label">Base URL</label>
          <input className="input" value={s.baseUrl ?? ""} onChange={(e) => setS({ ...s, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" autoComplete="off" />
          <p className="mt-1 text-xs text-slate-400">OpenAI: <code>https://api.openai.com/v1</code> · Anthropic (Claude, key <code>sk-ant-</code>): <code>https://api.anthropic.com</code></p>
        </div>
        <div><label className="label">API Key {s.hasApiKey && <span className="text-xs text-emerald-600">(đã có — để trống nếu giữ nguyên)</span>}</label>
          <input className="input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={s.hasApiKey ? "••••••" : "nhập khóa (sẽ được mã hóa)"} autoComplete="new-password" />
        </div>
        <div><label className="label">Hạn mức token/ngày</label><input type="number" className="input" value={s.dailyTokenLimit} onChange={(e) => setS({ ...s, dailyTokenLimit: Number(e.target.value) })} /></div>
        {err && <ErrorBox message={err} />}
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        <p className="text-xs text-slate-400">Không nhập khóa ⇒ dùng provider giả lập (mock), không gửi dữ liệu ra ngoài.</p>
        <button className="btn-primary">Lưu cấu hình</button>
      </form>
    </div>
  );
}

function UsageCard() {
  const [u, setU] = useState<Usage | null>(null);
  useEffect(() => { api.get<Usage>("/api/ai/usage").then(setU).catch(() => {}); }, []);
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Chi phí & token AI</h3>
      {!u ? <Spinner /> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Lượt gọi" value={u.totalRequests} />
            <StatCard label="Token" value={u.totalTokens.toLocaleString("vi-VN")} />
            <StatCard label="Chi phí (USD)" value={`$${u.totalCostUsd}`} />
          </div>
          {u.byModule.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm">
              {u.byModule.map((m) => (
                <li key={m.module} className="flex justify-between"><span className="text-slate-600">{m.module}</span><span className="text-slate-500">{m._count} lượt</span></li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

interface Gap { criterion: string; issues: string[] }
interface GapResult { gapCount: number; gaps: Gap[]; aiComment: string | null }

function GapCheckCard() {
  const [sars, setSars] = useState<{ id: string; title: string }[]>([]);
  const [sarId, setSarId] = useState("");
  const [result, setResult] = useState<GapResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.get<{ items: { id: string; title: string }[] }>("/api/sars?pageSize=100").then((d) => setSars(d?.items ?? [])).catch(() => {}); }, []);

  async function run() {
    if (!sarId) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      setResult(await api.get<GapResult>(`/api/ai/gap-check?sarId=${sarId}`));
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi kiểm tra");
    } finally { setBusy(false); }
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Kiểm tra khoảng trống hồ sơ (AI)</h3>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64">
          <label className="label">Chọn SAR</label>
          <select className="input" value={sarId} onChange={(e) => setSarId(e.target.value)}>
            <option value="">-- chọn --</option>
            {sars.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={run} disabled={!sarId || busy}>{busy ? "Đang phân tích…" : "Kiểm tra"}</button>
      </div>
      {err && <div className="mt-3"><ErrorBox message={err} /></div>}
      {result && (
        <div className="mt-4">
          <p className="text-sm text-slate-600">Phát hiện <b>{result.gapCount}</b> tiêu chí còn khoảng trống.</p>
          <ul className="mt-2 space-y-2">
            {result.gaps.map((g, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-slate-800">{g.criterion}</span>
                <span className="ml-2 text-slate-500">{g.issues.join("; ")}</span>
              </li>
            ))}
          </ul>
          {result.aiComment && (
            <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm text-slate-700">
              <span className="badge mb-1 bg-indigo-100 text-indigo-700">AI gợi ý</span>
              <p className="whitespace-pre-wrap">{result.aiComment}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
