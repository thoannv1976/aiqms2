"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, ErrorBox, Spinner } from "@/components/ui";
import { ImportButton } from "@/components/ImportButton";
import { AiMatrixButton } from "@/components/AiMatrixButton";

interface Programme { id: string; code: string; name: string; versions: { id: string; version: string }[] }
interface Plo { id: string; code: string; description: string }
interface Clo { id: string; code: string; description: string }
interface Course { id: string; code: string; name: string; clos: Clo[] }
interface MatrixRow { ploId: string; ploCode: string; courses: { courseId: string; code: string; level: string }[] }
interface Warning { type: string; severity: string; message: string }

const nextLevel = (cur?: string) => (!cur ? "I" : cur === "I" ? "R" : cur === "R" ? "M" : "I");

export default function MatricesPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [programmeId, setProgrammeId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ items: Programme[] }>("/api/programmes?pageSize=100")
      .then((d) => setProgrammes(d?.items ?? []))
      .catch((e) => setError(e.message));
  }, []);

  const programme = programmes.find((p) => p.id === programmeId);

  return (
    <div>
      <PageHeader
        title="Ma trận PLO‑CLO & độ phủ"
        subtitle="Liên kết PLO ↔ học phần, CLO ↔ PLO; cảnh báo khoảng trống"
        action={
          <div className="flex items-center gap-2">
            <AiMatrixButton versionId={versionId} onApplied={() => setRefreshKey((k) => k + 1)} />
            <ImportButton label="Nạp ma trận (Excel)" endpoint="/api/import/matrix" onDone={() => setRefreshKey((k) => k + 1)} />
          </div>
        }
      />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Chương trình</label>
          <select className="input" value={programmeId} onChange={(e) => { setProgrammeId(e.target.value); setVersionId(""); }}>
            <option value="">-- chọn --</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </div>
        {programme && (
          <div>
            <label className="label">Phiên bản</label>
            <select className="input" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
              <option value="">-- chọn --</option>
              {programme.versions.map((v) => <option key={v.id} value={v.id}>{v.version}</option>)}
            </select>
          </div>
        )}
      </div>

      {versionId ? <MatrixWorkspace key={`${versionId}:${refreshKey}`} versionId={versionId} /> : (
        <div className="card p-10 text-center text-sm text-slate-400">Chọn chương trình và phiên bản để xem ma trận</div>
      )}
    </div>
  );
}

function MatrixWorkspace({ versionId }: { versionId: string }) {
  const [plos, setPlos] = useState<Plo[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, m, w] = await Promise.all([
        api.get<Plo[]>(`/api/plos?versionId=${versionId}`),
        api.get<{ items: Course[] }>(`/api/courses?pageSize=100`),
        api.get<MatrixRow[]>(`/api/matrices/plo-course?versionId=${versionId}`),
        api.get<Warning[]>(`/api/coverage?versionId=${versionId}`),
      ]);
      setPlos(p ?? []);
      setCourses(c?.items ?? []);
      setMatrix(m ?? []);
      setWarnings(w ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [versionId]);
  useEffect(() => { load(); }, [load]);

  function levelOf(ploId: string, courseId: string): string | undefined {
    return matrix.find((r) => r.ploId === ploId)?.courses.find((c) => c.courseId === courseId)?.level;
  }
  async function toggleCell(ploId: string, courseId: string) {
    const lvl = nextLevel(levelOf(ploId, courseId));
    try {
      await api.post("/api/matrices/plo-course", { ploId, courseId, level: lvl });
      await load();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi cập nhật ma trận");
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {err && <ErrorBox message={err} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AddPlo versionId={versionId} onAdded={load} count={plos.length} />
        <AddCourse onAdded={load} count={courses.length} />
      </div>

      {/* Ma trận PLO × học phần */}
      <div className="card overflow-x-auto p-0">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          Ma trận PLO × Học phần <span className="font-normal text-slate-400">(bấm ô để đặt mức I → R → M)</span>
        </div>
        {plos.length === 0 || courses.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Cần có ít nhất 1 PLO và 1 học phần.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th sticky left-0 bg-slate-50">PLO \ Học phần</th>
                {courses.map((c) => <th key={c.id} className="th text-center" title={c.name}>{c.code}</th>)}
              </tr>
            </thead>
            <tbody>
              {plos.map((plo) => (
                <tr key={plo.id}>
                  <td className="td sticky left-0 bg-white font-medium" title={plo.description}>{plo.code}</td>
                  {courses.map((c) => {
                    const lvl = levelOf(plo.id, c.id);
                    return (
                      <td key={c.id} className="td text-center">
                        <button
                          onClick={() => toggleCell(plo.id, c.id)}
                          className={`h-7 w-7 rounded text-xs font-semibold ${
                            lvl ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-300 hover:bg-slate-200"
                          }`}
                        >
                          {lvl ?? "·"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CLO ↔ PLO */}
      <CloPloSection courses={courses} plos={plos} onChanged={load} />

      {/* Cảnh báo độ phủ */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Cảnh báo độ phủ ({warnings.length})</h3>
        {warnings.length === 0 ? (
          <p className="text-sm text-emerald-600">Không có cảnh báo — độ phủ tốt.</p>
        ) : (
          <ul className="space-y-2">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`badge ${w.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{w.severity}</span>
                <span className="text-slate-700">{w.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddPlo({ versionId, onAdded, count }: { versionId: string; onAdded: () => void; count: number }) {
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/plos", { programmeVersionId: versionId, code, description: desc, order: count + 1 });
    setCode(""); setDesc(""); onAdded();
  }
  return (
    <form onSubmit={add} className="card flex items-end gap-2 p-4">
      <div className="w-24"><label className="label">PLO</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="PLO1" required /></div>
      <div className="flex-1"><label className="label">Mô tả</label><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} required /></div>
      <button className="btn-primary">Thêm PLO</button>
    </form>
  );
}

function AddCourse({ onAdded, count }: { onAdded: () => void; count: number }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/courses", { code, name, credits: 3 });
    setCode(""); setName(""); onAdded();
    void count;
  }
  return (
    <form onSubmit={add} className="card flex items-end gap-2 p-4">
      <div className="w-28"><label className="label">Mã HP</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS101" required /></div>
      <div className="flex-1"><label className="label">Tên học phần</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <button className="btn-primary">Thêm HP</button>
    </form>
  );
}

function CloPloSection({ courses, plos, onChanged }: { courses: Course[]; plos: Plo[]; onChanged: () => void }) {
  const [newClo, setNewClo] = useState<Record<string, string>>({});

  async function addClo(courseId: string, order: number) {
    const code = newClo[courseId];
    if (!code) return;
    await api.post(`/api/courses/${courseId}/clos`, { code, description: code, order });
    setNewClo({ ...newClo, [courseId]: "" });
    onChanged();
  }
  async function mapCloPlo(cloId: string, ploId: string) {
    if (!ploId) return;
    await api.post("/api/matrices/clo-plo", { cloId, ploId });
    onChanged();
  }

  if (courses.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">CLO ↔ PLO (theo học phần)</h3>
      <div className="space-y-4">
        {courses.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-100 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-800">{c.code} · {c.name}</span>
              <span className="flex gap-2">
                <input
                  className="input h-8 w-28 py-1" placeholder="CLO1"
                  value={newClo[c.id] ?? ""} onChange={(e) => setNewClo({ ...newClo, [c.id]: e.target.value })}
                />
                <button className="btn-outline" onClick={() => addClo(c.id, c.clos.length + 1)}>+ CLO</button>
              </span>
            </div>
            {c.clos.length === 0 ? (
              <p className="text-xs text-slate-400">Chưa có CLO</p>
            ) : (
              <ul className="space-y-1">
                {c.clos.map((clo) => (
                  <li key={clo.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{clo.code}</span>
                    <select className="input h-8 w-48 py-1" defaultValue="" onChange={(e) => mapCloPlo(clo.id, e.target.value)}>
                      <option value="">+ liên kết PLO…</option>
                      {plos.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
