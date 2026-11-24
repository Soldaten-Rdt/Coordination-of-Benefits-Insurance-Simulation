"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, BadgeCheck, Banknote, ClipboardList, Clock3, RotateCcw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { dateTime, rupiah } from "@/lib/format";
import { ClaimTable, Panel } from "@/components/ui";
import type { ActivityLog, ApiEnvelope, DashboardSummary } from "@/types";

const metrics = [
  { key: "total_claims", label: "Klaim diterima", icon: ClipboardList, color: "bg-sky-50 text-sky-700" },
  { key: "pending_review", label: "Menunggu review", icon: Clock3, color: "bg-amber-50 text-amber-700" },
  { key: "revision_required", label: "Perlu revisi / audit", icon: RotateCcw, color: "bg-orange-50 text-orange-700" },
  { key: "approved_this_month", label: "Disetujui bulan ini", icon: BadgeCheck, color: "bg-emerald-50 text-emerald-700" },
  { key: "rejected_or_deductions", label: "Ekses / potongan", icon: Banknote, color: "bg-violet-50 text-violet-700" },
];

export default function DashboardPage() {
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => {
    setLoading(true); setError("");
    api.get<ApiEnvelope<DashboardSummary>>("/api/dashboard/summary")
      .then((response) => setSummary(response.data))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Dashboard gagal dimuat."))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { load(); }, [load]);
  const distribution = summary?.decision_distribution ?? {};
  const distributionTotal = Object.values(distribution).reduce((sum, value) => sum + value, 0);

  return <div className="space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold text-violet-800"><ShieldCheck size={15} /> ADJUDICATION / PRIVATE INSURANCE</div><h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Ringkasan adjudikasi</h1><p className="mt-2 text-sm text-slate-500">Pantau klaim sekunder CoB, batas otoritas, dan tindak lanjut polis.</p></div><button onClick={load} className="self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:self-auto">Muat ulang</button></div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    {loading && !summary ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Memuat ringkasan dari layanan asuransi…</div> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(({ key, label, icon: Icon, color }) => <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}><Icon size={19} /></span><ArrowUpRight size={15} className="text-slate-300" /></div><p className="mt-5 text-2xl font-extrabold text-slate-900">{loading ? "…" : summary?.kpi[key] ?? 0}</p><p className="mt-1 text-xs font-semibold text-slate-500">{label}</p></article>)}</div>
      <div className="grid gap-5 xl:grid-cols-[1.55fr_.75fr]">
        <Panel title="Klaim sekunder terbaru" eyebrow="Antrean adjudikasi" action={<Link href="/claims" className="text-xs font-bold text-violet-700 hover:text-violet-900">Lihat antrean <ArrowUpRight className="ml-1 inline" size={14} /></Link>}>
          <ClaimTable claims={summary?.recent_claims ?? []} empty={loading ? "Memuat klaim…" : "Belum ada klaim masuk."} />
        </Panel>
        <div className="space-y-5">
          <Panel title="Parameter polis / CoB" eyebrow="Panduan adjudikasi">
            <div className="divide-y divide-slate-100">{Object.entries(summary?.policy_parameters ?? {}).map(([key, value]) => <div key={key} className="px-5 py-3.5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{key.replaceAll("_", " ")}</p><p className="mt-1 text-xs font-semibold leading-relaxed text-slate-700">{typeof value === "number" && key.includes("limit") ? rupiah(value) : String(value)}</p></div>)}
              {!Object.keys(summary?.policy_parameters ?? {}).length && <p className="px-5 py-5 text-sm text-slate-500">Parameter polis belum tersedia.</p>}</div>
          </Panel>
          <Panel title="Distribusi keputusan" eyebrow="Status klaim">
            <div className="space-y-4 p-5">{Object.entries(distribution).map(([status, count]) => {
              const share = distributionTotal ? Math.round((count / distributionTotal) * 100) : 0;
              const bar = status === "APPROVED" ? "bg-emerald-500" : status === "REJECTED" ? "bg-rose-400" : status === "REVISION_REQUIRED" ? "bg-orange-400" : status === "IN_REVIEW" ? "bg-violet-400" : "bg-sky-400";
              return <div key={status}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold text-slate-600">{status.replaceAll("_", " ")}</span><span className="font-bold text-slate-800">{count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${bar}`} style={{ width: `${share}%` }} /></div></div>;
            })}{!Object.keys(distribution).length && <p className="text-sm text-slate-500">Belum ada data keputusan.</p>}</div>
          </Panel>
        </div>
      </div>
      <Panel title="Aktivitas adjudikator" eyebrow="Riwayat terbaru" action={<Activity size={16} className="text-slate-400" />}><ActivityList logs={summary?.recent_activity ?? []} loading={loading} /></Panel>
    </>}
  </div>;
}

function ActivityList({ logs, loading }: { logs: ActivityLog[]; loading: boolean }) {
  if (!logs.length) return <p className="px-5 py-7 text-sm text-slate-500">{loading ? "Memuat aktivitas…" : "Belum ada aktivitas adjudikator."}</p>;
  return <div className="divide-y divide-slate-100 md:grid md:grid-cols-2 md:divide-y-0">{logs.slice(0, 8).map((log, index) => <div key={`${log.subclaim_code ?? ""}-${log.created_at ?? index}`} className="flex gap-3 border-slate-100 px-5 py-4 md:border-b"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700"><Activity size={15} /></span><div className="min-w-0"><p className="text-xs font-bold text-slate-800">{log.action?.replaceAll("_", " ") || "Aktivitas klaim"} <span className="font-medium text-slate-500">· {log.actor_name || "Sistem"}</span></p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{log.notes || "—"}</p><p className="mt-1.5 text-[10px] text-slate-400">{dateTime(log.created_at)}</p></div></div>)}</div>;
}
