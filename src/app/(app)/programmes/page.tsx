"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ImportButton } from "@/components/ImportButton";

interface Programme {
  id: string;
  code: string;
  name: string;
  level: string;
  versions: { version: string; status: string }[];
}
interface PageData {
  items: Programme[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ProgrammesPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData>(`/api/programmes?page=${p}&pageSize=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const columns: Column<Programme>[] = [
    { header: "Mã", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { header: "Tên chương trình", cell: (r) => <Link href={`/programmes/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.name}</Link> },
    { header: "Trình độ", cell: (r) => r.level },
    {
      header: "Phiên bản",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.versions.map((v) => (
            <span key={v.version} className="inline-flex items-center gap-1">
              <span className="text-xs text-slate-500">{v.version}</span>
              <StatusBadge status={v.status} />
            </span>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Chương trình đào tạo"
        subtitle="Quản lý CTĐT và các phiên bản"
        action={
          <div className="flex items-center gap-2">
            <ImportButton endpoint="/api/import/programmes" onDone={() => load(1)} />
            <button className="btn-primary" onClick={() => setOpen(true)}>+ Tạo CTĐT</button>
          </div>
        }
      />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có chương trình nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <CreateProgramme open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(page); }} />
    </div>
  );
}

function CreateProgramme({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("bachelor");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await api.post("/api/programmes", { code, name, level, initialVersion: "2024" });
      setCode(""); setName("");
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo CTĐT");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Tạo chương trình đào tạo" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Mã ngành</label>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="7480201" />
        </div>
        <div>
          <label className="label">Tên chương trình</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Công nghệ thông tin" />
        </div>
        <div>
          <label className="label">Trình độ</label>
          <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="bachelor">Đại học</option>
            <option value="master">Thạc sĩ</option>
            <option value="doctor">Tiến sĩ</option>
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
