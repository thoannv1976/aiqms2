"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";

interface Plo { id: string; code: string; description: string }
interface Attainment {
  id: string; ploId: string; cohort: string | null; term: string | null;
  attainmentRate: number; sampleSize: number | null; target: number | null;
  method: string | null; plo: { code: string; description: string };
}

/** Đo lường mức đạt PLO (PLO attainment) + đưa vào C8 — D7. */
export function PloAttainmentPanel({ versionId }: { versionId: string }) {
  const [plos, setPlos] = useState<Plo[]>([]);
  const [rows, setRows] = useState<Attainment[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ ploId: "", cohort: "", term: "", attainmentRate: "", target: "", sampleSize: "", method: "" });

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        api.get<Plo[]>(`/api/plos?versionId=${versionId}`),
        api.get<Attainment[]>(`/api/plo-attainments?versionId=${versionId}`),
      ]);
      setPlos(p ?? []);
      setRows(a ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    }
  }, [versionId]);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post("/api/plo-attainments", {
        programmeVersionId: versionId,
        ploId: form.ploId,
        cohort: form.cohort || undefined,
        term: form.term || undefined,
        attainmentRate: Number(form.attainmentRate),
        target: form.target ? Number(form.target) : undefined,
        sampleSize: form.sampleSize ? Number(form.sampleSize) : undefined,
        method: form.method || undefined,
      });
      setForm({ ploId: "", cohort: "", term: "", attainmentRate: "", target: "", sampleSize: "", method: "" });
      await load();
    } catch (e2) {
      setMsg(e2 instanceof ApiClientError ? e2.message : "Lỗi thêm mức đạt");
    }
  }

  async function remove(id: string) {
    if (!confirm("Xóa bản ghi này?")) return;
    try { await api.delete(`/api/plo-attainments/${id}`); await load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi xóa"); }
  }

  async function toOutcome() {
    try {
      const r = await api.post<{ ploCount: number; created: number; updated: number }>("/api/plo-attainments/to-outcome", { programmeVersionId: versionId });
      setMsg(`Đã đưa ${r?.ploCount ?? 0} PLO vào C8 (mới: ${r?.created ?? 0}, cập nhật: ${r?.updated ?? 0}).`);
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : "Lỗi đưa vào C8");
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Mức đạt chuẩn đầu ra (PLO attainment)</h3>
        <button className="btn-outline text-xs" onClick={toOutcome} disabled={rows.length === 0}>Tổng hợp → C8</button>
      </div>
      {msg && <p className="mb-2 text-xs text-emerald-600">{msg}</p>}

      <form onSubmit={add} className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-7">
        <select className="input col-span-2 sm:col-span-1" value={form.ploId} onChange={(e) => setForm({ ...form, ploId: e.target.value })} required>
          <option value="">PLO</option>
          {plos.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
        </select>
        <input className="input" placeholder="Khóa" value={form.cohort} onChange={(e) => setForm({ ...form, cohort: e.target.value })} />
        <input className="input" placeholder="Kỳ/năm" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
        <input className="input" type="number" min={0} max={100} step="0.1" placeholder="% đạt" value={form.attainmentRate} onChange={(e) => setForm({ ...form, attainmentRate: e.target.value })} required />
        <input className="input" type="number" min={0} max={100} step="0.1" placeholder="Chỉ tiêu %" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
        <input className="input" type="number" min={0} placeholder="Cỡ mẫu" value={form.sampleSize} onChange={(e) => setForm({ ...form, sampleSize: e.target.value })} />
        <button className="btn-primary">Thêm</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có dữ liệu đo lường. Nhập mức đạt theo từng PLO/khóa/kỳ.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr>
            <th className="th">PLO</th><th className="th">Khóa</th><th className="th">Kỳ</th><th className="th">% đạt</th><th className="th">Chỉ tiêu</th><th className="th">Cỡ mẫu</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const below = r.target != null && r.attainmentRate < r.target;
              return (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="td font-medium">{r.plo.code}</td>
                  <td className="td">{r.cohort ?? "—"}</td>
                  <td className="td">{r.term ?? "—"}</td>
                  <td className={`td font-semibold ${below ? "text-rose-600" : "text-emerald-600"}`}>{r.attainmentRate}%</td>
                  <td className="td">{r.target != null ? `${r.target}%` : "—"}</td>
                  <td className="td">{r.sampleSize ?? "—"}</td>
                  <td className="td"><button className="text-rose-600 hover:underline" onClick={() => remove(r.id)}>Xóa</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
