"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
}
interface PageData { items: Task[]; total: number; page: number; totalPages: number }

export default function TasksPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData>(`/api/tasks?page=${p}&pageSize=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const columns: Column<Task>[] = [
    { header: "Nhiệm vụ", cell: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
    { header: "Ưu tiên", cell: (r) => r.priority },
    { header: "Hạn", cell: (r) => (r.dueDate ? new Date(r.dueDate).toLocaleDateString("vi-VN") : "—") },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Nhiệm vụ" subtitle="Quản lý công việc chuẩn bị kiểm định (Kanban/calendar)" />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có nhiệm vụ nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
    </div>
  );
}
