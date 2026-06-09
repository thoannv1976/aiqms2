import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  open: "bg-emerald-100 text-emerald-700",
  done: "bg-emerald-100 text-emerald-700",
  valid: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  draft: "bg-slate-100 text-slate-600",
  not_started: "bg-slate-100 text-slate-600",
  pending: "bg-amber-100 text-amber-700",
  needs_more: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  drafting: "bg-blue-100 text-blue-700",
  archived: "bg-slate-100 text-slate-500",
  invalid: "bg-rose-100 text-rose-700",
  suspended: "bg-rose-100 text-rose-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="card p-10 text-center text-sm text-slate-400">{message}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>;
}
