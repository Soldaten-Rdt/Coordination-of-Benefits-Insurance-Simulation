import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ClaimStatus } from "@/types";
import { rupiah, statusLabel } from "@/lib/format";

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const colors: Record<string, string> = {
    SUBMITTED: "bg-sky-50 text-sky-700 ring-sky-200",
    IN_REVIEW: "bg-amber-50 text-amber-700 ring-amber-200",
    REVISION_REQUIRED: "bg-rose-50 text-rose-700 ring-rose-200",
    APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    REJECTED: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-bold ring-1 ring-inset ${colors[status] || "bg-slate-50 text-slate-600 ring-slate-200"}`}>{statusLabel(status)}</span>;
}

export function ClaimTable({ claims, empty = "Belum ada klaim pada antrean ini." }: { claims: { subclaim_code: string; case_number: string; patient_name: string; hospital_name: string; plan_name?: string; status: ClaimStatus; requested_amount: number }[]; empty?: string }) {
  if (!claims.length) return <div className="px-5 py-10 text-center text-[10px] text-slate-500">{empty}</div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[690px] text-left">
    <thead className="bg-[#fafbfd] text-[8px] font-bold uppercase tracking-wide text-slate-500"><tr>
      <th className="px-3 py-2.5">ID subklaim</th><th className="px-3 py-2.5">Kasus & pasien</th><th className="px-3 py-2.5">Polis / plan</th><th className="px-3 py-2.5">Faskes / RS</th><th className="px-3 py-2.5">Nominal diajukan</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" />
    </tr></thead>
    <tbody className="divide-y divide-[#eff2f6]">{claims.map((claim) => <tr key={claim.subclaim_code} className="hover:bg-[#f8faff]">
      <td className="whitespace-nowrap px-3 py-2.5"><Link href={`/claims/${encodeURIComponent(claim.subclaim_code)}`} className="text-[9px] font-extrabold text-[#15516f] hover:underline">{claim.subclaim_code}</Link></td>
      <td className="px-3 py-2.5"><span className="block text-[9px] font-bold text-slate-700">{claim.patient_name || "Pasien"}</span><span className="mt-0.5 block text-[8px] text-slate-400">{claim.case_number}</span></td>
      <td className="px-3 py-2.5 text-[9px] font-semibold text-slate-600">{claim.plan_name || "Polis aktif"}</td>
      <td className="max-w-[150px] px-3 py-2.5"><span className="block truncate text-[9px] font-semibold text-slate-600">{claim.hospital_name}</span></td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[9px] font-bold text-[#174966]">{rupiah(claim.requested_amount)}</td>
      <td className="whitespace-nowrap px-3 py-2.5"><StatusBadge status={claim.status} /></td>
      <td className="px-3 py-2.5 text-right"><Link aria-label={`Buka klaim ${claim.subclaim_code}`} className="inline-flex items-center gap-1 text-[9px] font-bold text-[#24617f] hover:underline" href={`/claims/${encodeURIComponent(claim.subclaim_code)}`}>Buka <ArrowRight size={11} /></Link></td>
    </tr>)}</tbody>
  </table></div>;
}

export function Panel({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-[#e5ebf3] bg-white shadow-[0_2px_8px_rgba(27,65,99,.035)]"><div className="flex items-center justify-between border-b border-[#edf1f6] px-3 py-2.5"><div>{eyebrow && <p className="mb-0.5 text-[8px] font-extrabold uppercase tracking-[.13em] text-[#52728a]">{eyebrow}</p>}<h2 className="text-[11px] font-extrabold text-[#16445f]">{title}</h2></div>{action}</div>{children}</section>;
}
