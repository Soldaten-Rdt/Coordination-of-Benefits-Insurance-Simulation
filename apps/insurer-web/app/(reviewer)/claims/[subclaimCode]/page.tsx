"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, BadgeCheck, Banknote, Check, CheckCircle2, Circle, ClipboardList,
  FileText, History, Hospital, Sparkles,
} from "lucide-react";
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
    setLoading(true);
    setError("");
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
  const patient = claim?.patient ?? {};
  const policy = claim?.policy ?? {};
  const clinical = claim?.clinical ?? {};
  const cost = claim?.cost_breakdown ?? {};
  const billItems = asRecords(cost.bill_items);
  const docs = asRecords(claim?.documents);

  async function markInReview() {
    setNotice("");
    setNoticeError("");
    try {
      await api.patch(`/api/claims/${encodeURIComponent(code)}/status`, { status: "IN_REVIEW", notes: "Klaim sekunder mulai ditinjau adjudikator." });
      setNotice("Status klaim diperbarui menjadi Dalam Review.");
      load();
    } catch (cause) {
      setNoticeError(cause instanceof Error ? cause.message : "Status klaim gagal diperbarui.");
    }
  }

  async function calculatePreview(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    setNoticeError("");
    const numericDeduction = Number(deduction);
    if (!Number.isFinite(numericDeduction) || numericDeduction < 0 || numericDeduction > Number(claim?.requested_amount)) {
      setNoticeError("Potongan non-cover harus berada di antara Rp0 dan nominal pengajuan.");
      return;
    }
    if (numericDeduction > 0 && reason.trim().length < 8) {
      setNoticeError("Tuliskan alasan potongan minimal 8 karakter.");
      return;
    }
    setPreviewLoading(true);
    setPreview(null);
    setPreviewKey("");
    try {
      const response = await api.post<ApiEnvelope<AdjudicationPreview>>(`/api/claims/${encodeURIComponent(code)}/adjudicate-preview`, { non_cover_deduction: numericDeduction, deduction_reason: reason.trim() });
      setPreview(response.data);
      setPreviewKey(currentPreviewKey);
    } catch (cause) {
      setNoticeError(cause instanceof Error ? cause.message : "Simulasi adjudikasi gagal.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function submitDecision(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    setNoticeError("");
    if (decision === "APPROVED" && !previewIsCurrent) {
      setNoticeError("Hitung ulang simulasi setelah mengubah potongan sebelum menyetujui klaim.");
      return;
    }
    const numericDeduction = Number(deduction);
    if (decision === "APPROVED" && numericDeduction > 0 && reason.trim().length < 8) {
      setNoticeError("Tuliskan alasan potongan minimal 8 karakter.");
      return;
    }
    if (decision !== "APPROVED" && notes.trim().length < 8) {
      setNoticeError("Berikan catatan minimal 8 karakter untuk revisi atau penolakan.");
      return;
    }
    const verb = decision === "APPROVED" ? "menyetujui" : decision === "REJECTED" ? "menolak" : "meminta revisi";
    if (!window.confirm(`Konfirmasi ${verb} klaim ${code}? Keputusan akan diteruskan ke rumah sakit.`)) return;
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
    } catch (cause) {
      setNoticeError(cause instanceof Error ? cause.message : "Keputusan tidak berhasil dikirim.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !claim) return <div className="rounded-lg border border-[#e5ebf3] bg-white p-10 text-center text-xs text-slate-500">Memuat detail klaim…</div>;
  if (error || !claim) return <div className="rounded-lg border border-rose-200 bg-rose-50 p-7 text-xs text-rose-800">{error || "Klaim tidak ditemukan."}<Link href="/claims" className="ml-2 font-bold underline">Kembali ke antrean</Link></div>;

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[9px] font-semibold text-slate-500"><Link href="/claims" className="hover:text-[#14516e]">Klaim Masuk</Link><span className="px-1 text-slate-300">›</span>{claim.subclaim_code}<span className="px-1 text-slate-300">›</span>Adjudikasi Manfaat Polis</div><Link href="/claims" className="inline-flex items-center gap-1 text-[9px] font-bold text-[#2e6685]"><ArrowLeft size={11} /> Kembali ke antrean</Link></div>
    <div className="rounded-lg border border-[#e3eaf3] bg-white px-3 py-3 shadow-[0_2px_8px_rgba(27,65,99,.035)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-[#eaf2ff] px-2 py-0.5 text-[8px] font-extrabold text-[#195776]">{claim.subclaim_code}</span><span className="text-[8px] text-slate-400">Kasus: {claim.case_number}</span><StatusBadge status={claim.status} /></div>
          <h1 className="mt-2 text-[17px] font-extrabold leading-tight text-[#123f59]">{stringValue(patient.full_name, "Pasien")}</h1>
          <p className="mt-1 text-[9px] text-slate-500">Polis: {stringValue(policy.plan_name, "Plan tidak tersedia")} · {stringValue(policy.card_or_policy_number, "Nomor polis tidak tersedia")} <span className="px-1 text-slate-300">•</span> {stringValue(policy.insurer_name ?? claim.insurer_entity_name, "Asuransi mitra")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HeaderDatum icon={Hospital} label="Fasilitas kesehatan" value={claim.hospital_name} />
          <HeaderDatum icon={Banknote} label="Pengajuan swasta" value={rupiah(claim.requested_amount)} />
          <HeaderDatum icon={BadgeCheck} label="Rekomendasi manfaat" value={previewIsCurrent && preview ? rupiah(preview.recommended_approved_amount) : claim.status === "APPROVED" ? rupiah(claim.approved_amount) : "Belum dihitung"} />
          {claim.status === "SUBMITTED" && <button onClick={markInReview} className="inline-flex h-9 items-center gap-1.5 self-center rounded-md border border-[#cbddea] bg-[#f2f7fc] px-2.5 text-[9px] font-bold text-[#245a78] hover:bg-[#e8f1fa]"><FileText size={12} /> Mulai review</button>}
        </div>
      </div>
    </div>
    {notice && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-800">{notice}</div>}
    {noticeError && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{noticeError}</div>}

    <div className="grid items-start gap-3 xl:grid-cols-[1.25fr_.85fr]">
      <div className="space-y-3">
        <Panel title="Verifikasi Batas Manfaat Polis" eyebrow={stringValue(policy.plan_name, "Kelengkapan perlindungan polis")} action={<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700">Polis {stringValue(policy.status, "aktif")}</span>}>
          <div className="grid gap-2 p-3 sm:grid-cols-3">
            <PolicyMetric label="Plafon tahunan" value={policy.annual_limit} note={`Sisa ${rupiah(policy.remaining_limit)}`} />
            <PolicyMetric label="Manfaat kamar (RI)" value={policy.room_daily_limit} note={stringValue(policy.room_class, "Limit harian sesuai polis")} />
            <PolicyMetric label="Limit tindakan / manfaat" value={policy.procedure_limit ?? policy.benefit_limit} note={stringValue(policy.benefit_summary, "Mengikuti ketentuan polis aktif")} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#edf1f6] px-3 py-2 text-[8px] text-slate-500"><span>Nomor polis: <strong className="text-slate-700">{stringValue(policy.card_or_policy_number, "—")}</strong></span><span>Jenis perawatan: <strong className="text-slate-700">{stringValue(clinical.care_type, "—")}</strong></span><span>Kelas: <strong className="text-slate-700">{stringValue(policy.care_class, "—")}</strong></span></div>
        </Panel>

        <Panel title="Koordinasi Biaya Kasus (CoB Multi-Payer Breakdown)" eyebrow="Pembagian pembiayaan berdasarkan paket klaim" action={<span className="rounded bg-[#eff4fb] px-2 py-0.5 text-[8px] font-bold text-slate-500">{billItems.length} item</span>}>
          <div className="grid gap-2 bg-[#f8faff] p-3 sm:grid-cols-3"><MoneyCard label="Total tagihan RS" value={cost.total_hospital_bill} /><MoneyCard label="BPJS (primer)" value={cost.primary_payer_approved ?? cost.primary_payer_estimated} /><MoneyCard label="Diajukan ke asuransi" value={claim.requested_amount} emphasize /></div>
          {billItems.length ? <BillTable items={billItems} /> : <p className="px-3 py-4 text-[9px] text-slate-500">Rincian item tagihan tidak disertakan pada paket klaim.</p>}
        </Panel>

        <Panel title="Dokumen Klaim" eyebrow="Checklist dokumen berkas asuransi" action={<span className="rounded-full bg-[#eef4fc] px-2 py-0.5 text-[8px] font-bold text-[#3a6581]">{docs.length} dokumen</span>}>
          <DocumentList documents={docs} />
        </Panel>
        <Panel title="Riwayat Tahapan Klaim" eyebrow="Jejak proses" action={<History size={12} className="text-slate-400" />}>
          <div className="divide-y divide-[#eff2f6]">{claim.logs?.length ? claim.logs.map((log, index) => <div key={`${log.created_at}-${index}`} className="flex gap-2.5 px-3 py-2.5"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#edf4ff] text-[#356481]"><CheckCircle2 size={12} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold text-slate-700">{(log.action || "Aktivitas").replaceAll("_", " ")}</span><time className="text-[8px] text-slate-400">{dateTime(log.created_at)}</time></div><p className="mt-1 text-[8px] leading-3.5 text-slate-500">{log.notes || "—"} · {log.actor_name || "Sistem"}</p></div></div>) : <p className="px-3 py-5 text-[9px] text-slate-500">Belum ada riwayat klaim.</p>}</div>
        </Panel>
      </div>

      <div className="space-y-3 xl:sticky xl:top-[74px]">
        <Panel title="Kalkulasi Adjudikasi Klaim" eyebrow="Simulasi potongan non-cover" action={<span className="rounded bg-[#eff4fb] px-2 py-0.5 text-[8px] font-bold text-slate-500">Mode API</span>}>
          <form onSubmit={calculatePreview} className="space-y-3 p-3">
            <div className="flex justify-between gap-2 text-[9px]"><span className="text-slate-500">Nilai pengajuan RS (subklaim)</span><strong className="text-[#164b67]">{rupiah(claim.requested_amount)}</strong></div>
            <label className="block text-[9px] font-bold text-slate-600">Potongan item non-cover polis<span className="relative mt-1 block"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-rose-500">−Rp</span><input type="number" min="0" max={claim.requested_amount} step="1" value={deduction} onChange={(event) => { setDeduction(event.target.value); setPreview(null); }} className="h-9 w-full rounded-md border border-[#e3e8ef] bg-white pl-10 pr-2 text-[11px] font-bold text-rose-600 outline-none focus:border-[#3e7d9c]" /></span><span className="mt-1 block text-[8px] font-normal text-slate-400">Maksimal {rupiah(claim.requested_amount)}</span></label>
            <label className="block text-[9px] font-bold text-slate-600">Alasan potongan<textarea value={reason} onChange={(event) => { setReason(event.target.value); setPreview(null); }} rows={2} maxLength={1000} placeholder="Item non-cover dan dasar ketentuan polis…" className="mt-1 w-full resize-y rounded-md border border-[#e3e8ef] px-2.5 py-2 text-[9px] font-normal outline-none focus:border-[#3e7d9c]" /></label>
            <button disabled={previewLoading} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-[#cbddea] bg-[#f2f7fc] text-[9px] font-bold text-[#245a78] hover:bg-[#e8f1fa] disabled:opacity-50"><Sparkles size={12} />{previewLoading ? "Menghitung rekomendasi…" : "Hitung Preview Adjudikasi"}</button>
          </form>
          {previewIsCurrent && preview && <div className="border-t border-[#edf1f6] bg-[#f3f7ff] p-3"><div className="mb-2 flex items-center gap-1.5 text-[9px] font-extrabold text-emerald-700"><CheckCircle2 size={12} /> Preview dihitung oleh backend</div><div className="grid grid-cols-2 gap-2"><Result label="Direkomendasikan" value={rupiah(preview.recommended_approved_amount)} highlight /><Result label="Ekses pasien akhir" value={rupiah(preview.final_patient_excess)} /><Result label="Ekses awal pasien" value={rupiah(preview.initial_patient_excess)} /><Result label="Porsi tagihan ter-cover" value={`${preview.coverage_percentage_of_total_bill}%`} /></div></div>}
          {claim.status === "APPROVED" && <div className="border-t border-[#edf1f6] px-3 py-2 text-[8px] text-slate-500">Keputusan tersimpan: <strong className="text-[#24546f]">{rupiah(claim.approved_amount)}</strong> disetujui · Potongan {rupiah(claim.non_cover_deduction)}.</div>}
        </Panel>
        <Panel title="Catatan Memo Reviewer & Tim Billing RS" eyebrow="Klarifikasi dan dasar keputusan">
          <div className="p-3"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={2000} placeholder="Catatan untuk rumah sakit atau dasar adjudikasi…" className="w-full resize-y rounded-md border border-[#e3e8ef] px-2.5 py-2 text-[9px] outline-none focus:border-[#3e7d9c]" /><div className="mt-1 text-right text-[8px] text-slate-400">{notes.length}/2000</div>{claim.reviewer_notes && <p className="mt-2 rounded-md bg-[#f5f8fc] p-2 text-[8px] leading-3.5 text-slate-500"><strong>Catatan sebelumnya:</strong> {claim.reviewer_notes}</p>}</div>
        </Panel>
        <Panel title="Kirim Keputusan" eyebrow="Adjudikasi manfaat polis" action={<ClipboardList size={12} className="text-slate-400" />}>
          <div className="border-b border-[#edf1f6] px-3 py-2.5"><p className="text-[9px] font-bold text-slate-600">Status pemeriksaan: <StatusBadge status={claim.status} /></p><p className="mt-1 text-[8px] text-slate-400">Perbarui status klaim saat mulai atau melanjutkan pemeriksaan.</p>{claim.status === "SUBMITTED" && <button onClick={markInReview} className="mt-2 rounded-md border border-[#cbddea] bg-[#f2f7fc] px-2.5 py-1.5 text-[8px] font-bold text-[#245a78] hover:bg-[#e8f1fa]">Mulai Review</button>}</div>
          <form onSubmit={submitDecision} className="p-3">
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Pilih keputusan klaim"><DecisionChoice value="APPROVED" current={decision} label="Setujui Klaim" onSelect={setDecision} /><DecisionChoice value="REVISION_REQUIRED" current={decision} label="Minta Klarifikasi" onSelect={setDecision} /><DecisionChoice value="REJECTED" current={decision} label="Tolak Klaim" onSelect={setDecision} /></div>
            {decision === "APPROVED" && <div className={`mt-2 rounded-md px-2.5 py-2 text-[9px] ${previewIsCurrent ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{previewIsCurrent && preview ? <>Nilai disetujui: <strong>{rupiah(preview.recommended_approved_amount)}</strong></> : "Hitung preview terbaru sebelum menyetujui klaim."}</div>}
            <button disabled={saving || claim.status === "APPROVED" || claim.status === "REJECTED" || (decision === "APPROVED" && !previewIsCurrent)} className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#0b4562] px-3 text-[10px] font-extrabold text-white hover:bg-[#07384f] disabled:cursor-not-allowed disabled:opacity-50"><Check size={13} />{saving ? "Mengirim keputusan…" : decision === "APPROVED" && preview ? `Setujui Klaim (${rupiah(preview.recommended_approved_amount)})` : "Konfirmasi Keputusan"}</button>
            <p className="mt-2 text-[8px] leading-3.5 text-slate-400">Keputusan dikirim ke backend asuransi dan diteruskan ke Hospital Service.</p>
          </form>
        </Panel>
      </div>
    </div>
  </div>;
}

function HeaderDatum({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="flex items-center gap-1.5 rounded-md border border-[#e8edf4] bg-[#fafbfd] px-2 py-1.5"><Icon size={12} className="text-[#49708a]" /><span><span className="block text-[7px] text-slate-400">{label}</span><strong className="block max-w-[130px] truncate text-[8px] text-slate-600">{value}</strong></span></div>;
}

function PolicyMetric({ label, value, note }: { label: string; value: unknown; note: string }) {
  return <div className="rounded-md border border-[#e7edf5] bg-[#f4f7fd] p-2.5"><p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-[12px] font-extrabold text-[#214f6c]">{value === undefined || value === null ? "—" : rupiah(value)}</p><p className="mt-1 text-[8px] leading-3 text-slate-500">{note}</p></div>;
}

function MoneyCard({ label, value, emphasize = false }: { label: string; value: unknown; emphasize?: boolean }) {
  return <div className={`rounded-md border p-2.5 ${emphasize ? "border-[#cfe0ee] bg-[#edf5ff]" : "border-[#e8edf4] bg-white"}`}><p className="text-[8px] font-semibold text-slate-500">{label}</p><p className={`mt-1 text-[12px] font-extrabold ${emphasize ? "text-[#15506f]" : "text-slate-700"}`}>{value === undefined || value === null ? "—" : rupiah(value)}</p></div>;
}

function Result({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded-md p-2 ${highlight ? "bg-white ring-1 ring-[#dbe5f3]" : "bg-white/70"}`}><p className="text-[8px] font-semibold text-slate-500">{label}</p><p className={`mt-1 text-[10px] font-extrabold ${highlight ? "text-[#174e6c]" : "text-slate-800"}`}>{value}</p></div>;
}

function DecisionChoice({ value, current, label, onSelect }: { value: "APPROVED" | "REVISION_REQUIRED" | "REJECTED"; current: string; label: string; onSelect: (value: "APPROVED" | "REVISION_REQUIRED" | "REJECTED") => void }) {
  return <button type="button" onClick={() => onSelect(value)} aria-pressed={current === value} className={`min-h-8 rounded-md border px-1.5 py-1 text-[8px] font-bold transition ${current === value ? value === "APPROVED" ? "border-[#0b4562] bg-[#0b4562] text-white" : value === "REJECTED" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-amber-400 bg-amber-50 text-amber-700" : "border-[#e3e9f1] bg-white text-slate-500 hover:bg-slate-50"}`}>{label}</button>;
}

function BillTable({ items }: { items: Record<string, unknown>[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead className="bg-[#fafbfd] text-[8px] font-bold uppercase text-slate-500"><tr><th className="px-3 py-2">Kategori tagihan</th><th className="px-3 py-2">Deskripsi</th><th className="px-3 py-2 text-right">Tagihan RS</th><th className="px-3 py-2 text-right">BPJS primer</th><th className="px-3 py-2 text-right">Porsi asuransi</th><th className="px-3 py-2 text-right">Ekses pasien</th></tr></thead><tbody className="divide-y divide-[#eff2f6]">{items.map((item, index) => <tr key={`${String(item.description ?? item.category)}-${index}`}><td className="px-3 py-2 text-[8px] text-slate-500">{stringValue(item.category, "—")}</td><td className="px-3 py-2 text-[8px] font-semibold text-slate-600">{stringValue(item.description, "Item tagihan")}</td><td className="whitespace-nowrap px-3 py-2 text-right text-[8px] text-slate-600">{rupiah(item.subtotal)}</td><td className="whitespace-nowrap px-3 py-2 text-right text-[8px] text-slate-600">{rupiah(item.bpjs_portion)}</td><td className="whitespace-nowrap px-3 py-2 text-right text-[8px] font-bold text-[#265b78]">{rupiah(item.insurer_portion)}</td><td className="whitespace-nowrap px-3 py-2 text-right text-[8px] text-rose-600">{rupiah(item.patient_portion)}</td></tr>)}</tbody></table></div>;
}

function DocumentList({ documents }: { documents: Record<string, unknown>[] }) {
  if (!documents.length) return <p className="px-3 py-5 text-[9px] text-slate-500">Belum ada dokumen pada paket klaim.</p>;
  return <div className="divide-y divide-[#eff2f6]">{documents.map((doc, index) => {
    const title = stringValue(doc.doc_type ?? doc.document_type ?? doc.file_name ?? doc.name, `Dokumen ${index + 1}`);
    const state = stringValue(doc.validation_status ?? doc.status, "Terlampir");
    const valid = state.toUpperCase() === "VALID";
    return <div key={`${title}-${index}`} className="flex items-center gap-2.5 px-3 py-2"><span className={`grid h-7 w-7 place-items-center rounded-md ${valid ? "bg-[#edf4ff] text-[#356481]" : "bg-amber-50 text-amber-700"}`}><FileText size={13} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-[9px] text-slate-700">{title}</strong><span className="block truncate text-[8px] text-slate-400">{stringValue(doc.file_name, "Dokumen pendukung")}</span></span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold ${valid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{valid ? <CheckCircle2 size={10} /> : <Circle size={10} />}{state}</span></div>;
  })}</div>;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([name, detail]) => typeof detail === "object" && detail !== null ? { name, ...(detail as Record<string, unknown>) } : { name, status: detail });
  return [];
}

function stringValue(value: unknown, fallback: string): string {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}
