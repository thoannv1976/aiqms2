"use client";

import { ResourcePage, type Column } from "@/components/ResourcePage";

interface Metric { id: string; name: string; category: string; academicYear: string | null; value: number | null; unit: string | null }

const CATS: Record<string, string> = {
  graduation: "Tốt nghiệp", employment: "Việc làm", satisfaction: "Hài lòng",
  plo_attainment: "Đạt PLO", research: "Nghiên cứu", other: "Khác",
};

const columns: Column<Metric>[] = [
  { header: "Chỉ số", cell: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
  { header: "Nhóm", cell: (r) => CATS[r.category] ?? r.category },
  { header: "Năm học", cell: (r) => r.academicYear ?? "—" },
  { header: "Giá trị", cell: (r) => (r.value != null ? `${r.value}${r.unit ? " " + r.unit : ""}` : "—") },
];

export default function OutcomesPage() {
  return (
    <ResourcePage<Metric>
      title="Kết quả đầu ra"
      subtitle="Phục vụ tiêu chí C8 — Output and Outcomes"
      endpoint="/api/outcomes"
      emptyMessage="Chưa có chỉ số kết quả đầu ra"
      columns={columns}
      fields={[
        { name: "name", label: "Tên chỉ số", required: true, placeholder: "Tỷ lệ có việc làm sau 12 tháng" },
        { name: "category", label: "Nhóm", type: "select", required: true, options: Object.entries(CATS).map(([value, label]) => ({ value, label })) },
        { name: "academicYear", label: "Năm học", placeholder: "2023-2024" },
        { name: "value", label: "Giá trị", type: "number" },
        { name: "unit", label: "Đơn vị", placeholder: "%" },
      ]}
    />
  );
}
