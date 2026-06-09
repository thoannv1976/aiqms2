"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, ErrorBox } from "@/components/ui";
import { DataTable, Pagination, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";

export interface Field {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

interface PageData<T> { items: T[]; total: number; page: number; totalPages: number }

/** Trang tài nguyên dùng chung: danh sách có phân trang + modal tạo (cấu hình bằng fields). */
export function ResourcePage<T extends { id: string }>({
  title,
  subtitle,
  endpoint,
  columns,
  fields,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  endpoint: string;
  columns: Column<T>[];
  fields: Field[];
  emptyMessage?: string;
}) {
  const [data, setData] = useState<PageData<T> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await api.get<PageData<T>>(`${endpoint}?page=${p}&pageSize=20`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { load(page); }, [page, load]);

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Thêm</button>} />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={data?.items ?? []} loading={loading} emptyMessage={emptyMessage} />
      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
      <CreateForm
        title={title} endpoint={endpoint} fields={fields} open={open}
        onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(1); setPage(1); }}
      />
    </div>
  );
}

function CreateForm({
  title, endpoint, fields, open, onClose, onCreated,
}: {
  title: string; endpoint: string; fields: Field[]; open: boolean;
  onClose: () => void; onCreated: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(name: string, v: string) { setValues((s) => ({ ...s, [name]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        const raw = values[f.name];
        if (raw === undefined || raw === "") continue;
        payload[f.name] = f.type === "number" ? Number(raw) : raw;
      }
      await api.post(endpoint, payload);
      setValues({});
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo dữ liệu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={`Thêm — ${title}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="label">{f.label}{f.required && " *"}</label>
            {f.type === "select" ? (
              <select className="input" value={values[f.name] ?? ""} required={f.required} onChange={(e) => set(f.name, e.target.value)}>
                <option value="">-- chọn --</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea className="input min-h-16" value={values[f.name] ?? ""} required={f.required} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
            ) : (
              <input
                className="input" type={f.type === "number" ? "number" : "text"}
                value={values[f.name] ?? ""} required={f.required}
                onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder}
              />
            )}
          </div>
        ))}
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang lưu…" : "Tạo"}</button>
        </div>
      </form>
    </Modal>
  );
}

export type { Column } from "@/components/DataTable";
