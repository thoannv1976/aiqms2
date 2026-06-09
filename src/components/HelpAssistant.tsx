"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { api, ApiClientError } from "@/lib/api/client";
import { resolveGuide } from "@/lib/help/screens";

export function HelpAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const guide = resolveGuide(pathname);

  async function ask() {
    if (!q.trim()) return;
    setBusy(true); setNote(null); setAnswer(null);
    try {
      const r = await api.post<{ answer: string }>("/api/ai/assistant", { screen: pathname, question: q });
      setAnswer(r?.answer ?? "");
    } catch (e) {
      setNote(
        e instanceof ApiClientError && e.status === 403
          ? "Trợ lý AI đang tắt hoặc bạn chưa có quyền dùng AI. Bạn vẫn có thể xem hướng dẫn ở trên."
          : e instanceof Error ? e.message : "Lỗi gọi AI",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Nút trợ giúp nổi */}
      <button
        onClick={() => setOpen(true)}
        title="Hướng dẫn màn hình này"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white shadow-lg hover:bg-indigo-700"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={() => setOpen(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-indigo-600 text-xs font-bold text-white">AI</span>
                <h2 className="text-sm font-semibold text-slate-800">Trợ lý hướng dẫn</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {guide ? (
                <>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{guide.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{guide.purpose}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Việc cần làm tại màn hình này</p>
                    <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
                      {guide.steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                  {guide.tip && <p className="text-sm text-amber-700"><b>Lưu ý:</b> {guide.tip}</p>}
                  {guide.role && <p className="text-xs text-slate-400">Thường dùng bởi: {guide.role}</p>}
                </>
              ) : (
                <p className="text-sm text-slate-500">Chưa có hướng dẫn cho màn hình này.</p>
              )}

              {/* Hỏi AI */}
              <div className="border-t border-slate-200 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Hỏi AI về màn hình này</p>
                <textarea
                  className="input min-h-16" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Ví dụ: Làm sao để nhập điểm tự đánh giá cho từng tiêu chí?"
                />
                <button className="btn-primary mt-2 w-full" onClick={ask} disabled={busy}>
                  {busy ? "Đang hỏi AI…" : "✨ Hỏi AI"}
                </button>
                {note && <p className="mt-2 text-sm text-amber-600">{note}</p>}
                {answer && (
                  <div className="mt-3 whitespace-pre-wrap rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm text-slate-700">
                    {answer}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
