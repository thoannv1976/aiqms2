"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api/client";
import { PageHeader, StatusBadge, Spinner, ErrorBox } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { ProgrammeOverviewPanel } from "@/components/ProgrammeOverviewPanel";

interface Outcome { id: string; code: string; description: string }
interface Version { id: string; version: string; status: string; year: number | null; peos: Outcome[]; plos: Outcome[] }
interface Programme { id: string; code: string; name: string; nameEn: string | null; level: string; totalCredits: number | null; versions: Version[] }

const VERSION_NEXT: Record<string, string[]> = { draft: ["active", "archived"], active: ["archived"], archived: [] };

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [prog, setProg] = useState<Programme | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selVer, setSelVer] = useState<string | null>(null);
  const [openVer, setOpenVer] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await api.get<Programme>(`/api/programmes/${id}`);
      setProg(p);
      setSelVer((cur) => cur ?? p?.versions[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải chương trình");
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function changeVersionStatus(versionId: string, to: string) {
    try {
      await api.post(`/api/programme-versions/${versionId}/status`, { to });
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Lỗi đổi trạng thái");
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!prog) return <Spinner />;

  const version = prog.versions.find((v) => v.id === selVer) ?? null;

  return (
    <div>
      <PageHeader
        title={`${prog.code} · ${prog.name}`}
        subtitle={`${prog.level}${prog.totalCredits ? ` · ${prog.totalCredits} tín chỉ` : ""}`}
        action={<button className="btn-primary" onClick={() => setOpenVer(true)}>+ Tạo phiên bản</button>}
      />

      {/* Chọn phiên bản */}
      <div className="mb-4 flex flex-wrap gap-2">
        {prog.versions.map((v) => (
          <button key={v.id} onClick={() => setSelVer(v.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${selVer === v.id ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            v{v.version} <StatusBadge status={v.status} />
          </button>
        ))}
      </div>

      {version ? (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center justify-between gap-2 p-4">
            <span className="text-sm text-slate-600">Phiên bản <b>v{version.version}</b> — trạng thái:</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={version.status} />
              {(VERSION_NEXT[version.status] ?? []).map((s) => (
                <button key={s} className="btn-outline" onClick={() => changeVersionStatus(version.id, s)}>→ {s}</button>
              ))}
              <Link className="btn-outline" href={`/matrices`}>Ma trận PLO‑CLO</Link>
            </div>
          </div>

          <ProgrammeOverviewPanel programmeId={prog.id} versionId={version.id} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OutcomePanel
              title="Mục tiêu CTĐT (PEO)" endpoint="/api/peos" code="PEO"
              versionId={version.id} items={version.peos} onChanged={load}
            />
            <OutcomePanel
              title="Chuẩn đầu ra (PLO)" endpoint="/api/plos" code="PLO"
              versionId={version.id} items={version.plos} onChanged={load}
            />
          </div>
        </div>
      ) : (
        <div className="card p-10 text-center text-sm text-slate-400">Chương trình chưa có phiên bản nào.</div>
      )}

      <CreateVersion programmeId={prog.id} open={openVer} onClose={() => setOpenVer(false)} onCreated={() => { setOpenVer(false); load(); }} />
    </div>
  );
}

function OutcomePanel({
  title, endpoint, code, versionId, items, onChanged,
}: {
  title: string; endpoint: string; code: string; versionId: string; items: Outcome[]; onChanged: () => void;
}) {
  const [c, setC] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post(endpoint, { programmeVersionId: versionId, code: c, description: desc, order: items.length + 1 });
      setC(""); setDesc("");
      onChanged();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi thêm");
    }
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title} ({items.length})</h3>
      <ul className="mb-4 space-y-2">
        {items.length === 0 && <p className="text-sm text-slate-400">Chưa có</p>}
        {items.map((o) => (
          <li key={o.id} className="flex gap-2 text-sm">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{o.code}</span>
            <span className="text-slate-700">{o.description}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="space-y-2 border-t border-slate-100 pt-3">
        <div className="flex gap-2">
          <input className="input w-24" value={c} onChange={(e) => setC(e.target.value)} placeholder={`${code}1`} required />
          <input className="input flex-1" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Mô tả" required />
        </div>
        <button className="btn-primary w-full">+ Thêm {code}</button>
        {err && <ErrorBox message={err} />}
      </form>
    </div>
  );
}

function CreateVersion({ programmeId, open, onClose, onCreated }: { programmeId: string; open: boolean; onClose: () => void; onCreated: () => void }) {
  const [version, setVersion] = useState("");
  const [year, setYear] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post(`/api/programmes/${programmeId}/versions`, { version, year: year ? Number(year) : undefined });
      setVersion(""); setYear("");
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof ApiClientError ? e2.message : "Lỗi tạo phiên bản");
    }
  }

  return (
    <Modal open={open} title="Tạo phiên bản CTĐT" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Phiên bản *</label><input className="input" value={version} onChange={(e) => setVersion(e.target.value)} required placeholder="2025" /></div>
        <div><label className="label">Năm</label><input type="number" className="input" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025" /></div>
        {err && <ErrorBox message={err} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn-primary">Tạo</button>
        </div>
      </form>
    </Modal>
  );
}
