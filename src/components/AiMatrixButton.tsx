"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { Modal } from "@/components/Modal";
import { ErrorBox } from "@/components/ui";

interface Draft {
  ploCourse: { courseCode: string; ploCode: string; level?: string }[];
  cloPlo: { courseCode: string; cloCode: string; ploCode: string }[];
  ploCount: number; courseCount: number; docCount: number;
}
interface ApplyResult { ploCourse: number; cloPlo: number; errors: string[] }

/** AI tổng hợp ma trận PLO-CLO từ đề án/CTĐT + đề cương đã upload (xem trước -> áp dụng). */
export function AiMatrixButton({ versionId, onApplied }: { versionId: string; onApplied?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);

  function reset() { setDraft(null); setResult(null); setErr(null); }

  async function synthesize() {
    setBusy(true); setErr(null); setResult(null);
    try {
      setDraft(await api.post<Draft>(`/api/ai/synthesize-matrix?versionId=${versionId}`, {}));
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi gọi AI tổng hợp");
    } finally { setBusy(false); }
  }

  async function apply() {
    if (!draft) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.post<ApplyResult>("/api/matrices/apply", {
        versionId, ploCourse: draft.ploCourse, cloPlo: draft.cloPlo,
      });
      setResult(r);
      onApplied?.();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Lỗi áp dụng ma trận");
    } finally { setBusy(false); }
  }

  return (
    <>
      <button
        className="btn-outline disabled:opacity-50"
        disabled={!versionId}
        title={versionId ? "" : "Chọn chương trình & phiên bản trước"}
        onClick={() => { setOpen(true); reset(); }}
      >
        🤖 AI tổng hợp ma trận
      </button>
      <Modal open={open} title="AI tổng hợp ma trận PLO-CLO" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {!draft && !result && (
            <>
              <p className="text-sm text-slate-600">
                AI sẽ đọc <b>đề án mở ngành / CTĐT</b> và các <b>đề cương học phần</b> đã upload (kho Tài liệu)
                để đề xuất mức đóng góp của từng học phần vào PLO (I/R/M) và liên kết CLO–PLO.
                Kết quả là <b>bản nháp</b> để bạn duyệt trước khi ghi vào ma trận.
              </p>
              {err && <ErrorBox message={err} />}
              <div className="flex justify-end gap-2">
                <button className="btn-outline" onClick={() => setOpen(false)}>Đóng</button>
                <button className="btn-primary" onClick={synthesize} disabled={busy}>{busy ? "Đang tổng hợp…" : "Tổng hợp bằng AI"}</button>
              </div>
            </>
          )}

          {draft && !result && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <Stat n={draft.ploCourse.length} label="Ô PLO×HP" />
                <Stat n={draft.cloPlo.length} label="Liên kết CLO–PLO" />
                <Stat n={draft.docCount} label="Tài liệu đọc" />
              </div>
              <p className="text-xs text-slate-400">
                Dựa trên {draft.ploCount} PLO, {draft.courseCount} học phần. Kiểm tra trước khi áp dụng (sẽ ghi đè mức ở các ô tương ứng).
              </p>
              <PreviewList
                title="PLO × Học phần (mức I/R/M)"
                items={draft.ploCourse.map((m) => `${m.courseCode} → ${m.ploCode} (${(m.level ?? "I").toUpperCase()})`)}
              />
              <PreviewList
                title="CLO → PLO"
                items={draft.cloPlo.map((m) => `${m.courseCode}.${m.cloCode} → ${m.ploCode}`)}
              />
              {err && <ErrorBox message={err} />}
              <div className="flex justify-end gap-2">
                <button className="btn-outline" onClick={reset}>Tổng hợp lại</button>
                <button className="btn-primary" onClick={apply} disabled={busy}>{busy ? "Đang áp dụng…" : "Áp dụng vào ma trận"}</button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="font-medium text-emerald-700">Đã ghi vào ma trận.</p>
                <p>Ô PLO×HP: <b>{result.ploCourse}</b> · Liên kết CLO–PLO: <b>{result.cloPlo}</b></p>
                {result.errors.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-amber-600">
                    {result.errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}
                    {result.errors.length > 6 && <li>… và {result.errors.length - 6} dòng khác</li>}
                  </ul>
                )}
              </div>
              <div className="flex justify-end"><button className="btn-primary" onClick={() => setOpen(false)}>Xong</button></div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return <div className="rounded-lg bg-indigo-50 py-2"><div className="text-lg font-semibold text-indigo-700">{n}</div><div className="text-xs text-slate-500">{label}</div></div>;
}
function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="label">{title} ({items.length})</p>
      <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2 text-xs text-slate-600">
        {items.length === 0 && <li className="text-slate-400">— không có —</li>}
        {items.slice(0, 80).map((t, i) => <li key={i}>• {t}</li>)}
        {items.length > 80 && <li className="text-slate-400">… và {items.length - 80} mục khác</li>}
      </ul>
    </div>
  );
}
