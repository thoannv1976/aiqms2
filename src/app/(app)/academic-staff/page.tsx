"use client";

import { ResourcePage, type Column } from "@/components/ResourcePage";

interface Staff { id: string; fullName: string; academicRank: string | null; degree: string | null; specialization: string | null; publications: number; fte: number | null; employmentType: string | null }

const EMP: Record<string, string> = { full_time: "Toàn thời gian", part_time: "Bán thời gian", visiting: "Thỉnh giảng" };

const columns: Column<Staff>[] = [
  { header: "Họ tên", cell: (r) => <span className="font-medium text-slate-900">{r.fullName}</span> },
  { header: "Học hàm", cell: (r) => r.academicRank ?? "—" },
  { header: "Học vị", cell: (r) => r.degree ?? "—" },
  { header: "Chuyên môn", cell: (r) => r.specialization ?? "—" },
  { header: "Hình thức", cell: (r) => (r.employmentType ? EMP[r.employmentType] ?? r.employmentType : "—") },
  { header: "FTE", cell: (r) => r.fte ?? "—" },
  { header: "Công bố", cell: (r) => r.publications },
];

export default function AcademicStaffPage() {
  return (
    <ResourcePage<Staff>
      title="Đội ngũ giảng viên"
      subtitle="Phục vụ tiêu chí C5 — Academic Staff"
      endpoint="/api/academic-staff"
      importEndpoint="/api/import/institutional"
      importLabel="Nạp Excel C5–C8"
      emptyMessage="Chưa có giảng viên"
      columns={columns}
      fields={[
        { name: "fullName", label: "Họ tên", required: true },
        { name: "academicRank", label: "Học hàm (GS/PGS)" },
        { name: "degree", label: "Học vị (TS/ThS/CN)" },
        { name: "specialization", label: "Chuyên môn" },
        { name: "position", label: "Vị trí" },
        { name: "employmentType", label: "Hình thức tuyển dụng", type: "select", options: Object.entries(EMP).map(([value, label]) => ({ value, label })) },
        { name: "fte", label: "Quy đổi toàn thời gian (FTE)", type: "number", placeholder: "1.0" },
        { name: "gender", label: "Giới tính", type: "select", options: [{ value: "male", label: "Nam" }, { value: "female", label: "Nữ" }, { value: "other", label: "Khác" }] },
        { name: "recruitedYear", label: "Năm tuyển dụng", type: "number" },
        { name: "publications", label: "Số công bố", type: "number" },
        { name: "trainingActivities", label: "Bồi dưỡng/phát triển chuyên môn", type: "textarea" },
      ]}
    />
  );
}
