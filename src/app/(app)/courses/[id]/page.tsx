"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, authedUrl, ApiClientError } from "@/lib/api/client";
import { PageHeader, Spinner, ErrorBox } from "@/components/ui";

interface Clo { id: string; code: string; description: string }
interface Course {
  id: string; code: string; name: string; credits: number;
  description: string | null; prerequisites: string | null; content: string | null;
  teachingMethods: string | null; assessmentMethods: string | null; materials: string | null; rubric: string | null;
  clos: Clo[];
}

type FieldKey = "description" | "prerequisites" | "content" | "teachingMethods" | "assessmentMethods" | "materials" | "rubric";
const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "description", label: "Mô tả học phần" },
  { key: "prerequisites", label: "Học phần tiên quyết" },
  { key: "content", label: "Nội dung giảng dạy" },
  { key: "teachingMethods", label: "Phương pháp giảng dạy" },
  { key: "assessmentMethods", label: "Phương pháp đánh giá" },
  { key: "materials", label: "Tài liệu học tập" },
  { key: "rubric", label: "Rubric" },
];

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<Partial<Course>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const c = await api.get<Course>(`/api/courses/${id}`);
      setCourse(c); if (c) setForm(c);
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi tải học phần"); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const payload: Record<string, unknown> = { credits: form.credits };
      for (const f of FIELDS) payload[f.key] = form[f.key] ?? null;
      await api.patch(`/api/courses/${id}`, payload);
      setMsg("Đã lưu đề cương."); await load();
    } catch (e) { setMsg(e instanceof ApiClientError ? e.message : "Lỗi lưu"); }
    finally { setSaving(false); }
  }

  if (error) return <ErrorBox message={error} />;
  if (!course) return <Spinner />;

  return (
    <div>
      <PageHeader title={`${course.code} · ${course.name}`} subtitle={`${course.credits} tín chỉ · đề cương học phần`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5">
            <div className="space-y-4">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  <textarea className="input min-h-20" value={(form[f.key] as string) ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Đang lưu…" : "Lưu đề cương"}</button>
              {msg && <span className="text-sm text-slate-500">{msg}</span>}
            </div>
          </div>
        </div>
        <div className="space-y-4 lg:col-span-1">
          <CloPanel courseId={course.id} clos={course.clos} onChanged={load} />
          <FilesPanel courseId={course.id} />
        </div>
      </div>
    </div>
  );
}

/** Các file đề cương/tài liệu đã upload gắn với học phần này (kho Tài liệu). */
function FilesPanel({ courseId }: { courseId: string }) {
  const [files, setFiles] = useState<{ id: string; title: string; fileName: string; createdAt: string }[]>([]);
  useEffect(() => {
    api.get<{ items: { id: string; title: string; fileName: string; createdAt: string }[] }>(
      `/api/documents?courseId=${courseId}&pageSize=20`,
    ).then((d) => setFiles(d?.items ?? [])).catch(() => {});
  }, [courseId]);
  if (files.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Tệp đề cương đã upload</h3>
      <ul className="space-y-2">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="line-clamp-1 text-slate-700" title={f.fileName}>{f.title}</span>
            <a className="shrink-0 text-indigo-600 hover:underline" href={authedUrl(`/api/documents/${f.id}/download`)}>Tải</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CloPanel({ courseId, clos, onChanged }: { courseId: string; clos: Clo[]; onChanged: () => void }) {
  const [code, setCode] = useState(""); const [desc, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      await api.post(`/api/courses/${courseId}/clos`, { code, description: desc, order: clos.length + 1 });
      setCode(""); setDesc(""); onChanged();
    } catch (e2) { setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi thêm CLO"); }
  }
  return (
    <div>
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Chuẩn đầu ra học phần (CLO)</h3>
        <ul className="mb-4 space-y-2">
          {clos.length === 0 && <p className="text-sm text-slate-400">Chưa có CLO</p>}
          {clos.map((c) => (
            <li key={c.id} className="flex gap-2 text-sm">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{c.code}</span>
              <span className="text-slate-700">{c.description}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="space-y-2 border-t border-slate-100 pt-3">
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CLO1" required />
          <textarea className="input min-h-16" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Mô tả CLO" required />
          <button className="btn-primary w-full">+ Thêm CLO</button>
          {err && <ErrorBox message={err} />}
        </form>
      </div>
    </div>
  );
}
