"use client";

import type { ReactNode } from "react";
import { Spinner, EmptyState } from "./ui";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  emptyMessage = "Chưa có dữ liệu",
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyMessage?: string;
}) {
  if (loading) return <div className="card"><Spinner /></div>;
  if (rows.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={`th ${c.className ?? ""}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/50">
              {columns.map((c, i) => (
                <td key={i} className={`td ${c.className ?? ""}`}>{c.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return <p className="mt-3 text-xs text-slate-400">{total} bản ghi</p>;
  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-xs text-slate-400">{total} bản ghi · trang {page}/{totalPages}</p>
      <div className="flex gap-2">
        <button className="btn-outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Trước
        </button>
        <button className="btn-outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Sau
        </button>
      </div>
    </div>
  );
}
