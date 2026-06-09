"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";

interface Cycle { id: string; name: string; year: number | null; status: string; _count: { reports: number } }
interface PageData { items: Cycle[]; total: number; page: number; totalPages: number }
interface Standard { id: string; code: string; name: string; activeVersion: { id: string } | null }

export default function CyclesPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try { setData(await api.get<PageData>(`/api/cycles?page=${p}&pageSize=20`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(page); }, [page, load]);

  const columns: Column<Cycle>[] = [
    { header: "Tên đợt", cell: (r) => <Link href={`/cycles/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.name}</Link> },
    { header: "Năm", cell: (r) => r.year ?? "—" },
    { header: "Số SAR", cell: (r) => r._count.reports },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Đợt tự đánh giá" subtitle="Quản lý các đợt kiểm định và SAR thuộc đợt"
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Tạo đợt</button>} />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có đợt nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
      <CreateCycle open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(1); setPage(1); }} />
    </div>
  );
}

function CreateCycle({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [name, setName] = useState(""); const [year, setYear] = useState(""); const [stdVer, setStdVer] = useState("");
  const [err, setErr] = useState<string | null>(null); const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) api.get<Standard[]>("/api/standards").then((d) => setStandards(d ?? [])).catch(() => {}); }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setSaving(true);
    try {
      await api.post("/api/cycles", { name, year: year ? Number(year) : undefined, standardVersionId: stdVer });
      setName(""); setYear(""); setStdVer(""); onCreated();
    } catch (e2) { setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo đợt"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} title="Tạo đợt tự đánh giá" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Tên đợt *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Kiểm định 2024" /></div>
        <div><label className="label">Năm</label><input type="number" className="input" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" /></div>
        <div>
          <label className="label">Bộ tiêu chuẩn áp dụng *</label>
          <select className="input" value={stdVer} onChange={(e) => setStdVer(e.target.value)} required>
            <option value="">-- chọn --</option>
            {standards.filter((s) => s.activeVersion).map((s) => <option key={s.id} value={s.activeVersion!.id}>{s.code} · {s.name}</option>)}
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
