"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Circle, FileText, History, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { dateTime, rupiah } from "@/lib/format";
import { Panel, StatusBadge } from "@/components/ui";
import type { ApiEnvelope, ClaimDetail } from "@/types";

const complianceItems = [
  ["jkn_active", "Kepesertaan JKN aktif"], ["referral_valid", "Rujukan / SEP sesuai"], ["icd_coding_match", "Kode diagnosis dan tindakan sesuai"], ["no_duplicate_claim", "Tidak ada klaim duplikat"],
] as const;

export default function ClaimDetailPage() {
  const params = useParams<{ subclaimCode: string }>();
  const code = decodeURIComponent(params.subclaimCode);
  const [claim, setClaim] = React.useState<ClaimDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [decision, setDecision] = React.useState<"APPROVED" | "REVISION_REQUIRED" | "REJECTED">("APPROVED");
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [checks, setChecks] = React.useState<Record<string, boolean>>({ jkn_active: false, referral_valid: false, icd_coding_match: false, no_duplicate_claim: false });
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [noticeError, setNoticeError] = React.useState("");

  const load = React.useCallback(() => {
    setLoading(true); setError("");
    api.get<ApiEnvelope<ClaimDetail>>(`/api/claims/${encodeURIComponent(code)}`)
      .then((response) => { setClaim(response.data); setAmount(String(response.data.requested_amount ?? 0)); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Detail klaim gagal dimuat."))
      .finally(() => setLoading(false));
  }, [code]);
  React.useEffect(() => { load(); }, [load]);

  async function markInReview() {
    setNotice(""); setNoticeError("");
    try {
      await api.patch(`/api/claims/${encodeURIComponent(code)}/status`, { status: "IN_REVIEW", notes: "Klaim mulai diperiksa reviewer." });
      setNotice("Status klaim diperbarui menjadi sedang ditinjau.");
      load();
    } catch (cause) { setNoticeError(cause instanceof Error ? cause.message : "Status klaim gagal diperbarui."); }
  }

  async function submitDecision(event: React.FormEvent) {
    event.preventDefault(); setNotice(""); setNoticeError("");
    const numericAmount = Number(amount);
    if (decision === "APPROVED" && (!Number.isFinite(numericAmount) || numericAmount < 0 || numericAmount > Number(claim?.requested_amount))) {
      setNoticeError("Nominal persetujuan harus berada di antara Rp0 dan nominal pengajuan."); return;
    }
    if (decision === "APPROVED" && complianceItems.some(([key]) => !checks[key])) {
      setNoticeError("Lengkapi seluruh checklist kepatuhan sebelum menyetujui klaim."); return;
    }
    if (decision !== "APPROVED" && notes.trim().length < 8) { setNoticeError("Berikan catatan minimal 8 karakter untuk revisi atau penolakan."); return; }
    const verb = decision === "APPROVED" ? "menyetujui" : decision === "REJECTED" ? "menolak" : "meminta revisi";
    if (!window.confirm(`Konfirmasi ${verb} klaim ${code}? Keputusan akan dikirim ke backend dan diteruskan ke rumah sakit.`)) return;
    setSaving(true);
    try {
      const result = await api.post<ApiEnvelope<{ decision: string; message?: string }>>(`/api/claims/${encodeURIComponent(code)}/decide`, {
        decision,
        ...(decision === "APPROVED" ? { approved_amount: numericAmount } : {}),
        compliance_checks: checks,
        reviewer_notes: notes.trim(),
      });
      setNotice(result.data.message || `Keputusan ${decision === "APPROVED" ? "persetujuan" : decision === "REJECTED" ? "penolakan" : "revisi"} berhasil dikirim ke rumah sakit.`);
      load();
    } catch (cause) {
      setNoticeError(cause instanceof Error ? cause.message : "Keputusan tidak berhasil dikirim.");
    } finally { setSaving(false); }
  }

  if (loading && !claim) return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Memuat detail klaim…</div>;
  if (error || !claim) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-800">{error || "Klaim tidak ditemukan."}<Link href="/claims" className="ml-3 font-bold underline">Kembali ke antrean</Link></div>;

  return <div className="space-y-6">
    <Link href="/claims" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-teal-800"><ArrowLeft size={15} /> Kembali ke antrean</Link>
    <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#103f46] p-6 text-white md:flex-row md:items-center md:p-8"><div><div className="flex flex-wrap items-center gap-3"><p className="text-xs font-bold uppercase tracking-[.14em] text-teal-200">Review klaim BPJS</p><StatusBadge status={claim.status} /></div><h1 className="mt-3 text-2xl font-extrabold">{claim.subclaim_code}</h1><p className="mt-1 text-sm text-teal-50/70">{claim.case_number} · {claim.hospital_name}</p></div><div className="flex items-center gap-2"><ShieldCheck size={22} className="text-teal-200" /><div><p className="text-[10px] uppercase tracking-wider text-teal-50/60">Nominal diajukan</p><p className="mt-1 text-xl font-extrabold">{rupiah(claim.requested_amount)}</p></div></div></div>
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    {noticeError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{noticeError}</div>}
    <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <div className="space-y-5">
        <Panel title="Pasien & kepesertaan" eyebrow="Identitas klaim"><Snapshot value={claim.patient} /></Panel>
        <Panel title="Informasi klinis" eyebrow="Ringkasan medis"><Snapshot value={claim.clinical} /><div className="border-t border-slate-100"><Snapshot value={claim.coverage} /></div></Panel>
        <Panel title="Dokumen pendukung" eyebrow="Berkas klaim"><Documents value={claim.documents} /></Panel>
        <Panel title="Riwayat pemeriksaan" eyebrow="Jejak audit" action={<History size={16} className="text-slate-400" />}><div className="divide-y divide-slate-100">{claim.logs?.length ? claim.logs.map((log, index) => <div key={`${log.created_at}-${index}`} className="px-5 py-4"><div className="flex justify-between gap-4"><p className="text-xs font-bold text-slate-800">{(log.action || "Aktivitas").replaceAll("_", " ")}</p><time className="shrink-0 text-[10px] text-slate-400">{dateTime(log.created_at)}</time></div><p className="mt-1 text-xs text-slate-500">{log.notes || "—"} · {log.actor_name || "Sistem"}</p></div>) : <p className="px-5 py-6 text-sm text-slate-500">Belum ada riwayat klaim.</p>}</div></Panel>
      </div>
      <div className="space-y-5 xl:sticky xl:top-[90px]">
        <Panel title="Checklist kepatuhan" eyebrow="Verifikasi JKN">
          <div className="space-y-1 p-4">{complianceItems.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={Boolean(checks[key])} onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 accent-teal-700" />{label}</label>)}</div>
          <div className="border-t border-slate-100 px-5 py-4"><p className="text-xs font-bold text-slate-700">Status awal</p><p className="mt-1 text-xs text-slate-500">Gunakan aksi ini untuk menandai bahwa pemeriksaan klaim sedang berlangsung.</p><button disabled={claim.status !== "SUBMITTED"} onClick={markInReview} className="mt-3 w-full rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-bold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50">{claim.status === "SUBMITTED" ? "Mulai pemeriksaan" : "Klaim sudah diproses"}</button></div>
        </Panel>
        <Panel title="Kirim keputusan" eyebrow="Adjudikasi">
          <form onSubmit={submitDecision} className="space-y-4 p-5">
            <label className="block text-xs font-bold text-slate-700">Keputusan<select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-teal-600"><option value="APPROVED">Setujui klaim</option><option value="REVISION_REQUIRED">Minta revisi berkas</option><option value="REJECTED">Tolak klaim</option></select></label>
            {decision === "APPROVED" && <label className="block text-xs font-bold text-slate-700">Nominal disetujui<input type="number" min="0" max={claim.requested_amount} step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-600" /><span className="mt-1 block font-medium text-slate-400">Maksimal {rupiah(claim.requested_amount)}</span></label>}
            <label className="block text-xs font-bold text-slate-700">Catatan reviewer<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} maxLength={2000} placeholder="Tuliskan dasar verifikasi dan catatan untuk rumah sakit…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-teal-600" /><span className="mt-1 block text-right text-[10px] font-medium text-slate-400">{notes.length}/2000</span></label>
            {claim.reviewer_notes && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><span className="font-bold">Catatan sebelumnya:</span> {claim.reviewer_notes}</p>}
            <button disabled={saving || claim.status === "APPROVED" || claim.status === "REJECTED"} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 text-sm font-bold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"><Check size={16} />{saving ? "Mengirim keputusan…" : "Konfirmasi keputusan"}</button>
            <p className="text-[10px] leading-relaxed text-slate-400">Keputusan dikirim ke backend BPJS dan diteruskan ke Hospital Service. Status di halaman ini mengikuti respons API.</p>
          </form>
        </Panel>
      </div>
    </div>
  </div>;
}

function Snapshot({ value }: { value?: Record<string, unknown> }) {
  const entries = Object.entries(value ?? {}).filter(([, item]) => item !== null && item !== undefined && item !== "");
  if (!entries.length) return <p className="px-5 py-5 text-xs text-slate-400">Informasi belum tersedia pada paket klaim.</p>;
  return <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">{entries.map(([key, item]) => <div key={key} className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{key.replaceAll("_", " ")}</dt><dd className="mt-1 break-words text-xs font-semibold text-slate-700">{formatValue(item)}</dd></div>)}</dl>;
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function Documents({ value }: { value: unknown }) {
  const documents = Array.isArray(value) ? value : value && typeof value === "object" ? Object.entries(value as Record<string, unknown>).map(([name, detail]) => typeof detail === "object" && detail !== null ? { name, ...(detail as Record<string, unknown>) } : { name, status: detail }) : [];
  if (!documents.length) return <p className="px-5 py-6 text-sm text-slate-500">Belum ada dokumen pada paket klaim.</p>;
  return <div className="divide-y divide-slate-100">{documents.map((document, index) => {
    const item = typeof document === "object" && document !== null ? document as Record<string, unknown> : { name: String(document) };
    const label = String(item.name ?? item.document_type ?? item.category ?? `Dokumen ${index + 1}`);
    const state = String(item.status ?? item.validation_status ?? "Terlampir");
    return <div key={`${label}-${index}`} className="flex items-center gap-3 px-5 py-3.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600"><FileText size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{label}</p><p className="mt-0.5 text-[10px] text-slate-500">{state}</p></div>{String(state).toLowerCase().includes("valid") && <CheckCircle2 size={16} className="text-emerald-600" />}{!String(state).toLowerCase().includes("valid") && <Circle size={16} className="text-slate-300" />}</div>;
  })}</div>;
}
