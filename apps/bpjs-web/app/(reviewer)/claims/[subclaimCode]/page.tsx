"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, CalendarDays, Check, CheckCircle2, Circle,
  Clock3, FileCheck2, FileText, History, Hospital, ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { dateTime, rupiah } from "@/lib/format";
import { Panel, StatusBadge } from "@/components/ui";
import type { ApiEnvelope, ClaimDetail } from "@/types";

const complianceItems = [
  ["jkn_active", "Kepesertaan JKN aktif"],
  ["referral_valid", "Surat rujukan / indikasi gawat darurat valid"],
  ["icd_coding_match", "Kesesuaian koding ICD-10 & ICD-9-CM"],
  ["no_duplicate_claim", "Pencegahan klaim ganda (duplikasi)"],
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
    setLoading(true);
    setError("");
    api.get<ApiEnvelope<ClaimDetail>>(`/api/claims/${encodeURIComponent(code)}`)
      .then((response) => {
        setClaim(response.data);
        setAmount(String(response.data.requested_amount ?? 0));
        if (response.data.compliance_checks) setChecks((current) => ({ ...current, ...response.data.compliance_checks }));
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Detail klaim gagal dimuat."))
      .finally(() => setLoading(false));
  }, [code]);
  React.useEffect(() => { load(); }, [load]);

  async function markInReview() {
    setNotice("");
    setNoticeError("");
    try {
      await api.patch(`/api/claims/${encodeURIComponent(code)}/status`, { status: "IN_REVIEW", notes: "Klaim mulai diperiksa reviewer." });
      setNotice("Status klaim diperbarui menjadi Dalam Review.");
      load();
    } catch (cause) {
      setNoticeError(cause instanceof Error ? cause.message : "Status klaim gagal diperbarui.");
    }
  }

  async function submitDecision(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    setNoticeError("");
    const numericAmount = Number(amount);
    if (decision === "APPROVED" && (!Number.isFinite(numericAmount) || numericAmount < 0 || numericAmount > Number(claim?.requested_amount))) {
      setNoticeError("Nominal persetujuan harus berada di antara Rp0 dan nominal pengajuan.");
      return;
    }
    if (decision === "APPROVED" && complianceItems.some(([key]) => !checks[key])) {
      setNoticeError("Lengkapi seluruh checklist kepatuhan sebelum menyetujui klaim.");
      return;
    }
    if (decision !== "APPROVED" && notes.trim().length < 8) {
      setNoticeError("Berikan catatan minimal 8 karakter untuk revisi atau penolakan.");
      return;
    }
    const verb = decision === "APPROVED" ? "menyetujui" : decision === "REJECTED" ? "menolak" : "meminta revisi";
    if (!window.confirm(`Konfirmasi ${verb} klaim ${code}? Keputusan akan dikirim ke BPJS Service dan diteruskan ke rumah sakit.`)) return;
    setSaving(true);
    try {
      const result = await api.post<ApiEnvelope<{ decision: string; message?: string }>>(`/api/claims/${encodeURIComponent(code)}/decide`, {
        decision,
        ...(decision === "APPROVED" ? { approved_amount: numericAmount } : {}),
        compliance_checks: checks,
        reviewer_notes: notes.trim(),
      });
      setNotice(result.data.message || "Keputusan berhasil diteruskan ke rumah sakit.");
      load();
    } catch (cause) {
      setNoticeError(cause instanceof Error ? cause.message : "Keputusan tidak berhasil dikirim.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !claim) return <div className="rounded-lg border border-[#e5ebf3] bg-white p-10 text-center text-xs text-slate-500">Memuat detail klaim…</div>;
  if (error || !claim) return <div className="rounded-lg border border-rose-200 bg-rose-50 p-7 text-xs text-rose-800">{error || "Klaim tidak ditemukan."}<Link href="/claims" className="ml-2 font-bold underline">Kembali ke antrean</Link></div>;

  const patient = claim.patient ?? {};
  const coverage = claim.coverage ?? {};
  const clinical = claim.clinical ?? {};
  const financial = claim.financial ?? {};
  const billItems = asRecords(financial.bill_items);
  const docs = asRecords(claim.documents);
  const slaHours = claim.sla_deadline ? Math.ceil((new Date(claim.sla_deadline).getTime() - Date.now()) / 3600000) : null;

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-[9px] font-semibold text-slate-500"><Link href="/claims" className="hover:text-[#14516e]">Klaim Masuk</Link><span className="px-1 text-slate-300">›</span>{claim.subclaim_code}<span className="px-1 text-slate-300">›</span>Review Verifikasi Klinis & Tarif</div>
      <Link href="/claims" className="inline-flex items-center gap-1 text-[9px] font-bold text-[#2e6685]"><ArrowLeft size={11} /> Kembali ke antrean</Link>
    </div>
    <div className="rounded-lg border border-[#e3eaf3] bg-white px-3 py-3 shadow-[0_2px_8px_rgba(27,65,99,.035)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-[#eaf2ff] px-2 py-0.5 text-[8px] font-extrabold text-[#195776]">{claim.subclaim_code}</span><span className="text-[8px] text-slate-400">No. Kasus: {claim.case_number}</span><StatusBadge status={claim.status} /></div>
          <h1 className="mt-2 text-[17px] font-extrabold leading-tight text-[#123f59]">{stringValue(patient.full_name, "Pasien")}</h1>
          <p className="mt-1 text-[9px] text-slate-500">{stringValue(patient.nik, "NIK tidak tersedia")} <span className="px-1 text-slate-300">•</span> {stringValue(coverage.card_or_policy_number, "Kepesertaan tidak tersedia")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HeaderDatum icon={Hospital} label="Fasilitas kesehatan" value={claim.hospital_name} />
          <HeaderDatum icon={CalendarDays} label="Diterima" value={dateTime(String(claim.created_at ?? ""))} />
          {typeof slaHours === "number" && <HeaderDatum icon={Clock3} label="SLA" value={slaHours > 0 ? `${slaHours} jam tersisa` : "SLA terlewati"} danger={slaHours <= 24} />}
          {claim.status === "SUBMITTED" && <button onClick={markInReview} className="inline-flex h-9 items-center gap-1.5 self-center rounded-md border border-[#cbddea] bg-[#f2f7fc] px-2.5 text-[9px] font-bold text-[#245a78] hover:bg-[#e8f1fa]"><FileCheck2 size={12} /> Mulai review</button>}
        </div>
      </div>
    </div>

    {notice && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-800">{notice}</div>}
    {noticeError && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{noticeError}</div>}
    <div className="flex items-start gap-2 rounded-lg border border-[#dce8f6] bg-[#edf4ff] px-3 py-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white text-[#27617e]"><ShieldCheck size={13} /></span><p className="text-[9px] leading-4 text-slate-600"><strong className="text-[#244f6b]">Koordinasi Manfaat (CoB):</strong> BPJS bertindak sebagai penjamin primer. Selisih upgrade kelas atau kelebihan tagihan mengikuti ketentuan penjamin sekunder.</p></div>

    <div className="grid items-start gap-3 xl:grid-cols-[1.25fr_.85fr]">
      <div className="space-y-3">
        <Panel title="Ringkasan Klinis & Rawat" eyebrow="Informasi medis pasien">
          <div className="grid gap-2 p-3 md:grid-cols-3">
            <InfoCard label="Diagnosis utama (ICD-10)" value={stringValue(clinical.diagnosis_icd10, "Belum tersedia")} detail={stringValue(clinical.diagnosis_desc, "")} />
            <InfoCard label="Prosedur medis (ICD-9-CM)" value={stringValue(clinical.procedure_icd9, "Belum tersedia")} detail={stringValue(clinical.procedure_desc, "")} />
            <InfoCard label="Ruang & hak perawatan" value={stringValue(clinical.room_name, stringValue(coverage.care_class, "Belum tersedia"))} detail={`${stringValue(clinical.care_type, "Jenis perawatan tidak tersedia")} · kelas ${stringValue(clinical.entitled_class, "—")}`} />
          </div>
          <div className="grid gap-2 border-t border-[#edf1f6] px-3 py-2.5 sm:grid-cols-3">
            <KeyValue label="Dokter penanggung jawab" value={clinical.dpjp_name} />
            <KeyValue label="Tanggal masuk" value={clinical.admission_date} />
            <KeyValue label="Nomor SEP" value={financial.sep_number ?? coverage.sep_number} />
          </div>
        </Panel>

        <Panel title="Breakdown Finansial & INA-CBGs Basis" eyebrow="Rincian pengajuan">
          <div className="grid gap-2 bg-[#f8faff] p-3 sm:grid-cols-3">
            <MoneyCard label="Total tagihan RS" value={financial.total_hospital_bill} />
            <MoneyCard label="Tarif referensi INA-CBGs" value={financial.reference_tariff} />
            <MoneyCard label="Nominal diajukan ke BPJS" value={claim.requested_amount} emphasize />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-y border-[#edf1f6] px-3 py-2 text-[9px]"><span className="font-bold text-slate-600">Kode INA-CBG: {stringValue(financial.ina_cbg_code, "—")}</span><span className="text-slate-500">Porsi penjamin primer mengikuti nilai pengajuan pada backend.</span></div>
          {billItems.length ? <BillTable items={billItems} /> : <p className="px-3 py-4 text-[9px] text-slate-500">Rincian item tagihan tidak disertakan pada paket klaim.</p>}
        </Panel>

        <Panel title="Dokumen Pendukung Subklaim" eyebrow="Pemeriksaan kelengkapan" action={<span className="rounded-full bg-[#eef4fc] px-2 py-0.5 text-[8px] font-bold text-[#3a6581]">{docs.length} dokumen</span>}>
          <DocumentList documents={docs} />
        </Panel>
      </div>

      <div className="space-y-3 xl:sticky xl:top-[74px]">
        <Panel title="Panel Review & Keputusan" eyebrow={`Verifikator: ${stringValue(claim.reviewer_notes, "BPJS KCU")}`}>
          <form onSubmit={submitDecision} className="p-3">
            <p className="mb-2 text-[8px] font-extrabold uppercase tracking-wide text-slate-500">Checklist Kepatuhan Administrasi & Regulasi</p>
            <div className="space-y-1 rounded-md bg-[#f6f8fc] p-2">{complianceItems.map(([key, label]) => <label key={key} className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1.5 text-[9px] font-medium text-slate-600 hover:bg-white"><input type="checkbox" checked={Boolean(checks[key])} onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))} className="mt-0.5 h-3.5 w-3.5 accent-[#0b5675]" /><span>{label}</span></label>)}</div>
            <div className="mt-3 grid grid-cols-3 gap-1.5" role="group" aria-label="Pilih keputusan klaim">
              <DecisionChoice value="APPROVED" current={decision} label="Setujui Klaim" onSelect={setDecision} />
              <DecisionChoice value="REVISION_REQUIRED" current={decision} label="Minta Revisi" onSelect={setDecision} />
              <DecisionChoice value="REJECTED" current={decision} label="Tolak Klaim" onSelect={setDecision} />
            </div>
            {decision === "APPROVED" && <label className="mt-3 block text-[9px] font-bold text-slate-600">Nilai akhir disetujui (IDR)<span className="relative mt-1 block"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">Rp</span><input type="number" min="0" max={claim.requested_amount} step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} className="h-9 w-full rounded-md border border-[#e3e8ef] bg-white pl-8 pr-2 text-[11px] font-extrabold text-[#164b67] outline-none focus:border-[#3e7d9c]" /></span><span className="mt-1 block text-[8px] font-normal text-slate-400">Maksimal {rupiah(claim.requested_amount)}</span></label>}
            <label className="mt-3 block text-[9px] font-bold text-slate-600">Catatan reviewer<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={2000} placeholder="Catatan verifikasi untuk rumah sakit…" className="mt-1 w-full resize-y rounded-md border border-[#e3e8ef] px-2.5 py-2 text-[9px] font-normal outline-none focus:border-[#3e7d9c]" /></label>
            {claim.reviewer_notes && <p className="mt-2 rounded-md bg-[#f5f8fc] p-2 text-[8px] text-slate-500"><strong>Catatan tersimpan:</strong> {claim.reviewer_notes}</p>}
            <button disabled={saving || claim.status === "APPROVED" || claim.status === "REJECTED"} className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#0b4562] px-3 text-[10px] font-extrabold text-white hover:bg-[#07384f] disabled:cursor-not-allowed disabled:opacity-50"><Check size={13} />{saving ? "Mengirim keputusan…" : "Konfirmasi Keputusan"}</button>
            <p className="mt-2 text-[8px] leading-3.5 text-slate-400">Keputusan akan diteruskan backend kepada Hospital Service dan dicatat pada audit klaim.</p>
          </form>
        </Panel>
        <Panel title="Riwayat Subklaim" eyebrow="Jejak proses" action={<History size={12} className="text-slate-400" />}>
          <div className="divide-y divide-[#eff2f6]">{claim.logs?.length ? claim.logs.map((log, index) => <div key={`${log.created_at}-${index}`} className="px-3 py-2.5"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold text-slate-700">{(log.action || "Aktivitas").replaceAll("_", " ")}</span><time className="text-[8px] text-slate-400">{dateTime(log.created_at)}</time></div><p className="mt-1 text-[8px] leading-3.5 text-slate-500">{log.notes || "—"} · {log.actor_name || "Sistem"}</p></div>) : <p className="px-3 py-5 text-[9px] text-slate-500">Belum ada riwayat klaim.</p>}</div>
        </Panel>
      </div>
    </div>
  </div>;
}

function HeaderDatum({ icon: Icon, label, value, danger = false }: { icon: React.ElementType; label: string; value: string; danger?: boolean }) {
  return <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${danger ? "border-rose-200 bg-rose-50" : "border-[#e8edf4] bg-[#fafbfd]"}`}><Icon size={12} className={danger ? "text-rose-600" : "text-[#49708a]"} /><span><span className="block text-[7px] text-slate-400">{label}</span><strong className={`block max-w-[125px] truncate text-[8px] ${danger ? "text-rose-700" : "text-slate-600"}`}>{value}</strong></span></div>;
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-md border border-[#e7edf5] bg-[#f4f7fd] p-2.5"><p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-[10px] font-extrabold text-[#214f6c]">{value}</p>{detail && <p className="mt-1 line-clamp-2 text-[8px] leading-3 text-slate-500">{detail}</p>}</div>;
}

function KeyValue({ label, value }: { label: string; value: unknown }) {
  return <div><p className="text-[8px] font-bold uppercase text-slate-400">{label}</p><p className="mt-0.5 truncate text-[9px] font-semibold text-slate-600">{stringValue(value, "—")}</p></div>;
}

function MoneyCard({ label, value, emphasize = false }: { label: string; value: unknown; emphasize?: boolean }) {
  return <div className={`rounded-md border p-2.5 ${emphasize ? "border-[#cfe0ee] bg-[#edf5ff]" : "border-[#e8edf4] bg-white"}`}><p className="text-[8px] font-semibold text-slate-500">{label}</p><p className={`mt-1 text-[12px] font-extrabold ${emphasize ? "text-[#15506f]" : "text-slate-700"}`}>{rupiah(value)}</p></div>;
}

function DecisionChoice({ value, current, label, onSelect }: { value: "APPROVED" | "REVISION_REQUIRED" | "REJECTED"; current: string; label: string; onSelect: (value: "APPROVED" | "REVISION_REQUIRED" | "REJECTED") => void }) {
  return <button type="button" onClick={() => onSelect(value)} aria-pressed={current === value} className={`min-h-8 rounded-md border px-1.5 py-1 text-[8px] font-bold transition ${current === value ? value === "APPROVED" ? "border-[#0b4562] bg-[#0b4562] text-white" : value === "REJECTED" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-amber-400 bg-amber-50 text-amber-700" : "border-[#e3e9f1] bg-white text-slate-500 hover:bg-slate-50"}`}>{label}</button>;
}

function BillTable({ items }: { items: Record<string, unknown>[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead className="bg-[#fafbfd] text-[8px] font-bold uppercase text-slate-500"><tr><th className="px-3 py-2">Kategori tagihan</th><th className="px-3 py-2">Bill item</th><th className="px-3 py-2 text-right">Tagihan</th><th className="px-3 py-2 text-right">Porsi BPJS</th></tr></thead><tbody className="divide-y divide-[#eff2f6]">{items.map((item, index) => <tr key={`${String(item.description ?? item.category)}-${index}`}><td className="px-3 py-2 text-[8px] text-slate-500">{stringValue(item.category, "—")}</td><td className="px-3 py-2 text-[8px] font-semibold text-slate-600">{stringValue(item.description, "Item tagihan")}</td><td className="whitespace-nowrap px-3 py-2 text-right text-[8px] text-slate-600">{rupiah(item.subtotal)}</td><td className="whitespace-nowrap px-3 py-2 text-right text-[8px] font-bold text-[#265b78]">{rupiah(item.bpjs_portion)}</td></tr>)}</tbody></table></div>;
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
