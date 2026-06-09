"use client";

import { ResourcePage, type Column } from "@/components/ResourcePage";

interface Fac { id: string; name: string; type: string; quantity: number | null; capacity: number | null; location: string | null }

const TYPES: Record<string, string> = {
  classroom: "Phòng học", lab: "Phòng thí nghiệm", library: "Thư viện", it: "Hạ tầng CNTT",
  software: "Phần mềm", equipment: "Thiết bị", space: "Không gian học tập",
};

const columns: Column<Fac>[] = [
  { header: "Tên", cell: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
  { header: "Loại", cell: (r) => TYPES[r.type] ?? r.type },
  { header: "Số lượng", cell: (r) => r.quantity ?? "—" },
  { header: "Sức chứa", cell: (r) => r.capacity ?? "—" },
  { header: "Vị trí", cell: (r) => r.location ?? "—" },
];

export default function FacilitiesPage() {
  return (
    <ResourcePage<Fac>
      title="Cơ sở vật chất & hạ tầng"
      subtitle="Phục vụ tiêu chí C7 — Facilities and Infrastructure"
      endpoint="/api/facilities"
      emptyMessage="Chưa có cơ sở vật chất"
      columns={columns}
      fields={[
        { name: "name", label: "Tên", required: true },
        { name: "type", label: "Loại", type: "select", required: true, options: Object.entries(TYPES).map(([value, label]) => ({ value, label })) },
        { name: "code", label: "Mã (nếu có)" },
        { name: "quantity", label: "Số lượng", type: "number" },
        { name: "capacity", label: "Sức chứa", type: "number" },
        { name: "location", label: "Vị trí" },
      ]}
    />
  );
}
