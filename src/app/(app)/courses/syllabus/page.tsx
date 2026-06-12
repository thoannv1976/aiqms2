"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { SyllabusRepoPanel } from "@/components/SyllabusRepoPanel";

export default function SyllabusRepoPage() {
  return (
    <div>
      <PageHeader
        title="Kho đề cương học phần"
        subtitle="Tải lên nhiều · trích xuất AI · quản lý theo chương trình đào tạo"
        action={<Link href="/courses" className="btn-outline">← Về Đề cương học phần</Link>}
      />
      <SyllabusRepoPanel />
    </div>
  );
}
