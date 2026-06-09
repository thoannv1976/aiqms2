"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PageHeader, Spinner, ErrorBox, StatusBadge } from "@/components/ui";

interface Standard {
  id: string;
  code: string;
  name: string;
  level: string;
  activeVersion: { version: string } | null;
}
interface Detail {
  criteria: { id: string; code: string; titleVi: string; requirements: { id: string }[] }[];
  ratingScale: { level: number; labelVi: string }[];
}

export default function StandardsPage() {
  const [list, setList] = useState<Standard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    api.get<Standard[]>("/api/standards").then(setList).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    api.get<Detail>(`/api/standards/${selected}`).then(setDetail).catch(() => {});
  }, [selected]);

  if (error) return <ErrorBox message={error} />;
  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader title="Bộ tiêu chuẩn kiểm định" subtitle="Cấu hình data-driven — thêm chuẩn mới bằng nạp dữ liệu" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          {list.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              className={`card w-full p-4 text-left transition-colors ${selected === s.id ? "ring-2 ring-indigo-400" : "hover:bg-slate-50"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{s.code}</span>
                {s.activeVersion && <StatusBadge status={`v${s.activeVersion.version}`} />}
              </div>
              <p className="mt-1 text-sm text-slate-500">{s.name}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="card p-10 text-center text-sm text-slate-400">Chọn một bộ tiêu chuẩn để xem tiêu chí</div>
          ) : !detail ? (
            <Spinner />
          ) : (
            <div className="space-y-4">
              <div className="card p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Tiêu chí ({detail.criteria.length})</h2>
                <ul className="space-y-2">
                  {detail.criteria.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{c.code}</span>
                      <span className="text-slate-700">
                        {c.titleVi}
                        <span className="ml-2 text-xs text-slate-400">{c.requirements.length} yêu cầu</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Thang đánh giá ({detail.ratingScale.length} mức)</h2>
                <ul className="space-y-1">
                  {detail.ratingScale.map((r) => (
                    <li key={r.level} className="text-sm text-slate-600">
                      <span className="font-medium text-slate-900">Mức {r.level}:</span> {r.labelVi}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
