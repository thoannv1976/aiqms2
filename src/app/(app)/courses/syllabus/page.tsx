"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { SyllabusRepoPanel } from "@/components/SyllabusRepoPanel";

export default function SyllabusRepoPage() {
  return (
    <div>
      <PageHeader
        title="Kho đề cương (file upload)"
        subtitle="Kho chứa FILE đề cương (.docx/.pdf) đã upload. Bấm “Trích xuất” để tạo/cập nhật HỌC PHẦN + CLO ở mục “Học phần & đề cương”. (Đây KHÔNG phải danh sách học phần.)"
        action={<Link href="/courses" className="btn-outline">← Học phần & đề cương</Link>}
      />
      <SyllabusRepoPanel />
    </div>
  );
}
