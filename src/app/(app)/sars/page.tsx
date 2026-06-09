"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";

interface Sar {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  cycle: { name: string } | null;
}
interface PageData { items: Sar[]; total: number; page: number; totalPages: number }

export default function SarsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData>(`/api/sars?page=${p}&pageSize=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const columns: Column<Sar>[] = [
    {
      header: "Tiêu đề",
      cell: (r) => (
        <Link href={`/sars/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.title}</Link>
      ),
    },
    { header: "Đợt", cell: (r) => r.cycle?.name ?? "—" },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
    { header: "Ngày tạo", cell: (r) => new Date(r.createdAt).toLocaleDateString("vi-VN") },
  ];

  return (
    <div>
      <PageHeader
        title="Báo cáo tự đánh giá (SAR)"
        subtitle="Module trung tâm — SAR theo tiêu chí, có AI hỗ trợ"
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Tạo SAR</button>}
      />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có SAR nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}

      <CreateSar open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(1); setPage(1); }} />
    </div>
  );
}

interface Programme { id: string; code: string; name: string; versions: { id: string; version: string }[] }
interface Cycle { id: string; name: string }
interface Standard { id: string; code: string; name: string; activeVersion: { id: string } | null }

function CreateSar({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [title, setTitle] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [cycleMode, setCycleMode] = useState<"existing" | "new">("existing");
  const [cycleId, setCycleId] = useState("");
  const [cycleName, setCycleName] = useState("");
  const [standardVersionId, setStandardVersionId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    api.get<{ items: Programme[] }>("/api/programmes?pageSize=100").then((d) => setProgrammes(d?.items ?? []));
    api.get<{ items: Cycle[] }>("/api/cycles?pageSize=100").then((d) => {
      setCycles(d?.items ?? []);
      setCycleMode((d?.items?.length ?? 0) > 0 ? "existing" : "new");
    });
    api.get<Standard[]>("/api/standards").then((d) => setStandards(d ?? []));
  }, [open]);

  const programme = programmes.find((p) => p.id === programmeId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      let useCycleId = cycleId;
      if (cycleMode === "new") {
        const c = await api.post<Cycle>("/api/cycles", { name: cycleName, standardVersionId });
        useCycleId = c!.id;
      }
      await api.post("/api/sars", { assessmentCycleId: useCycleId, programmeVersionId: versionId, title });
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo SAR");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Tạo báo cáo tự đánh giá" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Tiêu đề SAR</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="SAR ngành CNTT 2024" />
        </div>
        <div>
          <label className="label">Chương trình đào tạo</label>
          <select className="input" value={programmeId} onChange={(e) => { setProgrammeId(e.target.value); setVersionId(""); }} required>
            <option value="">-- chọn --</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </div>
        {programme && (
          <div>
            <label className="label">Phiên bản CTĐT</label>
            <select className="input" value={versionId} onChange={(e) => setVersionId(e.target.value)} required>
              <option value="">-- chọn --</option>
              {programme.versions.map((v) => <option key={v.id} value={v.id}>{v.version}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label">Đợt tự đánh giá</label>
          <div className="mb-2 flex gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" checked={cycleMode === "existing"} onChange={() => setCycleMode("existing")} /> Có sẵn
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={cycleMode === "new"} onChange={() => setCycleMode("new")} /> Tạo đợt mới
            </label>
          </div>
          {cycleMode === "existing" ? (
            <select className="input" value={cycleId} onChange={(e) => setCycleId(e.target.value)} required>
              <option value="">-- chọn đợt --</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <div className="space-y-2">
              <input className="input" value={cycleName} onChange={(e) => setCycleName(e.target.value)} placeholder="Tên đợt (vd: Kiểm định 2024)" required />
              <select className="input" value={standardVersionId} onChange={(e) => setStandardVersionId(e.target.value)} required>
                <option value="">-- chọn bộ tiêu chuẩn --</option>
                {standards.filter((s) => s.activeVersion).map((s) => (
                  <option key={s.id} value={s.activeVersion!.id}>{s.code} · {s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang tạo…" : "Tạo SAR"}</button>
        </div>
      </form>
    </Modal>
  );
}
