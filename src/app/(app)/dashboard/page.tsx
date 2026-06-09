"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PageHeader, StatCard, Spinner, ErrorBox } from "@/components/ui";

interface Dashboard {
  programmes: number;
  sars: number;
  sarByStatus: Record<string, number>;
  evidenceByStatus: Record<string, number>;
  tasksOverdue: number;
  openImprovementPlans: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Dashboard>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner />;

  const evidenceValid = data.evidenceByStatus.valid ?? 0;
  const evidenceTotal = Object.values(data.evidenceByStatus).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader title="Tổng quan kiểm định" subtitle="Tiến độ chuẩn bị kiểm định toàn trường" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Chương trình đào tạo" value={data.programmes} />
        <StatCard label="Báo cáo tự đánh giá (SAR)" value={data.sars} />
        <StatCard label="Minh chứng hợp lệ" value={evidenceValid} hint={`trên tổng ${evidenceTotal} minh chứng`} />
        <StatCard label="Nhiệm vụ quá hạn" value={data.tasksOverdue} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">SAR theo trạng thái</h2>
          <StatusBreakdown data={data.sarByStatus} />
        </div>
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Minh chứng theo trạng thái</h2>
          <StatusBreakdown data={data.evidenceByStatus} />
        </div>
      </div>

      <div className="mt-6">
        <StatCard label="Kế hoạch cải tiến đang mở" value={data.openImprovementPlans} />
      </div>
    </div>
  );
}

function StatusBreakdown({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <p className="text-sm text-slate-400">Chưa có dữ liệu</p>;
  return (
    <ul className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{k}</span>
          <span className="font-medium text-slate-900">{v}</span>
        </li>
      ))}
    </ul>
  );
}
