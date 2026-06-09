"use client";

import { ResourcePage, type Column } from "@/components/ResourcePage";

interface Svc { id: string; category: string; title: string; academicYear: string | null; metricValue: number | null }

const CATS: Record<string, string> = {
  admission: "Tuyển sinh", advising: "Cố vấn học tập", scholarship: "Học bổng",
  internship: "Thực tập", career: "Việc làm", extracurricular: "Ngoại khóa", support: "Hỗ trợ khác",
};

const columns: Column<Svc>[] = [
  { header: "Nhóm", cell: (r) => CATS[r.category] ?? r.category },
  { header: "Nội dung", cell: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
  { header: "Năm học", cell: (r) => r.academicYear ?? "—" },
  { header: "Chỉ số", cell: (r) => (r.metricValue ?? "—") },
];

export default function StudentsPage() {
  return (
    <ResourcePage<Svc>
      title="Người học & dịch vụ hỗ trợ"
      subtitle="Phục vụ tiêu chí C6 — Student Support Services"
      endpoint="/api/student-services"
      importEndpoint="/api/import/institutional"
      importLabel="Nạp Excel C5–C8"
      emptyMessage="Chưa có dữ liệu hỗ trợ người học"
      columns={columns}
      fields={[
        { name: "category", label: "Nhóm dịch vụ", type: "select", required: true, options: Object.entries(CATS).map(([value, label]) => ({ value, label })) },
        { name: "title", label: "Nội dung", required: true },
        { name: "description", label: "Mô tả", type: "textarea" },
        { name: "academicYear", label: "Năm học", placeholder: "2023-2024" },
        { name: "targetGroup", label: "Đối tượng phục vụ", placeholder: "Sinh viên năm 1" },
        { name: "responsibleUnit", label: "Đơn vị phụ trách" },
        { name: "beneficiaries", label: "Số người hưởng lợi", type: "number" },
        { name: "metricValue", label: "Chỉ số (nếu có)", type: "number" },
      ]}
    />
  );
}
