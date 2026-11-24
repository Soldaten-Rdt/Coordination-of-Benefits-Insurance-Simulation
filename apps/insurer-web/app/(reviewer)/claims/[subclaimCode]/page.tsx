"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Circle, FileText, History, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { dateTime, rupiah } from "@/lib/format";
import { Panel, StatusBadge } from "@/components/ui";
import type { AdjudicationPreview, ApiEnvelope, ClaimDetail } from "@/types";

export default function ClaimDetailPage() {
  const params = useParams<{ subclaimCode: string }>();
  const code = decodeURIComponent(params.subclaimCode);
  const [claim, setClaim] = React.useState<ClaimDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [deduction, setDeduction] = React.useState("0");
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [decision, setDecision] = React.useState<"APPROVED" | "REVISION_REQUIRED" | "REJECTED">("APPROVED");
  const [preview, setPreview] = React.useState<AdjudicationPreview | null>(null);
  const [previewKey, setPreviewKey] = React.useState("");
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [noticeError, setNoticeError] = React.useState("");

  const load = React.useCallback(() => {
    setLoading(true); setError("");
    api.get<ApiEnvelope<ClaimDetail>>(`/api/claims/${encodeURIComponent(code)}`)
      .then((response) => {
        setClaim(response.data);
        setDeduction(String(response.data.non_cover_deduction ?? 0));
        setReason(String(response.data.deduction_reason ?? ""));
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Detail klaim gagal dimuat."))
      .finally(() => setLoading(false));
  }, [code]);
  React.useEffect(() => { load(); }, [load]);

  const currentPreviewKey = `${deduction}:${reason.trim()}`;
  const previewIsCurrent = Boolean(preview && currentPreviewKey === previewKey);

  async function markInReview() {
    setNotice(""); setNoticeError("");
    try {
      await api.patch(`/api/claims/${encodeURIComponent(code)}/status`, { status: "IN_REVIEW", notes: "Klaim sekunder mulai ditinjau adjudikator." });
      setNotice("Status klaim diperbarui menjadi sedang ditinjau.");
      load();
    } catch (cause) { setNoticeError(cause instanceof Error ? cause.message : "Status klaim gagal diperbarui."); }
  }

  async function calculatePreview(event: React.FormEvent) {
    event.preventDefault(); setNotice(""); setNoticeError("");
    const numericDeduction = Number(deduction);
    if (!Number.isFinite(numericDeduction) || numericDeduction < 0 || numericDeduction > Number(claim?.requested_amount)) {
      setNoticeError("Potongan non-cover harus berada di antara Rp0 dan nominal pengajuan."); return;
    }
    if (numericDeduction > 0 && reason.trim().length < 8) {
      setNoticeError("Tuliskan alasan potongan minimal 8 karakter."); return;
    }
    setPreviewLoading(true); setPreview(null); setPreviewKey("");
    try {
      const response = await api.post<ApiEnvelope<AdjudicationPreview>>(`/api/claims/${encodeURIComponent(code)}/adjudicate-preview`, { non_cover_deduction: numericDeduction, deduction_reason: reason.trim() });
      setPreview(response.data);
      setPreviewKey(currentPreviewKey);
    } catch (cause) { setNoticeError(cause instanceof Error ? cause.message : "Simulasi adjudikasi gagal."); }
    finally { setPreviewLoading(false); }
  }

  async function submitDecision(event: React.FormEvent) {
    event.preventDefault(); setNotice(""); setNoticeError("");
    if (decision === "APPROVED" && !previewIsCurrent) {
      setNoticeError("Hitung ulang simulasi setelah mengubah potongan sebelum menyetujui klaim."); return;
    }
    const numericDeduction = Number(deduction);
    if (decision === "APPROVED" && numericDeduction > 0 && reason.trim().length < 8) {
      setNoticeError("Tuliskan alasan potongan minimal 8 karakter."); return;
    }
    if (decision !== "APPROVED" && notes.trim().length < 8) {
      setNoticeError("Berikan catatan minimal 8 karakter untuk revisi atau penolakan."); return;
    }
    const verb = decision === "APPROVED" ? "menyetujui" : decision === "REJECTED" ? "menolak" : "meminta revisi";
    if (!window.confirm(`Konfirmasi ${verb} klaim ${code}? Keputusan akan dikirim ke backend dan diteruskan ke rumah sakit.`)) return;
    setSaving(true);
    try {
      const response = await api.post<ApiEnvelope<{ decision: string; message?: string }>>(`/api/claims/${encodeURIComponent(code)}/decide`, {
        decision,
        ...(decision === "APPROVED" && previewIsCurrent && preview ? { approved_amount: preview.recommended_approved_amount } : {}),
        non_cover_deduction: decision === "APPROVED" ? numericDeduction : 0,
        deduction_reason: decision === "APPROVED" ? reason.trim() : "",
        reviewer_notes: notes.trim(),
      });
      setNotice(response.data.message || "Keputusan adjudikasi berhasil dikirim ke rumah sakit.");
      load();
    } catch (cause) { setNoticeError(cause instanceof Error ? cause.message : "Keputusan tidak berhasil dikirim."); }
    finally { setSaving(false); }
  }

  if (loading && !claim) return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Memuat detail klaim…</div>;
  if (error || !claim) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-800">{error || "Klaim tidak ditemukan."}<Link href="/claims" className="ml-3 font-bold underline">Kembali ke antrean</Link></div>;

  return <div className="space-y-6">
    <Link href="/claims" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-violet-800"><ArrowLeft size={15} /> Kembali ke antrean</Link>
    <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#282344] p-6 text-white md:flex-row md:items-center md:p-8"><div><div className="flex flex-wrap items-center gap-3"><p className="text-xs font-bold uppercase tracking-[.14em] text-violet-200">Adjudikasi klaim sekunder</p><StatusBadge status={claim.status} /></div><h1 className="mt-3 text-2xl font-extrabold">{claim.subclaim_code}</h1><p className="mt-1 text-sm text-violet-50/70">{claim.case_number} · {claim.hospital_name}</p></div><div className="flex items-center gap-2"><ShieldCheck size={22} className="text-violet-200" /><div><p className="text-[10px] uppercase tracking-wider text-violet-50/60">Nominal diajukan</p><p className="mt-1 text-xl font-extrabold">{rupiah(claim.requested_amount)}</p></div></div></div>
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    {noticeError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{noticeError}</div>}
    <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <div className="space-y-5">
        <Panel title="Data pasien" eyebrow="Identitas klaim"><Snapshot value={claim.patient} /></Panel>
        <Panel title="Polis & manfaat" eyebrow="Perlindungan asuransi"><Snapshot value={claim.policy} /></Panel>
        <Panel title="Informasi klinis & biaya" eyebrow="Ringkasan klaim"><Snapshot value={claim.clinical} /><div className="border-t border-slate-100"><Snapshot value={claim.cost_breakdown} money /></div></Panel>
        <Panel title="Dokumen klaim" eyebrow="Berkas pendukung"><Documents value={claim.documents} /></Panel>
        <Panel title="Riwayat adjudikasi" eyebrow="Jejak audit" action={<History size={16} className="text-slate-400" />}><div className="divide-y divide-slate-100">{claim.logs?.length ? claim.logs.map((log, index) => <div key={`${log.created_at}-${index}`} className="px-5 py-4"><div className="flex justify-between gap-4"><p className="text-xs font-bold text-slate-800">{(log.action || "Aktivitas").replaceAll("_", " ")}</p><time className="shrink-0 text-[10px] text-slate-400">{dateTime(log.created_at)}</time></div><p className="mt-1 text-xs text-slate-500">{log.notes || "—"} · {log.actor_name || "Sistem"}</p></div>) : <p className="px-5 py-6 text-sm text-slate-500">Belum ada riwayat klaim.</p>}</div></Panel>
      </div>
      <div className="space-y-5 xl:sticky xl:top-[90px]">
        <Panel title="Simulasi potongan non-cover" eyebrow="Preview adjudikasi" action={<Sparkles size={16} className="text-violet-600" />}>
          <form onSubmit={calculatePreview} className="space-y-4 p-5">
            <label className="block text-xs font-bold text-slate-700">Potongan non-cover<input type="number" min="0" max={claim.requested_amount} step="1" value={deduction} onChange={(event) => { setDeduction(event.target.value); setPreview(null); }} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-600" /><span className="mt-1 block font-medium text-slate-400">Maksimal {rupiah(claim.requested_amount)}</span></label>
            <label className="block text-xs font-bold text-slate-700">Alasan potongan<textarea value={reason} onChange={(event) => { setReason(event.target.value); setPreview(null); }} rows={3} maxLength={1000} placeholder="Sebutkan item non-cover dan dasar ketentuan polis…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-600" /><span className="mt-1 block text-right text-[10px] font-medium text-slate-400">{reason.length}/1000</span></label>
            <button disabled={previewLoading} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50"><Sparkles size={15} />{previewLoading ? "Menghitung preview…" : "Hitung rekomendasi"}</button>
          </form>
          {previewIsCurrent && preview && <div className="border-t border-slate-100 bg-violet-50/50 p-5"><div className="mb-4 flex items-center gap-2 text-xs font-extrabold text-emerald-700"><CheckCircle2 size={16} /> Hasil simulasi dari backend</div><div className="grid grid-cols-2 gap-3"><Result label="Rekomendasi persetujuan" value={rupiah(preview.recommended_approved_amount)} highlight /><Result label="Dampak ekses pasien" value={rupiah(preview.final_patient_excess)} /><Result label="Ekses awal pasien" value={rupiah(preview.initial_patient_excess)} /><Result label="Porsi tagihan ter-cover" value={`${preview.coverage_percentage_of_total_bill}%`} /></div></div>}
          {claim.approved_amount !== undefined && claim.status === "APPROVED" && <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600">Nominal disetujui sebelumnya: <strong>{rupiah(claim.approved_amount)}</strong> · Potongan {rupiah(claim.non_cover_deduction)}</div>}
        </Panel>
        <Panel title="Kirim keputusan" eyebrow="Ke rumah sakit">
          <div className="border-b border-slate-100 px-5 py-4"><p className="text-xs font-bold text-slate-700">Status pemeriksaan</p><p className="mt-1 text-xs text-slate-500">Tandai klaim sedang ditinjau sebelum menyimpan adjudikasi.</p><button disabled={claim.status !== "SUBMITTED"} onClick={markInReview} className="mt-3 w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50">{claim.status === "SUBMITTED" ? "Mulai pemeriksaan" : "Klaim sudah diproses"}</button></div>
          <form onSubmit={submitDecision} className="space-y-4 p-5">
            <label className="block text-xs font-bold text-slate-700">Keputusan<select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-violet-600"><option value="APPROVED">Setujui klaim</option><option value="REVISION_REQUIRED">Minta revisi berkas</option><option value="REJECTED">Tolak klaim</option></select></label>
            {decision === "APPROVED" && <div className={`rounded-xl px-3 py-3 text-xs ${previewIsCurrent ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{previewIsCurrent && preview ? <>Nominal persetujuan yang akan dikirim: <strong>{rupiah(preview.recommended_approved_amount)}</strong></> : "Jalankan simulasi terbaru sebelum menyetujui klaim."}</div>}
            <label className="block text-xs font-bold text-slate-700">Catatan adjudikator<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={2000} placeholder="Tuliskan dasar keputusan dan catatan untuk rumah sakit…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-600" /><span className="mt-1 block text-right text-[10px] font-medium text-slate-400">{notes.length}/2000</span></label>
            {claim.reviewer_notes && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><span className="font-bold">Catatan sebelumnya:</span> {claim.reviewer_notes}</p>}
            <button disabled={saving || claim.status === "APPROVED" || claim.status === "REJECTED" || (decision === "APPROVED" && !previewIsCurrent)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-800 px-4 text-sm font-bold text-white hover:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-50"><Check size={16} />{saving ? "Mengirim keputusan…" : "Konfirmasi keputusan"}</button>
            <p className="text-[10px] leading-relaxed text-slate-400">Rekomendasi dan dampak ekses dihitung oleh backend. Keputusan dikirim ke layanan asuransi dan diteruskan ke rumah sakit.</p>
          </form>
        </Panel>
      </div>
    </div>
  </div>;
}

function Result({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded-xl p-3 ${highlight ? "bg-white ring-1 ring-violet-100" : "bg-white/70"}`}><p className="text-[10px] font-semibold text-slate-500">{label}</p><p className={`mt-1 text-sm font-extrabold ${highlight ? "text-violet-800" : "text-slate-800"}`}>{value}</p></div>;
}

function Snapshot({ value, money = false }: { value?: Record<string, unknown>; money?: boolean }) {
  const entries = Object.entries(value ?? {}).filter(([, item]) => item !== null && item !== undefined && item !== "");
  if (!entries.length) return <p className="px-5 py-5 text-xs text-slate-400">Informasi belum tersedia pada paket klaim.</p>;
  return <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">{entries.map(([key, item]) => <div key={key} className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{key.replaceAll("_", " ")}</dt><dd className="mt-1 break-words text-xs font-semibold text-slate-700">{formatValue(key, item, money)}</dd></div>)}</dl>;
}

function formatValue(key: string, value: unknown, money: boolean): string {
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number" && (money || /amount|limit|benefit|bill|excess|premium|room/i.test(key))) return rupiah(value);
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
    const valid = state.toLowerCase().includes("valid");
    return <div key={`${label}-${index}`} className="flex items-center gap-3 px-5 py-3.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600"><FileText size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{label}</p><p className="mt-0.5 text-[10px] text-slate-500">{state}</p></div>{valid ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Circle size={16} className="text-slate-300" />}</div>;
  })}</div>;
}
