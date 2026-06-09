"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

interface NavItem {
  href: string;
  label: string;
  ready?: boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Tổng quan",
    items: [{ href: "/dashboard", label: "Dashboard", ready: true }],
  },
  {
    section: "Kiểm định",
    items: [
      { href: "/programmes", label: "Chương trình đào tạo", ready: true },
      { href: "/standards", label: "Bộ tiêu chuẩn", ready: true },
      { href: "/sars", label: "Báo cáo tự đánh giá (SAR)", ready: true },
      { href: "/evidence", label: "Minh chứng", ready: true },
    ],
  },
  {
    section: "Theo dõi & cải tiến",
    items: [
      { href: "/tasks", label: "Nhiệm vụ", ready: true },
      { href: "/improvement", label: "Kế hoạch cải tiến", ready: true },
      { href: "/surveys", label: "Khảo sát bên liên quan", ready: false },
    ],
  },
  {
    section: "Quản trị",
    items: [
      { href: "/users", label: "Người dùng & đơn vị", ready: true },
      { href: "/ai", label: "AI hỗ trợ", ready: false },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await api.post("/api/auth/logout");
    } catch {
      /* bỏ qua lỗi mạng khi đăng xuất */
    }
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">A</div>
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-900">AIQMS</p>
          <p className="text-[11px] leading-tight text-slate-400">Kiểm định AUN-QA</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.section}</p>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              if (!item.ready) {
                return (
                  <span key={item.href} className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-300">
                    {item.label}
                    <span className="text-[10px]">sắp có</span>
                  </span>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <button onClick={logout} className="btn-ghost w-full justify-start">Đăng xuất</button>
      </div>
    </aside>
  );
}
