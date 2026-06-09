"use client";

import { ResourcePage, type Column } from "@/components/ResourcePage";

interface Staff { id: string; fullName: string; academicRank: string | null; degree: string | null; specialization: string | null; publications: number }

const columns: Column<Staff>[] = [
  { header: "Họ tên", cell: (r) => <span className="font-medium text-slate-900">{r.fullName}</span> },
  { header: "Học hàm", cell: (r) => r.academicRank ?? "—" },
  { header: "Học vị", cell: (r) => r.degree ?? "—" },
  { header: "Chuyên môn", cell: (r) => r.specialization ?? "—" },
  { header: "Công bố", cell: (r) => r.publications },
];

export default function AcademicStaffPage() {
  return (
    <ResourcePage<Staff>
      title="Đội ngũ giảng viên"
      subtitle="Phục vụ tiêu chí C5 — Academic Staff"
      endpoint="/api/academic-staff"
      emptyMessage="Chưa có giảng viên"
      columns={columns}
      fields={[
        { name: "fullName", label: "Họ tên", required: true },
        { name: "academicRank", label: "Học hàm (GS/PGS)" },
        { name: "degree", label: "Học vị (TS/ThS/CN)" },
        { name: "specialization", label: "Chuyên môn" },
        { name: "position", label: "Vị trí" },
        { name: "publications", label: "Số công bố", type: "number" },
      ]}
    />
  );
}
