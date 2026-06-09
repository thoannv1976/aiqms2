"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";

interface Plan {
  id: string;
  title: string;
  status: string;
  _count: { actions: number; kpis: number };
}
interface PageData { items: Plan[]; total: number; page: number; totalPages: number }

export default function ImprovementPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData>(`/api/improvement-plans?page=${p}&pageSize=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const columns: Column<Plan>[] = [
    { header: "Kế hoạch", cell: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
    { header: "Hành động (PDCA)", cell: (r) => r._count.actions },
    { header: "KPI", cell: (r) => r._count.kpis },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Kế hoạch cải tiến" subtitle="Chu trình PDCA — Plan / Do / Check / Act" />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có kế hoạch nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
    </div>
  );
}
