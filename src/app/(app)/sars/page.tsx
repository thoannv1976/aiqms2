"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";

interface Sar {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  cycle: { name: string } | null;
}
interface PageData { items: Sar[]; total: number; page: number; totalPages: number }

export default function SarsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData>(`/api/sars?page=${p}&pageSize=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const columns: Column<Sar>[] = [
    { header: "Tiêu đề", cell: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
    { header: "Đợt", cell: (r) => r.cycle?.name ?? "—" },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
    { header: "Ngày tạo", cell: (r) => new Date(r.createdAt).toLocaleDateString("vi-VN") },
  ];

  return (
    <div>
      <PageHeader title="Báo cáo tự đánh giá (SAR)" subtitle="Module trung tâm — SAR theo 8 tiêu chí AUN-QA" />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có SAR nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
    </div>
  );
}
