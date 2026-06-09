"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";

interface Survey { id: string; title: string; status: string; _count: { questions: number; responses: number } }
interface PageData { items: Survey[]; total: number; page: number; totalPages: number }

export default function SurveysPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData>(`/api/surveys?page=${p}&pageSize=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(page); }, [page, load]);

  const columns: Column<Survey>[] = [
    { header: "Khảo sát", cell: (r) => <Link href={`/surveys/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.title}</Link> },
    { header: "Câu hỏi", cell: (r) => r._count.questions },
    { header: "Phản hồi", cell: (r) => r._count.responses },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Khảo sát bên liên quan"
        subtitle="Tạo khảo sát, mở link công khai, thu thập & phân tích phản hồi"
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Tạo khảo sát</button>}
      />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có khảo sát nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
      <CreateSurvey open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(1); setPage(1); }} />
    </div>
  );
}

function CreateSurvey({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      await api.post("/api/surveys", { title, description: description || undefined });
      setTitle(""); setDesc("");
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo khảo sát");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Tạo khảo sát" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Tiêu đề *</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Khảo sát cựu sinh viên 2024" /></div>
        <div><label className="label">Mô tả</label><textarea className="input min-h-16" value={description} onChange={(e) => setDesc(e.target.value)} /></div>
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang lưu…" : "Tạo"}</button>
        </div>
      </form>
    </Modal>
  );
}
