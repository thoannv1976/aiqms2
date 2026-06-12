"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ImportButton } from "@/components/ImportButton";
import { DocxImportButton } from "@/components/DocxImportButton";

interface Programme {
  id: string;
  code: string;
  name: string;
  level: string;
  versions: { version: string; status: string }[];
  createdAt: string;
  createdByName: string | null;
  courseCount: number;
  ploCount: number;
  extracted: boolean;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData>(`/api/programmes?page=${p}&pageSize=20`));
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const rows = data?.items ?? [];
  function toggle(id: string) { setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAll() { setSelected((s) => (s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))); }

  async function removeProgramme(p: Programme) {
    if (!confirm(`Xóa CTĐT ${p.code} — ${p.name}? (xóa mềm, kèm phiên bản/PLO/học phần gắn theo)`)) return;
    setError(null);
    try { await api.delete(`/api/programmes/${p.id}`); await load(page); }
    catch (e) { setError(e instanceof ApiClientError ? `Không xóa được: ${e.message}` : "Lỗi xóa CTĐT"); }
  }
  async function removeSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Xóa ${selected.size} CTĐT đã chọn? (xóa mềm)`)) return;
    setError(null);
    try { await api.post("/api/programmes/bulk-delete", { ids: [...selected] }); await load(page); }
    catch (e) { setError(e instanceof ApiClientError ? `Không xóa được: ${e.message}` : "Lỗi xóa hàng loạt"); }
  }

  const allChecked = rows.length > 0 && selected.size === rows.length;
  const columns: Column<Programme>[] = [
    { header: <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />,
      cell: (r) => <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /> },
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
    { header: "Học phần", cell: (r) => <span className="text-slate-600">{r.courseCount}</span> },
    { header: "PLO", cell: (r) => <span className="text-slate-600">{r.ploCount}</span> },
    { header: "Số hóa", cell: (r) => r.extracted
      ? <span className="badge bg-emerald-100 text-emerald-700">✓ Đã có HP/PLO</span>
      : <span className="badge bg-slate-100 text-slate-400">Chưa</span> },
    { header: "Ngày tạo", cell: (r) => <span className="whitespace-nowrap text-xs text-slate-500">{new Date(r.createdAt).toLocaleString("vi-VN")}</span> },
    { header: "Người tạo", cell: (r) => <span className="text-xs text-slate-500">{r.createdByName ?? "—"}</span> },
    { header: "", cell: (r) => <button className="text-rose-500 hover:underline" onClick={() => removeProgramme(r)}>Xóa</button> },
  ];

  return (
    <div>
      <PageHeader
        title="Chương trình đào tạo"
        subtitle="Quản lý CTĐT và các phiên bản"
        action={
          <div className="flex items-center gap-2">
            <DocxImportButton onDone={() => load(1)} />
            <ImportButton endpoint="/api/import/programmes" onDone={() => load(1)} />
            <button className="btn-primary" onClick={() => setOpen(true)}>+ Tạo CTĐT</button>
          </div>
        }
      />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      {selected.size > 0 && (
        <div className="mb-3">
          <button className="btn-outline border-rose-300 text-rose-600 hover:bg-rose-50" onClick={removeSelected}>
            🗑 Xóa {selected.size} CTĐT đã chọn
          </button>
        </div>
      )}
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
