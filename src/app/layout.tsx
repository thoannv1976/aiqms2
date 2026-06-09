import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIQMS — Kiểm định CTĐT (AUN-QA)",
  description: "Hệ thống quản lý kiểm định chương trình đào tạo theo chuẩn AUN-QA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-800">{children}</body>
    </html>
  );
}
