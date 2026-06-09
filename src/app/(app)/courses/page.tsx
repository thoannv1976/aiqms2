"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ImportButton } from "@/components/ImportButton";

interface Course { id: string; code: string; name: string; credits: number; clos: { id: string }[] }
interface PageData { items: Course[]; total: number; page: number; totalPages: number }

export default function CoursesPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try { setData(await api.get<PageData>(`/api/courses?page=${p}&pageSize=20`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(page); }, [page, load]);

  const columns: Column<Course>[] = [
    { header: "Mã", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { header: "Tên học phần", cell: (r) => <Link href={`/courses/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.name}</Link> },
    { header: "Tín chỉ", cell: (r) => r.credits },
    { header: "CLO", cell: (r) => r.clos.length },
  ];

  return (
    <div>
      <PageHeader title="Đề cương học phần" subtitle="Quản lý học phần, CLO và đề cương chi tiết"
        action={
          <div className="flex items-center gap-2">
            <ImportButton endpoint="/api/import/courses" onDone={() => load(1)} />
            <button className="btn-primary" onClick={() => setOpen(true)}>+ Thêm học phần</button>
          </div>
        } />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có học phần" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
      <CreateCourse open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(1); setPage(1); }} />
    </div>
  );
}

function CreateCourse({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [credits, setCredits] = useState("3");
  const [err, setErr] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setSaving(true);
    try {
      await api.post("/api/courses", { code, name, credits: Number(credits) });
      setCode(""); setName(""); onCreated();
    } catch (e2) { setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo học phần"); }
    finally { setSaving(false); }
  }
  return (
    <Modal open={open} title="Thêm học phần" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Mã học phần *</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="CS101" /></div>
        <div><label className="label">Tên học phần *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><label className="label">Số tín chỉ</label><input type="number" className="input" value={credits} onChange={(e) => setCredits(e.target.value)} /></div>
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang lưu…" : "Tạo"}</button>
        </div>
      </form>
    </Modal>
  );
}
