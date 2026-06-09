"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setTenant, ApiClientError } from "@/lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [tenant, setTenantField] = useState("demo");
  const [email, setEmail] = useState("admin@demo.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Lưu tenant TRƯỚC để apiClient gắn X-Tenant cho lời gọi login.
      setTenant(tenant.trim().toLowerCase());
      await api.post("/api/auth/login", { email, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">A</div>
          <h1 className="text-xl font-semibold text-slate-900">AIQMS</h1>
          <p className="text-sm text-slate-500">Hệ thống kiểm định CTĐT theo chuẩn AUN-QA</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="label">Mã trường (tenant)</label>
            <input className="input" value={tenant} onChange={(e) => setTenantField(e.target.value)} placeholder="demo" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Mật khẩu</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>

          <p className="text-center text-xs text-slate-400">
            Demo: admin@demo.local / Demo1234!
          </p>
        </form>
      </div>
    </div>
  );
}
