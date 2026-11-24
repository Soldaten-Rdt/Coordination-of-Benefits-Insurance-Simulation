import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ClaimStatus } from "@/types";
import { rupiah, statusLabel } from "@/lib/format";

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const colors: Record<string, string> = {
    SUBMITTED: "bg-sky-50 text-sky-700 ring-sky-200",
    IN_REVIEW: "bg-amber-50 text-amber-700 ring-amber-200",
    REVISION_REQUIRED: "bg-orange-50 text-orange-700 ring-orange-200",
    APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${colors[status] || "bg-slate-50 text-slate-600 ring-slate-200"}`}>{statusLabel(status)}</span>;
}

export function ClaimTable({ claims, empty = "Belum ada klaim pada antrean ini." }: { claims: { subclaim_code: string; case_number: string; patient_name: string; hospital_name: string; plan_name?: string; status: ClaimStatus; requested_amount: number }[]; empty?: string }) {
  if (!claims.length) return <div className="px-6 py-14 text-center text-sm text-slate-500">{empty}</div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Klaim / pasien</th><th className="px-5 py-3">Fasilitas / polis</th><th className="px-5 py-3">Pengajuan</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" /></tr></thead>
    <tbody className="divide-y divide-slate-100">{claims.map((claim) => <tr key={claim.subclaim_code} className="transition hover:bg-slate-50/80">
      <td className="px-5 py-4"><div className="font-bold text-slate-800">{claim.patient_name || "Nama pasien tidak tersedia"}</div><div className="mt-1 text-xs text-slate-500">{claim.subclaim_code} · {claim.case_number}</div></td>
      <td className="px-5 py-4"><div className="text-slate-600">{claim.hospital_name || "—"}</div>{claim.plan_name && <div className="mt-1 text-[10px] text-slate-400">{claim.plan_name}</div>}</td>
      <td className="px-5 py-4 font-semibold text-slate-700">{rupiah(claim.requested_amount)}</td><td className="px-5 py-4"><StatusBadge status={claim.status} /></td>
      <td className="px-5 py-4 text-right"><Link aria-label={`Buka klaim ${claim.subclaim_code}`} className="inline-flex items-center gap-1 font-bold text-violet-700 hover:text-violet-900" href={`/claims/${encodeURIComponent(claim.subclaim_code)}`}>Buka <ArrowRight size={14} /></Link></td>
    </tr>)}</tbody>
  </table></div>;
}

export function Panel({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div>{eyebrow && <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-700">{eyebrow}</p>}<h2 className="text-base font-extrabold text-slate-800">{title}</h2></div>{action}</div>{children}</section>;
}
