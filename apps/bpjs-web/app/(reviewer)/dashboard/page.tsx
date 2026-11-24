"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity, ArrowRight, BadgeCheck, Building2, CalendarClock, CheckCircle2,
  ClipboardList, Clock3, FileSearch, Filter, RotateCcw, ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { dateTime, rupiah } from "@/lib/format";
import { Panel, StatusBadge } from "@/components/ui";
import type { ActivityLog, ApiEnvelope, ClaimRow, DashboardSummary } from "@/types";

const metrics = [
  { key: "total_claims", label: "Total klaim masuk", icon: ClipboardList, tone: "blue", foot: "Pengajuan terdaftar" },
  { key: "pending_review", label: "Menunggu review", icon: Clock3, tone: "rose", foot: "Perlu ditinjau reviewer" },
  { key: "in_review", label: "Sedang ditinjau", icon: FileSearch, tone: "sky", foot: "Dalam analisis klinis" },
  { key: "revision_required", label: "Perlu revisi", icon: RotateCcw, tone: "amber", foot: "Menunggu respons faskes" },
  { key: "approved_this_month", label: "Disetujui bulan ini", icon: BadgeCheck, tone: "green", foot: "Keputusan bulan berjalan" },
];

export default function DashboardPage() {
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    api.get<ApiEnvelope<DashboardSummary>>("/api/dashboard/summary")
      .then((response) => setSummary(response.data))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Dashboard gagal dimuat."))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);
  const distribution = summary?.decision_distribution ?? {};
  const totalDistribution = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1.5 text-[9px] font-semibold text-slate-500">Payer Workspace <span className="px-1 text-slate-300">›</span> BPJS Kesehatan <span className="px-1 text-slate-300">›</span> Dashboard</p>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[#123f59]">Dashboard Review Klaim BPJS</h1>
        <p className="mt-1 text-[10px] text-slate-500">Pantau antrean pengajuan subklaim JKN primer dari fasilitas kesehatan mitra.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/claims?filter=SLA_URGENT" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d9e3ef] bg-white px-2.5 text-[9px] font-bold text-[#3d5d75] hover:bg-[#f5f8fc]"><CalendarClock size={12} /> Filter Prioritas SLA</Link>
        <button type="button" onClick={load} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0b4562] px-2.5 text-[9px] font-bold text-white hover:bg-[#07384f]"><RotateCcw size={12} /> Muat ulang</button>
      </div>
    </div>

    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{error}</div>}
    {loading && !summary ? <div className="rounded-xl border border-[#e5ebf3] bg-white p-10 text-center text-xs text-slate-500">Memuat dashboard dari BPJS Service…</div> : <>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ key, label, icon: Icon, tone, foot }) => <MetricCard key={key} label={label} value={loading ? "…" : summary?.kpi[key] ?? 0} foot={foot} icon={Icon} tone={tone} />)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#dce8f6] bg-[#edf4ff] px-3 py-2.5">
        <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[#286181]"><ShieldCheck size={15} /></span><div><p className="text-[10px] font-extrabold text-[#244b67]">Konsol Verifikasi Klaim JKN</p><p className="text-[9px] text-slate-500">Pemeriksaan administrasi, klinis, tarif, dan kelengkapan dokumen sebelum keputusan dikirim.</p></div></div>
        <Link href="/claims" className="inline-flex items-center gap-1 text-[9px] font-bold text-[#285c7a] hover:underline">Buka antrean <ArrowRight size={12} /></Link>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[1.65fr_.85fr]">
        <Panel title="Antrean Subklaim Prioritas Verifikasi" eyebrow="Daftar klaim aktif" action={<Link href="/claims" className="text-[9px] font-bold text-[#24617f] hover:underline">Lihat semua <ArrowRight className="ml-1 inline" size={11} /></Link>}>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#edf1f6] px-3 py-2">
            <QueueChip href="/claims" label={`Semua Prioritas (${summary?.kpi.total_claims ?? 0})`} />
            <QueueChip href="/claims?filter=SLA_URGENT" label="Batas Waktu <24 Jam" />
            <QueueChip href="/claims?filter=EXECUTIVE_INPATIENT" label="Rawat Inap Eksekutif" />
            <Link href="/claims" className="ml-auto inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500"><Filter size={11} /> Filter</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[690px] text-left">
              <thead className="bg-[#fafbfd] text-[8px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">ID subklaim</th><th className="px-3 py-2.5">Kasus & pasien</th><th className="px-3 py-2.5">Faskes / RS</th><th className="px-3 py-2.5">Tarif diajukan</th><th className="px-3 py-2.5">SLA / status</th></tr></thead>
              <tbody className="divide-y divide-[#eff2f6]">
                {(summary?.priority_claims ?? []).map((claim) => <PriorityRow key={claim.subclaim_code} claim={claim} />)}
                {!summary?.priority_claims?.length && <tr><td colSpan={5} className="px-4 py-9 text-center text-[10px] text-slate-500">{loading ? "Memuat klaim…" : "Tidak ada klaim prioritas untuk ditampilkan."}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#edf1f6] px-3 py-2 text-[9px] text-slate-400"><span>Daftar prioritas dari API BPJS</span><Link href="/claims" className="inline-flex items-center gap-1 font-bold text-[#285c7a]">Semua klaim <ArrowRight size={11} /></Link></div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Distribusi Keputusan BPJS" eyebrow="Status klaim" action={<span className="text-[8px] text-slate-400">Semua periode</span>}>
            <div className="px-3 pb-3 pt-2">
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">{Object.entries(distribution).map(([status, count]) => <div key={status} className={distributionColor(status)} style={{ width: `${totalDistribution ? (count / totalDistribution) * 100 : 0}%` }} />)}</div>
              <div className="mt-3 grid grid-cols-3 gap-2">{[["APPROVED", "Disetujui"], ["REVISION_REQUIRED", "Revisi"], ["REJECTED", "Ditolak"]].map(([key, label]) => <div key={key}><p className="flex items-center gap-1 text-[8px] font-semibold text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${distributionColor(key)}`} />{label}</p><p className="mt-0.5 text-[13px] font-extrabold text-[#153f59]">{distribution[key] ?? 0}</p><p className="text-[8px] text-slate-400">{totalDistribution ? Math.round(((distribution[key] ?? 0) / totalDistribution) * 100) : 0}% dari keputusan</p></div>)}</div>
              <div className="mt-3 flex items-center justify-between rounded-md bg-[#f2f6fc] px-2.5 py-2 text-[9px]"><span className="text-slate-500">Total klaim terdata</span><strong className="text-[#244f6b]">{totalDistribution}</strong></div>
            </div>
          </Panel>
          <Panel title="Faskes Mitra Teraktif" eyebrow="Jejaring layanan">
            <div className="divide-y divide-[#eff2f6]">{(summary?.faskes_mitra ?? []).slice(0, 4).map((facility) => <div key={facility.hospital_name} className="flex items-center gap-2.5 px-3 py-2"><span className="grid h-7 w-7 place-items-center rounded-md bg-[#edf4ff] text-[#356481]"><Building2 size={13} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-bold text-slate-700">{facility.hospital_name}</span><span className="text-[8px] text-slate-400">{facility.total_claims} klaim</span></span><strong className="text-[9px] text-[#2c5f7c]">{rupiah(facility.approved_total)}</strong></div>)}
              {!summary?.faskes_mitra?.length && <p className="px-3 py-4 text-[9px] text-slate-500">Ringkasan faskes belum tersedia.</p>}</div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_.8fr]">
        <Panel title="Pedoman Ringkas Verifikasi INA-CBG" eyebrow="Checklist pemeriksaan">
          <div className="grid gap-2 p-3 sm:grid-cols-3">{[
            ["01", "Validasi SEP & Identitas", "Pastikan kepesertaan dan identitas pasien sesuai dokumen rujukan."],
            ["02", "Kesesuaian Koding ICD", "Periksa kecocokan diagnosis ICD-10 dan prosedur ICD-9-CM."],
            ["03", "Verifikasi Subklaim CoB", "Pastikan nilai subklaim BPJS sesuai pembagian biaya dari RS."],
          ].map(([step, title, body]) => <div key={step} className="rounded-md border border-[#e8eef7] bg-[#f5f8ff] p-2.5"><p className="text-[8px] font-extrabold text-[#4c7391]">{step} · CHECKPOINT</p><h3 className="mt-1 text-[9px] font-extrabold text-[#234d69]">{title}</h3><p className="mt-1 text-[8px] leading-3.5 text-slate-500">{body}</p></div>)}</div>
        </Panel>
        <Panel title="Aktivitas Verifikator Terkini" eyebrow="Audit klaim" action={<ActivityIcon />}>
          <ActivityFeed logs={summary?.recent_activity ?? []} loading={loading} />
        </Panel>
      </div>
    </>}
  </div>;
}

function MetricCard({ label, value, foot, icon: Icon, tone }: { label: string; value: string | number; foot: string; icon: React.ElementType; tone: string }) {
  const styles: Record<string, string> = { blue: "bg-[#edf4ff] text-[#2d6384]", rose: "bg-rose-50 text-rose-600", sky: "bg-sky-50 text-sky-700", amber: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700" };
  return <article className="rounded-lg border border-[#e6ebf3] bg-white px-3 py-3 shadow-[0_2px_8px_rgba(27,65,99,.035)]"><div className="flex items-center justify-between gap-2"><p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{label}</p><span className={`grid h-6 w-6 place-items-center rounded-md ${styles[tone]}`}><Icon size={13} /></span></div><p className="mt-2 text-[22px] font-extrabold leading-none text-[#133e59]">{value}</p><p className="mt-1.5 truncate text-[8px] text-slate-500">{foot}</p></article>;
}

function QueueChip({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="rounded-full border border-[#e4eaf3] bg-white px-2.5 py-1 text-[8px] font-semibold text-slate-600 hover:border-[#9bbbd0] hover:text-[#174c68]">{label}</Link>;
}

function PriorityRow({ claim }: { claim: ClaimRow }) {
  const hours = claim.sla_remaining_hours;
  return <tr className="group hover:bg-[#f8faff]">
    <td className="whitespace-nowrap px-3 py-2.5"><Link href={`/claims/${encodeURIComponent(claim.subclaim_code)}`} className="text-[9px] font-extrabold text-[#15516f] hover:underline">{claim.subclaim_code}</Link></td>
    <td className="px-3 py-2.5"><Link href={`/claims/${encodeURIComponent(claim.subclaim_code)}`} className="block text-[9px] font-bold text-slate-700 hover:text-[#15516f]">{claim.patient_name || "Pasien"}</Link><span className="mt-0.5 block text-[8px] text-slate-400">{claim.case_number}{claim.care_class ? ` · ${claim.care_class}` : ""}</span></td>
    <td className="max-w-[130px] px-3 py-2.5"><span className="block truncate text-[9px] font-semibold text-slate-600">{claim.hospital_name}</span><span className="text-[8px] text-slate-400">{claim.diagnosis_icd10 || "Faskes mitra"}</span></td>
    <td className="whitespace-nowrap px-3 py-2.5"><strong className="text-[9px] text-[#174966]">{rupiah(claim.requested_amount)}</strong></td>
    <td className="whitespace-nowrap px-3 py-2.5"><span className={`block text-[8px] font-bold ${typeof hours === "number" && hours < 24 ? "text-rose-600" : "text-slate-500"}`}>{typeof hours === "number" ? `${hours} jam tersisa` : dateTime(claim.sla_deadline)}</span><span className="mt-1 inline-block"><StatusBadge status={claim.status} /></span></td>
  </tr>;
}

function ActivityFeed({ logs, loading }: { logs: ActivityLog[]; loading: boolean }) {
  if (!logs.length) return <p className="px-3 py-5 text-[9px] text-slate-500">{loading ? "Memuat aktivitas…" : "Belum ada aktivitas reviewer."}</p>;
  return <div className="divide-y divide-[#eff2f6]">{logs.slice(0, 4).map((log, index) => <div key={`${log.subclaim_code ?? ""}-${log.created_at ?? index}`} className="flex gap-2.5 px-3 py-2.5"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#edf4ff] text-[#356481]"><CheckCircle2 size={12} /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-[9px] font-bold text-slate-700">{(log.action || "Aktivitas klaim").replaceAll("_", " ")}</p><time className="shrink-0 text-[8px] text-slate-400">{dateTime(log.created_at)}</time></div><p className="mt-0.5 line-clamp-2 text-[8px] leading-3 text-slate-500">{log.notes || log.subclaim_code || "—"}</p></div></div>)}</div>;
}

function ActivityIcon() {
  return <Activity size={13} className="text-slate-400" />;
}

function distributionColor(status: string) {
  if (status === "APPROVED") return "bg-emerald-500";
  if (status === "REVISION_REQUIRED") return "bg-amber-400";
  if (status === "REJECTED") return "bg-rose-500";
  if (status === "IN_REVIEW") return "bg-blue-500";
  return "bg-slate-300";
}
