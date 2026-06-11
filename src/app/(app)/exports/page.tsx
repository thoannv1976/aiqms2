"use client";

import { useCallback, useEffect, useState } from "react";
import { api, authedUrl, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";

interface Job { id: string; type: string; status: string; fileName: string | null; createdAt: string }
interface PageData { items: Job[]; total: number; page: number; totalPages: number }
interface Sar { id: string; title: string }
interface Plan { id: string; title: string }
interface Cycle { id: string; name: string }

const TYPES: { value: string; label: string; needsSar?: boolean; needsPlan?: boolean; needsCycle?: boolean }[] = [
  { value: "sar_docx", label: "SAR → Word", needsSar: true },
  { value: "sar_dossier_docx", label: "Hồ sơ SAR đầy đủ (SAR+ma trận+C5–C8+điểm+MC) → Word", needsSar: true },
  { value: "sar_pdf", label: "SAR → PDF", needsSar: true },
  { value: "evidence_xlsx", label: "Danh mục minh chứng → Excel" },
  { value: "evidence_zip", label: "Gói minh chứng → ZIP" },
  { value: "improvement_docx", label: "Kế hoạch cải tiến → Word", needsPlan: true },
  { value: "improvement_xlsx", label: "Tất cả kế hoạch cải tiến → Excel" },
  { value: "cycle_assignment_xlsx", label: "Bảng phân công đợt → Excel", needsCycle: true },
  { value: "cycle_assignment_docx", label: "Bảng phân công đợt → Word", needsCycle: true },
  { value: "team_tasks_xlsx", label: "Công việc TOÀN ĐỘI (mọi người · mọi đợt) → Excel" },
  { value: "team_tasks_docx", label: "Công việc TOÀN ĐỘI (nhóm theo người) → Word" },
];

export default function ExportsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sars, setSars] = useState<Sar[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [type, setType] = useState("evidence_xlsx");
  const [sarId, setSarId] = useState("");
  const [planId, setPlanId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData>(`/api/exports?page=${p}&pageSize=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cần quyền xuất báo cáo");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(page); }, [page, load]);
  useEffect(() => { api.get<{ items: Sar[] }>("/api/sars?pageSize=100").then((d) => setSars(d?.items ?? [])).catch(() => {}); }, []);
  useEffect(() => { api.get<{ items: Plan[] }>("/api/improvement-plans?pageSize=100").then((d) => setPlans(d?.items ?? [])).catch(() => {}); }, []);
  useEffect(() => { api.get<{ items: Cycle[] }>("/api/cycles?pageSize=100").then((d) => setCycles(d?.items ?? [])).catch(() => {}); }, []);

  const typeDef = TYPES.find((t) => t.value === type);
  const needsSar = typeDef?.needsSar;
  const needsPlan = typeDef?.needsPlan;
  const needsCycle = typeDef?.needsCycle;

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await api.post("/api/exports", { type, sarId: needsSar ? sarId : undefined, planId: needsPlan ? planId : undefined, cycleId: needsCycle ? cycleId : undefined });
      await new Promise((r) => setTimeout(r, 400)); // job chạy inline
      await load(1); setPage(1);
    } catch (e2) {
      setError(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo yêu cầu xuất");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Job>[] = [
    { header: "Loại", cell: (r) => TYPES.find((t) => t.value === r.type)?.label ?? r.type },
    { header: "Tệp", cell: (r) => r.fileName ?? "—" },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
    { header: "Thời gian", cell: (r) => new Date(r.createdAt).toLocaleString("vi-VN") },
    {
      header: "",
      cell: (r) => r.status === "done"
        ? <a className="text-indigo-600 hover:underline" href={authedUrl(`/api/exports/${r.id}/download`)}>Tải</a>
        : <span className="text-xs text-slate-400">—</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Xuất báo cáo" subtitle="Tạo yêu cầu xuất (chạy nền) và tải tệp kết quả" />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <form onSubmit={createJob} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Loại báo cáo</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {needsSar && (
          <div className="min-w-56">
            <label className="label">Chọn SAR</label>
            <select className="input" value={sarId} onChange={(e) => setSarId(e.target.value)} required>
              <option value="">-- chọn --</option>
              {sars.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
        )}
        {needsPlan && (
          <div className="min-w-56">
            <label className="label">Chọn kế hoạch cải tiến</label>
            <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
              <option value="">-- chọn --</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        )}
        {needsCycle && (
          <div className="min-w-56">
            <label className="label">Chọn đợt tự đánh giá</label>
            <select className="input" value={cycleId} onChange={(e) => setCycleId(e.target.value)} required>
              <option value="">-- chọn --</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <button className="btn-primary" disabled={busy}>{busy ? "Đang tạo…" : "Tạo & xuất"}</button>
      </form>

      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage="Chưa có yêu cầu xuất nào" />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
    </div>
  );
}
