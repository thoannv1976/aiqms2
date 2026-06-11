"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { ErrorBox, Spinner } from "@/components/ui";

interface Plo { id: string; code: string; description: string }
interface Col { key: string; label: string }
interface Cell { ploId: string; colKey: string; value: string }
interface MatrixData { dimension: string; label: string; textMode: boolean; dynamicCols: boolean; plos: Plo[]; columns: Col[]; cells: Cell[] }
interface Suggestion { cells: { ploCode: string; colKey: string; value?: string }[]; dimension: string; label: string }

/** Lưới ma trận PLO × <chiều> tổng quát: ô tích "x" hoặc nhập văn bản (measurement). */
export function PloMatrixGrid({ versionId, dimension }: { versionId: string; dimension: string }) {
  const [data, setData] = useState<MatrixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sugg, setSugg] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [extraCols, setExtraCols] = useState<string[]>([]); // cột người dùng tự thêm (chiều động)
  const [newCol, setNewCol] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api.get<MatrixData>(`/api/matrices/plo?versionId=${versionId}&dimension=${dimension}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải ma trận");
    }
  }, [versionId, dimension]);
  useEffect(() => { load(); }, [load]);

  const valueOf = (ploId: string, colKey: string) => data?.cells.find((c) => c.ploId === ploId && c.colKey === colKey)?.value ?? "";

  async function setCell(ploId: string, colKey: string, value: string) {
    setData((d) => d ? { ...d, cells: [...d.cells.filter((c) => !(c.ploId === ploId && c.colKey === colKey)), ...(value ? [{ ploId, colKey, value }] : [])] } : d);
    try {
      await api.post("/api/matrices/plo", { programmeVersionId: versionId, ploId, dimension, colKey, value });
    } catch (e) {
      setNote(e instanceof ApiClientError ? e.message : "Lỗi lưu ô"); load();
    }
  }

  async function aiSuggest() {
    setBusy(true); setNote(null);
    try {
      setSugg(await api.post<Suggestion>(`/api/ai/suggest-plo-matrix?versionId=${versionId}&dimension=${dimension}`, {}));
    } catch (e) {
      setNote(e instanceof ApiClientError ? e.message : "Lỗi gọi AI (cần bật AI + có quyền)");
    } finally { setBusy(false); }
  }
  async function applySuggestion() {
    if (!sugg) return;
    setBusy(true);
    try {
      const r = await api.post<{ applied: number }>("/api/matrices/plo/apply", { versionId, dimension, cells: sugg.cells });
      setNote(`Đã áp dụng ${r?.applied ?? 0} ô.`); setSugg(null); await load();
    } catch (e) {
      setNote(e instanceof ApiClientError ? e.message : "Lỗi áp dụng");
    } finally { setBusy(false); }
  }

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;
  if (data.plos.length === 0) return <div className="card p-6 text-center text-sm text-slate-400">Chưa có PLO. Hãy khai báo/import PLO ở Chương trình đào tạo.</div>;

  // Chiều động: gộp cột từ dữ liệu + cột người dùng vừa thêm (chưa có ô).
  const cols: Col[] = data.dynamicCols
    ? [...data.columns, ...extraCols.filter((k) => !data.columns.some((c) => c.key === k)).map((k) => ({ key: k, label: k }))]
    : data.columns;

  if (cols.length === 0 && !data.dynamicCols) {
    return <div className="card p-6 text-center text-sm text-slate-400">Chưa có cột cho ma trận này (vd PEO–PLO cần có PEO trước).</div>;
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">{data.label}</h3>
        <div className="flex items-center gap-2">
          {data.dynamicCols && (
            <div className="flex items-center gap-1">
              <input className="w-44 rounded border border-slate-200 px-2 py-1 text-xs" placeholder={data.dimension === "job" ? "+ Vị trí việc làm" : "+ Mã PI/KPI"} value={newCol} onChange={(e) => setNewCol(e.target.value)} />
              <button className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50" onClick={() => { const v = newCol.trim(); if (v && !cols.some((c) => c.key === v)) { setExtraCols((s) => [...s, v]); setNewCol(""); } }}>Thêm cột</button>
            </div>
          )}
          <button className="btn-outline" onClick={aiSuggest} disabled={busy}>{busy ? "Đang xử lý…" : "🤖 AI nâng cấp / gợi ý"}</button>
        </div>
      </div>
      {note && <p className="mb-2 text-sm text-amber-600">{note}</p>}

      {sugg && (
        <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm">
          <p className="font-medium text-indigo-700">AI đề xuất {sugg.cells.length} ô — duyệt rồi áp dụng.</p>
          <ul className="my-2 max-h-28 overflow-y-auto text-xs text-slate-600">
            {sugg.cells.slice(0, 40).map((c, i) => <li key={i}>• {c.ploCode} × {c.colKey}{c.value && c.value !== "x" ? `: ${c.value}` : ""}</li>)}
          </ul>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={applySuggestion} disabled={busy}>Áp dụng</button>
            <button className="btn-outline" onClick={() => setSugg(null)}>Bỏ</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-2 py-1 text-left text-xs font-semibold text-slate-500">PLO \ Cột</th>
              {cols.map((c) => <th key={c.key} className="px-2 py-1 text-center text-xs font-medium text-slate-500" title={c.label}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.plos.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="sticky left-0 bg-white px-2 py-1 font-medium text-slate-700" title={p.description}>{p.code}</td>
                {cols.map((c) => {
                  const v = valueOf(p.id, c.key);
                  return (
                    <td key={c.key} className="px-1 py-1 text-center">
                      {data.textMode ? (
                        <input
                          className="w-28 rounded border border-slate-200 px-1 py-0.5 text-xs"
                          defaultValue={v}
                          onBlur={(e) => { if (e.target.value !== v) setCell(p.id, c.key, e.target.value); }}
                        />
                      ) : (
                        <button
                          onClick={() => setCell(p.id, c.key, v ? "" : "x")}
                          className={`h-7 w-7 rounded ${v ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-300 hover:bg-slate-200"}`}
                        >
                          {v ? "✓" : "·"}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
