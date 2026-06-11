"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { HelpAssistant } from "@/components/HelpAssistant";
import { NotificationBell } from "@/components/NotificationBell";
import { api, ApiClientError } from "@/lib/api/client";

interface Me {
  user: { fullName: string; email: string };
  tenant: { slug: string };
  roles: string[];
  isSuperAdmin: boolean;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api
      .get<Me>("/api/auth/me")
      .then((data) => setMe(data))
      .catch((e) => {
        if (e instanceof ApiClientError && (e.status === 401 || e.status === 404)) {
          router.replace("/login");
        }
      })
      .finally(() => setChecked(true));
  }, [router]);

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">Đang tải…</div>
    );
  }
  if (!me) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        Chuyển tới đăng nhập…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-end gap-4 border-b border-slate-200 bg-white px-6">
          <NotificationBell />
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{me.user.fullName}</p>
            <p className="text-xs text-slate-400">
              {me.isSuperAdmin ? "Super Admin" : me.roles.join(", ")} · {me.tenant.slug}
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {me.user.fullName.charAt(0).toUpperCase()}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
      <HelpAssistant />
    </div>
  );
}
