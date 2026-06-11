"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";

interface Noti { id: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string }

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ items: Noti[]; unread: number }>("/api/notifications");
      setItems(r?.items ?? []); setUnread(r?.unread ?? 0);
    } catch { /* bỏ qua */ }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() { await api.post("/api/notifications", { all: true }); load(); }
  async function openOne(n: Noti) {
    if (!n.read) { await api.post("/api/notifications", { id: n.id }); load(); }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen((o) => !o); if (!open) load(); }} className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" title="Thông báo">
        <span className="text-lg">🔔</span>
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-700">Thông báo</span>
            {unread > 0 && <button className="text-xs text-indigo-600 hover:underline" onClick={markAll}>Đánh dấu đã đọc</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">Chưa có thông báo</p>
            ) : items.map((n) => {
              const inner = (
                <div className={`border-b border-slate-50 px-3 py-2 ${n.read ? "" : "bg-indigo-50/40"}`}>
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString("vi-VN")}</p>
                </div>
              );
              return n.link
                ? <Link key={n.id} href={n.link} onClick={() => { openOne(n); setOpen(false); }}>{inner}</Link>
                : <div key={n.id} onClick={() => openOne(n)} className="cursor-pointer">{inner}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
