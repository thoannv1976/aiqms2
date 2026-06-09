"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";

interface User {
  id: string;
  email: string;
  fullName: string;
  status: string;
  userRoles: { role: { code: string; name: string } }[];
}
interface PageData { items: User[]; total: number; page: number; totalPages: number }

export default function UsersPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData>(`/api/users?page=${p}&pageSize=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bạn cần quyền quản trị người dùng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const columns: Column<User>[] = [
    { header: "Họ tên", cell: (r) => <span className="font-medium text-slate-900">{r.fullName}</span> },
    { header: "Email", cell: (r) => <span className="text-slate-500">{r.email}</span> },
    { header: "Vai trò", cell: (r) => r.userRoles.map((ur) => ur.role.name).join(", ") || "—" },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Người dùng & đơn vị" subtitle="Quản lý tài khoản, vai trò (RBAC)" />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có người dùng nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
    </div>
  );
}
