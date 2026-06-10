"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ImportButton } from "@/components/ImportButton";
import { SyllabusImportButton } from "@/components/SyllabusImportButton";

interface Programme { id: string; code: string; name: string }
interface Course { id: string; code: string; name: string; credits: number; clos: { id: string }[]; programme: Programme | null }
interface PageData { items: Course[]; total: number; page: number; totalPages: number }

export default function CoursesPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [progFilter, setProgFilter] = useState("");

  const load = useCallback(async (p: number, programmeId: string) => {
    setLoading(true);
    try {
      const q = `page=${p}&pageSize=20${programmeId ? `&programmeId=${programmeId}` : ""}`;
      setData(await api.get<PageData>(`/api/courses?${q}`));
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(page, progFilter); }, [page, progFilter, load]);
  useEffect(() => { api.get<{ items: Programme[] }>("/api/programmes?pageSize=100").then((d) => setProgrammes(d?.items ?? [])).catch(() => {}); }, []);

  const columns: Column<Course>[] = [
    { header: "Mã", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { header: "Tên học phần", cell: (r) => <Link href={`/courses/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.name}</Link> },
    {
      header: "Chương trình đào tạo",
      cell: (r) => r.programme
        ? <span className="badge bg-indigo-50 text-indigo-700">{r.programme.code}</span>
        : <span className="text-xs text-slate-400">— chưa gán —</span>,
    },
    { header: "Tín chỉ", cell: (r) => r.credits },
    { header: "CLO", cell: (r) => r.clos.length },
  ];

  return (
    <div>
      <PageHeader title="Đề cương học phần" subtitle="Quản lý học phần theo chương trình đào tạo, CLO và đề cương chi tiết"
        action={
          <div className="flex items-center gap-2">
            <SyllabusImportButton onDone={() => load(1, progFilter)} />
            <ImportButton endpoint="/api/import/courses" onDone={() => load(1, progFilter)} />
            <button className="btn-primary" onClick={() => setOpen(true)}>+ Thêm học phần</button>
          </div>
        } />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="mb-4 flex items-end gap-3">
        <div>
          <label className="label">Lọc theo CTĐT</label>
          <select className="input" value={progFilter} onChange={(e) => { setPage(1); setProgFilter(e.target.value); }}>
            <option value="">Tất cả chương trình</option>
            <option value="none">— Chưa gán CTĐT —</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
      </div>

      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có học phần" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
      <CreateCourse open={open} programmes={programmes} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(1, progFilter); setPage(1); }} />
    </div>
  );
}

function CreateCourse({ open, programmes, onClose, onCreated }: { open: boolean; programmes: Programme[]; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [credits, setCredits] = useState("3");
  const [programmeId, setProgrammeId] = useState("");
  const [err, setErr] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setSaving(true);
    try {
      await api.post("/api/courses", { code, name, credits: Number(credits), programmeId: programmeId || undefined });
      setCode(""); setName(""); setProgrammeId(""); onCreated();
    } catch (e2) { setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo học phần"); }
    finally { setSaving(false); }
  }
  return (
    <Modal open={open} title="Thêm học phần" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Mã học phần *</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="CS101" /></div>
        <div><label className="label">Tên học phần *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div><label className="label">Số tín chỉ</label><input type="number" className="input" value={credits} onChange={(e) => setCredits(e.target.value)} /></div>
        <div>
          <label className="label">Chương trình đào tạo</label>
          <select className="input" value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
            <option value="">— Chưa gán —</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
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
