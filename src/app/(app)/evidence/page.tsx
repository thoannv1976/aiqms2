"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ExportButton } from "@/components/ExportButton";

interface Evidence {
  id: string;
  code: string;
  title: string;
  type: string | null;
  academicYear: string | null;
  status: string;
  _count: { files: number };
}
interface PageData { items: Evidence[]; total: number; page: number; totalPages: number }

export default function EvidencePage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData>(`/api/evidence?page=${p}&pageSize=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const columns: Column<Evidence>[] = [
    { header: "Mã", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { header: "Tên minh chứng", cell: (r) => <Link href={`/evidence/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.title}</Link> },
    { header: "Năm học", cell: (r) => r.academicYear ?? "—" },
    { header: "Số file", cell: (r) => r._count.files },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Kho minh chứng"
        subtitle="Lưu qua lớp Storage, tự đánh mã, chống trùng"
        action={
          <div className="flex items-center gap-2">
            <ExportButton type="evidence_xlsx" label="Xuất Excel danh mục" />
            <button className="btn-primary" onClick={() => setOpen(true)}>+ Thêm minh chứng</button>
          </div>
        }
      />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có minh chứng nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <CreateEvidence open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(page); }} />
    </div>
  );
}

function CreateEvidence({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [academicYear, setYear] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await api.post("/api/evidence", { title, academicYear: academicYear || undefined, criterionIds: [], requirementIds: [] });
      setTitle(""); setYear("");
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo minh chứng");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Thêm minh chứng" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Tên minh chứng</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Đề cương học phần CS101" />
        </div>
        <div>
          <label className="label">Năm học (tùy chọn)</label>
          <input className="input" value={academicYear} onChange={(e) => setYear(e.target.value)} placeholder="2023-2024" />
        </div>
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang lưu…" : "Tạo"}</button>
        </div>
      </form>
    </Modal>
  );
}
