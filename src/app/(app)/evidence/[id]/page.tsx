"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api, apiUpload, authedUrl, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, Spinner, ErrorBox } from "@/components/ui";

interface EvFile { id: string; fileName: string; storageKey: string; size: number }
interface Evidence {
  id: string; code: string; title: string; description: string | null;
  academicYear: string | null; status: string;
  files: EvFile[];
  criteria: { criterionId: string }[];
  verifications: { id: string; toStatus: string; note: string | null; createdAt: string }[];
}

export default function EvidenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ev, setEv] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dupNote, setDupNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setEv(await api.get<Evidence>(`/api/evidence/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải minh chứng");
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const upload = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true); setDupNote(null);
    try {
      const form = new FormData();
      for (const f of arr) form.append("files", f);
      const res = await apiUpload<{ files: { duplicateOf: string | null }[] }>(`/api/evidence/${id}/files`, form);
      const dups = res?.files.filter((f) => f.duplicateOf).length ?? 0;
      if (dups > 0) setDupNote(`Cảnh báo: ${dups} file trùng nội dung với minh chứng đã có.`);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Lỗi upload");
    } finally {
      setUploading(false);
    }
  }, [id, load]);

  if (error) return <ErrorBox message={error} />;
  if (!ev) return <Spinner />;

  return (
    <div>
      <PageHeader
        title={`${ev.code} · ${ev.title}`}
        subtitle={ev.description ?? "Chi tiết minh chứng"}
        action={<StatusBadge status={ev.status} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Vùng kéo-thả upload */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-10 text-center transition-colors ${
              dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-300"
            }`}
          >
            <p className="text-sm font-medium text-slate-700">Kéo‑thả file vào đây hoặc bấm để chọn</p>
            <p className="text-xs text-slate-400">Hỗ trợ nhiều file · tự lưu qua Storage · chống trùng theo nội dung</p>
            {uploading && <p className="text-xs text-indigo-600">Đang tải lên…</p>}
            <input
              ref={inputRef} type="file" multiple className="hidden"
              onChange={(e) => e.target.files && upload(e.target.files)}
            />
          </div>
          {dupNote && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">{dupNote}</div>}

          {/* Danh sách file */}
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="th">Tên file</th><th className="th">Kích thước</th><th className="th"></th></tr>
              </thead>
              <tbody>
                {ev.files.length === 0 ? (
                  <tr><td className="td text-slate-400" colSpan={3}>Chưa có file</td></tr>
                ) : ev.files.map((f) => (
                  <tr key={f.id}>
                    <td className="td">{f.fileName}</td>
                    <td className="td">{(f.size / 1024).toFixed(1)} KB</td>
                    <td className="td text-right">
                      <a className="text-indigo-600 hover:underline" href={authedUrl(`/api/files/${f.storageKey}`)} target="_blank" rel="noreferrer">Tải</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Xác minh */}
        <VerifyPanel evidenceId={ev.id} current={ev.status} verifications={ev.verifications} onChanged={load} />
      </div>
    </div>
  );
}

function VerifyPanel({
  evidenceId, current, verifications, onChanged,
}: {
  evidenceId: string; current: string;
  verifications: Evidence["verifications"]; onChanged: () => void;
}) {
  const [toStatus, setToStatus] = useState(current);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api.post(`/api/evidence/${evidenceId}/verify`, { toStatus, note: note || undefined });
      setNote("");
      onChanged();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="lg:col-span-1">
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Xác minh minh chứng</h3>
        <label className="label">Trạng thái</label>
        <select className="input mb-3" value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
          <option value="pending">Chờ xác minh</option>
          <option value="valid">Hợp lệ</option>
          <option value="needs_more">Cần bổ sung</option>
          <option value="invalid">Không phù hợp</option>
        </select>
        <label className="label">Ghi chú</label>
        <textarea className="input mb-3 min-h-16" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary w-full" onClick={submit} disabled={saving}>{saving ? "Đang lưu…" : "Cập nhật trạng thái"}</button>

        {verifications.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Lịch sử</p>
            <ul className="space-y-2 text-xs text-slate-500">
              {verifications.map((v) => (
                <li key={v.id} className="flex items-center justify-between">
                  <StatusBadge status={v.toStatus} />
                  <span>{new Date(v.createdAt).toLocaleDateString("vi-VN")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
