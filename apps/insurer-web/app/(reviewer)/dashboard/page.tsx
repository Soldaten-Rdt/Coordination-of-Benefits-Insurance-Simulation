"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Banknote, ClipboardList, Clock3, FileClock,
  FileSearch, ShieldCheck, Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { dateTime, rupiah } from "@/lib/format";
import { Panel, StatusBadge } from "@/components/ui";
import type { ActivityLog, ApiEnvelope, ClaimRow, DashboardSummary, PayerUser } from "@/types";

const metrics = [
  { key: "total_claims", label: "Klaim Masuk", icon: ClipboardList, tone: "blue", foot: "Pengajuan CoB terdaftar" },
  { key: "pending_review", label: "Menunggu Review", icon: Clock3, tone: "sky", foot: "Menunggu adjudikator" },
  { key: "revision_required", label: "Perlu Revisi / Audit", icon: FileClock, tone: "rose", foot: "Tindak lanjut dokumen" },
  { key: "approved_this_month", label: "Disetujui Bulan Ini", icon: BadgeCheck, tone: "green", foot: "Keputusan bulan berjalan" },
  { key: "rejected_or_deductions", label: "Ekses Tertolak", icon: Banknote, tone: "amber", foot: "Klaim dengan ekses / potongan" },
];

export default function DashboardPage() {
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [user, setUser] = React.useState<PayerUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get<ApiEnvelope<DashboardSummary>>("/api/dashboard/summary"),
      api.get<ApiEnvelope<PayerUser>>("/api/me"),
    ])
      .then(([dashboard, profile]) => {
        setSummary(dashboard.data);
        setUser(profile.data);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Dashboard gagal dimuat."))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);
  const parameters = summary?.policy_parameters ?? {};

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1.5 text-[9px] font-semibold text-slate-500">Payer Workspace <span className="px-1 text-slate-300">›</span> PT Asuransi Sehat Sentosa <span className="px-1 text-slate-300">›</span> Console Adjudikasi CoB</p>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[#123f59]">Dashboard Review Klaim Asuransi</h1>
        <p className="mt-1 text-[10px] text-slate-500">Kelola adjudikasi klaim koordinasi asuransi komersial (CoB), evaluasi batas polis, dan persetujuan selisih biaya rawat inap sesuai polis korporat & individu aktif.</p>
      </div>
      <div className="hidden min-w-[220px] items-center gap-2 rounded-lg border border-[#e4eaf3] bg-white p-2.5 md:flex"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf4ff] text-[#2c6382]"><ShieldCheck size={16} /></span><span className="min-w-0"><strong className="block truncate text-[9px] text-[#174a66]">{user?.insurer_entity_name || summary?.kpi.current_user_entity || "Entitas penjamin"}</strong><span className="block text-[8px] text-slate-500">{user?.role_title || "Senior Claim Underwriter"}</span></span></div>
    </div>

    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{error}</div>}
    {loading && !summary ? <div className="rounded-xl border border-[#e5ebf3] bg-white p-10 text-center text-xs text-slate-500">Memuat dashboard dari Insurer Service…</div> : <>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ key, label, icon: Icon, tone, foot }) => <MetricCard key={key} label={label} value={loading ? "…" : summary?.kpi[key] ?? 0} foot={foot} icon={Icon} tone={tone} />)}
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[1.65fr_.85fr]">
        <Panel title="Pengajuan Klaim Sekunder (CoB) Terbaru" eyebrow="Daftar klaim gabungan BPJS Primer + PT Asuransi Sehat Sentosa" action={<Link href="/claims" className="text-[9px] font-bold text-[#24617f] hover:underline">Semua klaim <ArrowRight className="ml-1 inline" size={11} /></Link>}>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#edf1f6] px-3 py-2">
            <QueueChip href="/claims" label={`Semua Pengajuan (${summary?.kpi.total_claims ?? 0})`} active />
            <QueueChip href="/claims?status=SUBMITTED" label={`Prioritas Adjudikasi (${summary?.kpi.pending_review ?? 0})`} />
            <QueueChip href="/claims?status=REVISION_REQUIRED" label="Ekses Kamar & Proses Audit" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-[#fafbfd] text-[8px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">ID subklaim</th><th className="px-3 py-2.5">Kasus & pasien</th><th className="px-3 py-2.5">Polis & plan</th><th className="px-3 py-2.5">Faskes / RS</th><th className="px-3 py-2.5">Plafon pengajuan</th><th className="px-3 py-2.5">Status</th></tr></thead>
              <tbody className="divide-y divide-[#eff2f6]">
                {(summary?.recent_claims ?? []).map((claim) => <RecentClaimRow key={claim.subclaim_code} claim={claim} />)}
                {!summary?.recent_claims?.length && <tr><td colSpan={6} className="px-4 py-9 text-center text-[10px] text-slate-500">{loading ? "Memuat klaim…" : "Belum ada klaim sekunder masuk."}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#edf1f6] px-3 py-2 text-[9px] text-slate-400"><span>Menampilkan klaim terbaru dari API</span><Link href="/claims" className="inline-flex items-center gap-1 font-bold text-[#285c7a]">Buka antrean <ArrowRight size={11} /></Link></div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Aturan Polis & Parameter CoB" eyebrow="Pedoman verifikasi" action={<span className="rounded bg-[#eff4fb] px-1.5 py-0.5 text-[8px] font-bold text-slate-500">API</span>}>
            <div className="divide-y divide-[#eff2f6]">{Object.entries(parameters).map(([key, value]) => <div key={key} className="px-3 py-2.5"><p className="text-[8px] font-extrabold uppercase tracking-wide text-slate-400">{key.replaceAll("_", " ")}</p><p className="mt-1 text-[9px] font-semibold leading-4 text-slate-600">{typeof value === "number" && /limit/i.test(key) ? rupiah(value) : String(value)}</p></div>)}
              {!Object.keys(parameters).length && <p className="px-3 py-4 text-[9px] text-slate-500">Parameter polis belum tersedia.</p>}</div>
            <div className="border-t border-[#eff2f6] bg-[#f7f9ff] px-3 py-2.5"><p className="flex items-center gap-1.5 text-[8px] font-bold text-slate-500"><ShieldCheck size={11} />Batas otoritas adjudikator</p><p className="mt-1 text-[13px] font-extrabold text-[#174d69]">{rupiah(user?.authority_limit ?? summary?.kpi.underwriter_authority_limit)}</p></div>
          </Panel>
          <Panel title="Aktivitas Adjudikator" eyebrow="Log terbaru" action={<span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}>
            <ActivityFeed logs={summary?.recent_activity ?? []} loading={loading} />
          </Panel>
        </div>
      </div>
      {summary && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dce8f6] bg-[#edf4ff] px-3 py-2.5">
        <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[#286181]"><Sparkles size={14} /></span><div><p className="text-[9px] font-extrabold text-[#244b67]">Ringkasan potongan non-cover</p><p className="text-[8px] text-slate-500">Total nilai potongan yang tercatat pada klaim asuransi.</p></div></div>
        <strong className="text-[13px] font-extrabold text-[#1d5b79]">{rupiah(summary.kpi.total_deductions_amount)}</strong>
      </div>}
    </>}
  </div>;
}

function MetricCard({ label, value, foot, icon: Icon, tone }: { label: string; value: string | number; foot: string; icon: React.ElementType; tone: string }) {
  const styles: Record<string, string> = { blue: "bg-[#edf4ff] text-[#2d6384]", rose: "bg-rose-50 text-rose-600", sky: "bg-sky-50 text-sky-700", amber: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700" };
  return <article className="rounded-lg border border-[#e6ebf3] bg-white px-3 py-3 shadow-[0_2px_8px_rgba(27,65,99,.035)]"><div className="flex items-center justify-between gap-2"><p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{label}</p><span className={`grid h-6 w-6 place-items-center rounded-md ${styles[tone]}`}><Icon size={13} /></span></div><p className="mt-2 text-[22px] font-extrabold leading-none text-[#133e59]">{value}</p><p className="mt-1.5 truncate text-[8px] text-slate-500">{foot}</p></article>;
}

function QueueChip({ href, label, active = false }: { href: string; label: string; active?: boolean }) {
  return <Link href={href} className={`rounded-full border px-2.5 py-1 text-[8px] font-semibold ${active ? "border-[#164e6b] bg-[#164e6b] text-white" : "border-[#e4eaf3] bg-white text-slate-600 hover:border-[#9bbbd0] hover:text-[#174c68]"}`}>{label}</Link>;
}

function RecentClaimRow({ claim }: { claim: ClaimRow }) {
  return <tr className="hover:bg-[#f8faff]">
    <td className="whitespace-nowrap px-3 py-2.5"><Link href={`/claims/${encodeURIComponent(claim.subclaim_code)}`} className="text-[9px] font-extrabold text-[#15516f] hover:underline">{claim.subclaim_code}</Link></td>
    <td className="px-3 py-2.5"><Link href={`/claims/${encodeURIComponent(claim.subclaim_code)}`} className="block text-[9px] font-bold text-slate-700 hover:text-[#15516f]">{claim.patient_name || "Pasien"}</Link><span className="mt-0.5 block text-[8px] text-slate-400">{claim.case_number}</span></td>
    <td className="px-3 py-2.5"><span className="block text-[9px] font-semibold text-slate-700">{claim.plan_name || "Polis aktif"}</span><span className="text-[8px] text-slate-400">{claim.subclaim_code}</span></td>
    <td className="max-w-[120px] px-3 py-2.5"><span className="block truncate text-[9px] font-semibold text-slate-600">{claim.hospital_name}</span><span className="text-[8px] text-slate-400">Fasilitas mitra</span></td>
    <td className="whitespace-nowrap px-3 py-2.5"><strong className="text-[9px] text-[#174966]">{rupiah(claim.requested_amount)}</strong></td>
    <td className="whitespace-nowrap px-3 py-2.5"><StatusBadge status={claim.status} /></td>
  </tr>;
}

function ActivityFeed({ logs, loading }: { logs: ActivityLog[]; loading: boolean }) {
  if (!logs.length) return <p className="px-3 py-5 text-[9px] text-slate-500">{loading ? "Memuat aktivitas…" : "Belum ada aktivitas adjudikator."}</p>;
  return <div className="divide-y divide-[#eff2f6]">{logs.slice(0, 4).map((log, index) => <div key={`${log.subclaim_code ?? ""}-${log.created_at ?? index}`} className="flex gap-2.5 px-3 py-2.5"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#edf4ff] text-[#356481]"><FileSearch size={12} /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-[9px] font-bold text-slate-700">{(log.action || "Aktivitas klaim").replaceAll("_", " ")}</p><time className="shrink-0 text-[8px] text-slate-400">{dateTime(log.created_at)}</time></div><p className="mt-0.5 line-clamp-2 text-[8px] leading-3 text-slate-500">{log.notes || log.subclaim_code || "—"}</p></div></div>)}</div>;
}
