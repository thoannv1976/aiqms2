"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PageHeader, ErrorBox, Spinner } from "@/components/ui";

interface Row {
  id: string; name: string; categoryLabel: string; academicYear: string | null;
  value: number | null; unit: string | null; target: number | null; benchmark: number | null;
  gapToBenchmark: number | null; status: "above" | "on_par" | "below" | "unknown";
}
interface Report { summary: { total: number; benchmarked: number; above: number; below: number; onPar: number }; rows: Row[] }

const STATUS: Record<Row["status"], { label: string; cls: string }> = {
  above: { label: "Vượt mốc", cls: "text-emerald-600" },
  on_par: { label: "Ngang mốc", cls: "text-slate-600" },
  below: { label: "Dưới mốc", cls: "text-rose-600" },
  unknown: { label: "Chưa có mốc", cls: "text-slate-400" },
};

export default function BenchmarkingPage() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Report>("/api/benchmarking").then(setData).catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải"));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;

  const fmt = (v: number | null, unit?: string | null) => (v != null ? `${v}${unit ? " " + unit : ""}` : "—");

  return (
    <div>
      <PageHeader
        title="Đối sánh (benchmarking)"
        subtitle="So sánh chỉ số kết quả đầu ra (C8) với mốc tham chiếu và chỉ tiêu. Nhập mốc đối sánh ở mục Kết quả đầu ra."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-2xl font-semibold">{data.summary.benchmarked}/{data.summary.total}</p><p className="text-xs text-slate-500">Chỉ số có mốc đối sánh</p></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-2xl font-semibold text-emerald-600">{data.summary.above}</p><p className="text-xs text-slate-500">Vượt mốc</p></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-2xl font-semibold text-slate-600">{data.summary.onPar}</p><p className="text-xs text-slate-500">Ngang mốc</p></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-2xl font-semibold text-rose-600">{data.summary.below}</p><p className="text-xs text-slate-500">Dưới mốc</p></div>
      </div>

      <div className="card overflow-hidden">
        {data.rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Chưa có chỉ số kết quả đầu ra. Thêm ở mục “Kết quả đầu ra”.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <th className="th">Chỉ số</th><th className="th">Nhóm</th><th className="th">Năm</th>
              <th className="th">Giá trị</th><th className="th">Chỉ tiêu</th><th className="th">Mốc đối sánh</th>
              <th className="th">Chênh lệch</th><th className="th">Trạng thái</th>
            </tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="td font-medium text-slate-900">{r.name}</td>
                  <td className="td">{r.categoryLabel}</td>
                  <td className="td">{r.academicYear ?? "—"}</td>
                  <td className="td">{fmt(r.value, r.unit)}</td>
                  <td className="td">{fmt(r.target)}</td>
                  <td className="td">{fmt(r.benchmark)}</td>
                  <td className={`td ${r.gapToBenchmark != null && r.gapToBenchmark < 0 ? "text-rose-600" : "text-slate-700"}`}>
                    {r.gapToBenchmark != null ? (r.gapToBenchmark > 0 ? `+${r.gapToBenchmark}` : r.gapToBenchmark) : "—"}
                  </td>
                  <td className={`td font-medium ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
