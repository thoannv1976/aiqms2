"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, ErrorBox } from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ROLES } from "@/lib/rbac/permissions";

const ASSIGNABLE_ROLES = ROLES.filter((r) => r.code !== "super_admin");

export default function UsersPage() {
  const [tab, setTab] = useState<"users" | "org">("users");
  return (
    <div>
      <PageHeader title="Người dùng & đơn vị" subtitle="Quản lý tài khoản, vai trò (RBAC), khoa/bộ môn" />
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {([["users", "Người dùng"], ["org", "Khoa / Bộ môn"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "users" ? <UsersTab /> : <OrgTab />}
    </div>
  );
}

// ─── Người dùng ─────────────────────────────────────────────────────────────
interface User { id: string; email: string; fullName: string; status: string; userRoles: { role: { code: string; name: string } }[] }

function UsersTab() {
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ items: User[] }>("/api/users?pageSize=100");
      setRows(d?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cần quyền quản trị người dùng");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const columns: Column<User>[] = [
    { header: "Họ tên", cell: (r) => <span className="font-medium text-slate-900">{r.fullName}</span> },
    { header: "Email", cell: (r) => <span className="text-slate-500">{r.email}</span> },
    { header: "Vai trò", cell: (r) => r.userRoles.map((ur) => ur.role.name).join(", ") || "—" },
    { header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="btn-primary" onClick={() => setOpen(true)}>+ Tạo người dùng</button>
      </div>
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="Chưa có người dùng" />
      <CreateUser open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load(); }} />
    </div>
  );
}

function CreateUser({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleRole(code: string) {
    setRoles((r) => (r.includes(code) ? r.filter((c) => c !== code) : [...r, code]));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      await api.post("/api/users", { email, fullName, password, roleCodes: roles });
      setEmail(""); setFullName(""); setPassword(""); setRoles([]);
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo người dùng");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Tạo người dùng" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Họ tên *</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
        <div><label className="label">Email *</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="label">Mật khẩu * (≥ 8 ký tự)</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
        <div>
          <label className="label">Vai trò</label>
          <div className="grid grid-cols-1 gap-1 rounded-lg border border-slate-200 p-3">
            {ASSIGNABLE_ROLES.map((r) => (
              <label key={r.code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roles.includes(r.code)} onChange={() => toggleRole(r.code)} />
                <span>{r.name}</span>
              </label>
            ))}
          </div>
        </div>
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang lưu…" : "Tạo"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Khoa / Bộ môn ──────────────────────────────────────────────────────────
interface Faculty { id: string; code: string; name: string }
interface Department { id: string; code: string; name: string; faculty: { code: string; name: string } }

function OrgTab() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openFac, setOpenFac] = useState(false);
  const [openDep, setOpenDep] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, d] = await Promise.all([
        api.get<{ items: Faculty[] }>("/api/faculties?pageSize=100"),
        api.get<{ items: Department[] }>("/api/departments?pageSize=100"),
      ]);
      setFaculties(f?.items ?? []);
      setDepartments(d?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải đơn vị");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {error && <div className="lg:col-span-2"><ErrorBox message={error} /></div>}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Khoa / Viện ({faculties.length})</h3>
          <button className="btn-outline" onClick={() => setOpenFac(true)}>+ Thêm khoa</button>
        </div>
        <ul className="space-y-1">
          {faculties.length === 0 && <p className="text-sm text-slate-400">Chưa có khoa</p>}
          {faculties.map((f) => <li key={f.id} className="text-sm"><span className="font-mono text-xs text-slate-400">{f.code}</span> · {f.name}</li>)}
        </ul>
      </div>
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Bộ môn ({departments.length})</h3>
          <button className="btn-outline" disabled={faculties.length === 0} onClick={() => setOpenDep(true)}>+ Thêm bộ môn</button>
        </div>
        <ul className="space-y-1">
          {departments.length === 0 && <p className="text-sm text-slate-400">Chưa có bộ môn</p>}
          {departments.map((d) => <li key={d.id} className="text-sm"><span className="font-mono text-xs text-slate-400">{d.code}</span> · {d.name} <span className="text-xs text-slate-400">({d.faculty.code})</span></li>)}
        </ul>
      </div>

      <OrgForm open={openFac} title="Thêm khoa" endpoint="/api/faculties"
        fields={[{ name: "code", label: "Mã khoa" }, { name: "name", label: "Tên khoa" }]}
        onClose={() => setOpenFac(false)} onDone={() => { setOpenFac(false); load(); }} />
      <OrgForm open={openDep} title="Thêm bộ môn" endpoint="/api/departments"
        fields={[
          { name: "facultyId", label: "Khoa", type: "select", options: faculties.map((f) => ({ value: f.id, label: `${f.code} · ${f.name}` })) },
          { name: "code", label: "Mã bộ môn" }, { name: "name", label: "Tên bộ môn" },
        ]}
        onClose={() => setOpenDep(false)} onDone={() => { setOpenDep(false); load(); }} />
    </div>
  );
}

function OrgForm({
  open, title, endpoint, fields, onClose, onDone,
}: {
  open: boolean; title: string; endpoint: string;
  fields: { name: string; label: string; type?: "select"; options?: { value: string; label: string }[] }[];
  onClose: () => void; onDone: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post(endpoint, values);
      setValues({});
      onDone();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi lưu");
    }
  }
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="label">{f.label} *</label>
            {f.type === "select" ? (
              <select className="input" required value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                <option value="">-- chọn --</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input className="input" required value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
            )}
          </div>
        ))}
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary">Tạo</button>
        </div>
      </form>
    </Modal>
  );
}
