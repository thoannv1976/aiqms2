"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiUpload, authedUrl, ApiClientError } from "@/lib/api/client";

interface DocItem { id: string; title: string; fileName: string; createdAt: string }

/** Nộp & xem minh chứng gắn TRỰC TIẾP vào một công việc (task). */
export function TaskEvidenceUpload({ taskId, initialCount = 0, onChanged }: { taskId: string; initialCount?: number; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<DocItem[]>([]);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ items: DocItem[]; total: number }>(`/api/documents?taskId=${taskId}&pageSize=50`);
      setFiles(r?.items ?? []); setCount(r?.total ?? r?.items?.length ?? 0);
    } catch { /* bỏ qua */ }
  }, [taskId]);
  useEffect(() => { if (open) load(); }, [open, load]);

  async function upload() {
    const list = inputRef.current?.files;
    if (!list || list.length === 0) return;
    setBusy(true); setNote(null);
    let ok = 0;
    try {
      for (const f of Array.from(list)) {
        const form = new FormData();
        form.append("file", f);
        form.append("title", f.name);
        form.append("category", "task_evidence");
        form.append("taskId", taskId);
        await apiUpload("/api/documents", form);
        ok++;
      }
      if (inputRef.current) inputRef.current.value = "";
      setNote(`Đã nộp ${ok} minh chứng.`);
      await load(); onChanged?.();
    } catch (e) {
      setNote(e instanceof ApiClientError ? e.message : "Lỗi nộp minh chứng");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Gỡ minh chứng này?")) return;
    try { await api.delete(`/api/documents/${id}`); await load(); onChanged?.(); } catch { /* bỏ qua */ }
  }

  async function toEvidence(id: string) {
    setBusy(true); setNote(null);
    try {
      const r = await api.post<{ code: string }>(`/api/documents/${id}/to-evidence`, {});
      setNote(`Đã đưa vào hồ sơ minh chứng: ${r?.code ?? ""}`);
    } catch (e) {
      setNote(e instanceof ApiClientError ? e.message : "Lỗi đưa vào hồ sơ");
    } finally { setBusy(false); }
  }

  return (
    <div className="text-xs">
      <button className="btn-outline h-9 py-0 text-xs leading-9" onClick={() => setOpen((o) => !o)}>
        📎 Minh chứng{count > 0 ? ` (${count})` : ""}
      </button>
      {open && (
        <div className="mt-2 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex items-center gap-1">
            <input ref={inputRef} type="file" multiple className="input h-8 flex-1 py-0 text-xs" />
            <button className="btn-primary h-8 py-0 text-xs" onClick={upload} disabled={busy}>{busy ? "…" : "Nộp"}</button>
          </div>
          {note && <p className="mt-1 text-emerald-600">{note}</p>}
          {files.length > 0 && (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <a className="line-clamp-1 flex-1 text-indigo-600 hover:underline" href={authedUrl(`/api/documents/${f.id}/download`)} title={f.fileName}>{f.fileName}</a>
                  <button className="shrink-0 text-emerald-600 hover:underline disabled:text-slate-300" disabled={busy} onClick={() => toEvidence(f.id)} title="Tạo minh chứng MC-XXXX gắn tiêu chí">→ Hồ sơ</button>
                  <button className="shrink-0 text-rose-500 hover:underline" onClick={() => remove(f.id)}>Gỡ</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
