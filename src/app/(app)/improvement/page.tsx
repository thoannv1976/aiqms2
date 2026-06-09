"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";

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
  const [open, setOpen] = useState(false);

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
    { header: "Kế hoạch", cell: (r) => <Link href={`/improvement/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.title}</Link> },
    { header: "Hành động (PDCA)", cell: (r) => r._count.actions },
    { header: "KPI", cell: (r) => r._count.kpis },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Kế hoạch cải tiến"
        subtitle="Chu trình PDCA — Plan / Do / Check / Act"
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Tạo kế hoạch</button>}
      />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có kế hoạch nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
      <CreatePlan open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(1); setPage(1); }} />
    </div>
  );
}

function CreatePlan({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [issue, setIssue] = useState("");
  const [cause, setCause] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      await api.post("/api/improvement-plans", { title, issue: issue || undefined, cause: cause || undefined });
      setTitle(""); setIssue(""); setCause("");
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo kế hoạch");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Tạo kế hoạch cải tiến" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Tiêu đề *</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Cải tiến phương pháp đánh giá" /></div>
        <div><label className="label">Vấn đề cần cải tiến</label><textarea className="input min-h-16" value={issue} onChange={(e) => setIssue(e.target.value)} /></div>
        <div><label className="label">Nguyên nhân</label><textarea className="input min-h-16" value={cause} onChange={(e) => setCause(e.target.value)} /></div>
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang lưu…" : "Tạo"}</button>
        </div>
      </form>
    </Modal>
  );
}
