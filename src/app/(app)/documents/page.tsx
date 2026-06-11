"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiUpload, authedUrl, ApiClientError } from "@/lib/api/client";
import { PageHeader, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";

interface Doc {
  id: string; title: string; category: string; fileName: string;
  size: number; createdAt: string; version: number;
}
interface PageData { items: Doc[]; total: number; page: number; totalPages: number }

const CATS: Record<string, string> = {
  ctdt_source: "CTĐT gốc", syllabus: "Đề cương học phần", regulation: "Quy chế / quy định", template: "Biểu mẫu", report: "Báo cáo", other: "Khác",
};
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function DocumentsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [cat, setCat] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [versionsOf, setVersionsOf] = useState<Doc | null>(null);

  const load = useCallback(async (p: number, category: string) => {
    setLoading(true);
    try {
      const q = `page=${p}&pageSize=20${category ? `&category=${category}` : ""}`;
      setData(await api.get<PageData>(`/api/documents?${q}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải tài liệu");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(page, cat); }, [page, cat, load]);

  async function remove(id: string) {
    if (!confirm("Xóa tài liệu này?")) return;
    try { await api.delete(`/api/documents/${id}`); await load(page, cat); }
    catch (e) { setError(e instanceof Error ? e.message : "Lỗi xóa"); }
  }

  const columns: Column<Doc>[] = [
    { header: "Tiêu đề", cell: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
    { header: "Nhóm", cell: (r) => CATS[r.category] ?? r.category },
    { header: "Tệp", cell: (r) => <span className="text-slate-500">{r.fileName}</span> },
    { header: "Phiên bản", cell: (r) => <span className="badge bg-slate-100 text-slate-600">v{r.version}</span> },
    { header: "Dung lượng", cell: (r) => fmtSize(r.size) },
    { header: "Ngày tải lên", cell: (r) => new Date(r.createdAt).toLocaleDateString("vi-VN") },
    {
      header: "",
      cell: (r) => (
        <div className="flex gap-3">
          <a className="text-indigo-600 hover:underline" href={authedUrl(`/api/documents/${r.id}/download`)}>Tải</a>
          <button className="text-slate-600 hover:underline" onClick={() => setVersionsOf(r)}>Phiên bản</button>
          <button className="text-rose-500 hover:underline" onClick={() => remove(r.id)}>Xóa</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tài liệu"
        subtitle="Kho lưu trữ & quản lý file upload (CTĐT gốc, quy chế, biểu mẫu, báo cáo…)"
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Tải lên</button>}
      />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="mb-4 flex items-end gap-3">
        <div>
          <label className="label">Lọc theo nhóm</label>
          <select className="input" value={cat} onChange={(e) => { setPage(1); setCat(e.target.value); }}>
            <option value="">Tất cả</option>
            {Object.entries(CATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có tài liệu nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <UploadModal open={open} onClose={() => setOpen(false)} onDone={() => { setOpen(false); setPage(1); load(1, cat); }} />
      {versionsOf && <VersionsModal doc={versionsOf} onClose={() => setVersionsOf(null)} onChanged={() => load(page, cat)} />}
    </div>
  );
}

interface Version { id: string; version: number; fileName: string; size: number; createdAt: string; isCurrent: boolean }

function VersionsModal({ doc, onClose, onChanged }: { doc: Doc; onClose: () => void; onChanged: () => void }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setVersions((await api.get<Version[]>(`/api/documents/${doc.id}/versions`)) ?? []); }
    catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải lịch sử"); }
  }, [doc.id]);
  useEffect(() => { load(); }, [load]);

  async function uploadVersion() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Hãy chọn file"); return; }
    setBusy(true); setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiUpload(`/api/documents/${doc.id}/versions`, form);
      if (fileRef.current) fileRef.current.value = "";
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi tải phiên bản");
    } finally { setBusy(false); }
  }

  return (
    <Modal open title={`Lịch sử phiên bản — ${doc.title}`} onClose={onClose}>
      <div className="space-y-3">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="th">Phiên bản</th><th className="th">Tệp</th><th className="th">Ngày</th><th className="th"></th></tr></thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="td">v{v.version} {v.isCurrent && <span className="badge bg-emerald-100 text-emerald-700">hiện hành</span>}</td>
                <td className="td text-slate-500">{v.fileName}</td>
                <td className="td">{new Date(v.createdAt).toLocaleDateString("vi-VN")}</td>
                <td className="td"><a className="text-indigo-600 hover:underline" href={authedUrl(`/api/documents/${v.id}/download`)}>Tải</a></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-100 pt-3">
          <label className="label">Tải lên phiên bản mới</label>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" className="input" />
            <button className="btn-primary whitespace-nowrap" onClick={uploadVersion} disabled={busy}>{busy ? "Đang tải…" : "Thêm bản mới"}</button>
          </div>
        </div>
        {err && <ErrorBox message={err} />}
      </div>
    </Modal>
  );
}

function UploadModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Hãy chọn file"); return; }
    setBusy(true); setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title || file.name);
      form.append("category", category);
      if (note) form.append("note", note);
      await apiUpload("/api/documents", form);
      setTitle(""); setNote(""); setCategory("other");
      onDone();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi tải lên");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Tải tài liệu lên" onClose={onClose}>
      <div className="space-y-3">
        <div><label className="label">Tiêu đề</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="(để trống = lấy tên file)" /></div>
        <div>
          <label className="label">Nhóm</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div><label className="label">Ghi chú</label><textarea className="input min-h-16" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div><label className="label">Chọn file</label><input ref={fileRef} type="file" className="input" /></div>
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "Đang tải…" : "Tải lên"}</button>
        </div>
      </div>
    </Modal>
  );
}
