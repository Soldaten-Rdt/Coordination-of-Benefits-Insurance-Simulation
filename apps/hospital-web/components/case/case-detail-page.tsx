"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  FileText,
  GitBranch,
  ReceiptText,
  Stethoscope,
} from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { getCase, listCaseDocuments, updateCase } from "@/lib/api/cases";
import { getAccessToken } from "@/lib/auth/token";
import type { CaseDetail, CaseDocumentsResponse } from "@/types/case";
import {
  EmptyState,
  ErrorState,
  formatDate,
  formatRupiah,
  LoadingState,
  Panel,
  StatusBadge,
  subclaimStatusLabel,
} from "./case-ui";
import { CaseDocumentsPanel } from "./case-documents-panel";
import { SplitBillPanel } from "./split-bill-panel";
import { ClaimsPanel } from "./claims-panel";
import { InvoicePanel } from "./invoice-panel";

const STEPS = [
  "Kasus dibuat",
  "Berkas dokumen",
  "Subklaim terbit",
  "Review penjamin",
  "Rekonsiliasi split",
  "Selesai",
];

const TABS = [
  { id: "overview", label: "Ringkasan & Koordinasi", icon: ClipboardList },
  { id: "documents", label: "Dokumen Pendukung", icon: FileText },
  { id: "claims", label: "Koordinasi Subklaim", icon: FileCheck2 },
  { id: "split", label: "Split Bill Calculator", icon: GitBranch },
  { id: "invoice", label: "Invoice & pembayaran", icon: ReceiptText },
  { id: "activity", label: "Log Aktiv", icon: Activity },
] as const;

type CaseTab = (typeof TABS)[number]["id"];

export function CaseDetailPage({ caseId }: { caseId: number }) {
  const [caseData, setCaseData] = React.useState<CaseDetail | null>(null);
  const [documentsData, setDocumentsData] =
    React.useState<CaseDocumentsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [tab, setTab] = React.useState<CaseTab>("overview");
  const [refreshing, setRefreshing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const [caseResponse, documentsResponse] = await Promise.all([
        getCase(caseId),
        listCaseDocuments(caseId),
      ]);
      setCaseData(caseResponse.data);
      setDocumentsData(documentsResponse.data);
      setError("");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Kasus gagal dimuat.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [caseId]);

  React.useEffect(() => {
    if (!getAccessToken()) {
      setError("Silakan masuk ke Hospital Workspace untuk melihat kasus.");
      setLoading(false);
      return;
    }
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingState label="Memuat detail kasus..." />;
  if (error || !caseData || !documentsData) {
    return (
      <div className="rounded-xl border border-[#E3EAF5] bg-white">
        <ErrorState
          message={error || "Detail kasus tidak tersedia."}
          onRetry={() => void refresh()}
        />
      </div>
    );
  }

  const data = caseData;
  const activeStep = Math.min(Math.max(data.workflow_step, 1), STEPS.length);
  const careTitle =
    data.care_type === "RAWAT_JALAN" ? "Rawat Jalan" : "Rawat Inap";
  const roomTitle = data.entitled_class
    ? `Ruang Perawatan ${data.entitled_class}`
    : data.room_name;
  const requiredDocuments = documentsData.documents.filter(
    (document) => document.is_mandatory
  );
  const validRequiredDocuments = requiredDocuments.filter(
    (document) => document.validation_status === "VALID"
  ).length;
  const stepDescriptions = [
    formatDate(data.admission_date),
    requiredDocuments.length
      ? `${validRequiredDocuments} dari ${requiredDocuments.length} berkas valid`
      : "Menunggu dokumen wajib",
    data.split_bill?.is_applied
      ? "Alokasi BPJS & swasta diterapkan"
      : "Menunggu split bill",
    data.subclaims.length
      ? data.subclaims
          .map(
            (claim) =>
              `${claim.payer_type}: ${subclaimStatusLabel(claim.status)}`
          )
          .join(" · ")
      : "Menunggu pengajuan klaim",
    "Menunggu rekonsiliasi",
    data.payment_status === "PAID" ? "Pelunasan selesai" : "Discharge & pelunasan",
  ];
  const coordinationLabel: Record<string, string> = {
    IN_PROGRESS: "Dalam proses koordinasi",
    IN_REVIEW: "Dalam proses koordinasi",
    ACTION_REQUIRED: "Perlu tindak lanjut",
    APPROVED: "Disetujui",
    SETTLED: "Selesai",
  };
  const progressStatus = [
    "Registrasi kasus",
    "Kelengkapan berkas",
    "Penerapan split bill",
    "Menunggu rekonsiliasi",
    "Rekonsiliasi pembayaran",
    "Discharge & pelunasan",
  ][activeStep - 1];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-[#E3EAF5] bg-white shadow-[0_4px_18px_rgba(11,58,91,0.04)]">
        <div className="p-4 sm:px-6 sm:pt-5">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-[#71869A]">
            <Link href="/cases" className="hover:text-[#154B6B]">
              Kasus Perawatan
            </Link>
            <span aria-hidden="true">›</span>
            <span className="font-bold text-[#315D7A]">{data.case_number}</span>
            {refreshing && (
              <span className="ml-auto text-[9px] font-semibold text-[#6A7E90]">
                Memperbarui data…
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
            <div className="min-w-0">
              <h1 className="text-[21px] font-extrabold leading-tight tracking-tight text-[#0B3A5B] sm:text-[24px]">
                Kasus {data.case_number} —{" "}
                {careTitle}
                {roomTitle ? ` ${roomTitle}` : ""}
              </h1>
              <p className="mt-1 text-[10px] text-[#71869A]">
                {data.patient.full_name} · {data.patient.patient_code}
                {data.room_name ? ` · ${data.room_name}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileText className="h-3.5 w-3.5" />}
                onClick={() => window.print()}
              >
                Cetak rekap kasus
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileCheck2 className="h-3.5 w-3.5" />}
                onClick={() => setTab("documents")}
              >
                Unggah dokumen tambahan
              </Button>
              <Button
                size="sm"
                leftIcon={<GitBranch className="h-3.5 w-3.5" />}
                onClick={() => setTab("split")}
              >
                Jalankan split bill
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={data.coordination_status}>
              {coordinationLabel[data.coordination_status] ??
                data.coordination_status.replaceAll("_", " ")}
            </StatusBadge>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF0FB] px-2.5 py-1 text-[9px] font-bold text-[#315D7A]">
              <CircleDollarSign className="h-3 w-3" />
              {formatRupiah(data.total_hospital_bill)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF0FB] px-2.5 py-1 text-[9px] font-bold text-[#315D7A]">
              <CalendarDays className="h-3 w-3" />
              {formatDate(data.admission_date)} –{" "}
              {data.discharge_date ? formatDate(data.discharge_date) : "Berlangsung"}
            </span>
          </div>
        </div>

        <nav
          aria-label="Navigasi detail kasus"
          className="flex min-w-0 gap-4 overflow-x-auto border-t border-[#E3EAF5] px-4 sm:px-6"
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-1 text-[10px] font-bold transition ${
                  active
                    ? "border-[#0B3A5B] text-[#0B3A5B]"
                    : "border-transparent text-[#5B6B7B] hover:text-[#154B6B]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                {item.id === "documents" && (
                  <span className="rounded-full bg-[#EAF0FB] px-1.5 py-0.5 text-[8px]">
                    {documentsData.documents.length}
                  </span>
                )}
                {item.id === "claims" && (
                  <span className="rounded-full bg-[#EAF0FB] px-1.5 py-0.5 text-[8px]">
                    {data.subclaims.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </section>

      <section
        aria-label="Tahapan koordinasi manfaat"
        className="overflow-x-auto rounded-xl border border-[#E3EAF5] bg-white px-4 py-4 shadow-[0_4px_18px_rgba(11,58,91,0.04)]"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#6B8091]">
            Tahapan alur koordinasi kasus
          </h2>
          <span className="shrink-0 text-[10px] font-bold text-[#315D7A]">
            Progres {Math.round((activeStep / STEPS.length) * 100)}% ·{" "}
            {progressStatus}
          </span>
        </div>
        <ol className="flex min-w-[900px] items-start">
          {STEPS.map((step, index) => {
            const number = index + 1;
            const complete = number < activeStep;
            const current = number === activeStep;
            return (
              <li
                key={step}
                className={`relative flex min-w-0 flex-1 flex-col items-start ${
                  index < STEPS.length - 1
                    ? `after:absolute after:left-7 after:right-0 after:top-[13px] after:h-[3px] ${
                        complete ? "after:bg-[#154B6B]" : "after:bg-[#DCE5EE]"
                      }`
                    : ""
                }`}
              >
                <span
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                    complete
                      ? "bg-[#154B6B] text-white"
                      : current
                        ? "bg-[#D0214F] text-white ring-4 ring-[#FCE4EA]"
                        : "bg-[#F0F3F7] text-[#8193A3]"
                  }`}
                >
                  {complete ? <Check className="h-3.5 w-3.5" /> : number}
                </span>
                <div className="mt-2 pr-2">
                  <div
                    className={`text-[9px] font-extrabold ${
                      current
                        ? "text-[#D0214F]"
                        : complete
                          ? "text-[#154B6B]"
                          : "text-[#71869A]"
                    }`}
                  >
                    {number}. {step}
                  </div>
                  <p
                    className={`mt-0.5 text-[8px] leading-3 ${
                      current ? "font-bold text-[#D0214F]" : "text-[#8293A2]"
                    }`}
                  >
                    {stepDescriptions[index]}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="overflow-x-auto rounded-xl border border-[#E3EAF5] bg-white">
        <div className="p-4 sm:p-5">
          {tab === "overview" && (
            <OverviewPanel
              data={data}
              onRefresh={refresh}
              onNavigateTab={setTab}
            />
          )}
          {tab === "documents" && (
            <CaseDocumentsPanel
              caseData={data}
              documentsData={documentsData}
              onRefresh={refresh}
            />
          )}
          {tab === "split" && (
            <SplitBillPanel caseData={data} onRefresh={refresh} />
          )}
          {tab === "claims" && (
            <ClaimsPanel caseData={data} onRefresh={refresh} />
          )}
          {tab === "invoice" && (
            <InvoicePanel caseData={data} onRefresh={refresh} />
          )}
          {tab === "activity" && <ActivityPanel activities={data.activities} />}
        </div>
      </div>
    </div>
  );
}

function ActivityPanel({
  activities,
}: {
  activities: CaseDetail["activities"];
}) {
  const sortedActivities = [...activities].sort(
    (first, second) =>
      new Date(second.created_at).getTime() -
      new Date(first.created_at).getTime()
  );

  return (
    <Panel
      title="Log aktivitas kasus"
      description="Riwayat perubahan dan komunikasi yang tercatat pada kasus."
      action={<Activity className="h-4 w-4 text-[#65839A]" />}
    >
      {sortedActivities.length === 0 ? (
        <EmptyState
          title="Belum ada aktivitas"
          description="Aktivitas akan muncul setelah ada tindakan pada kasus."
          icon="clock"
        />
      ) : (
        <ol className="space-y-4">
          {sortedActivities.map((activity, index) => (
            <li
              key={activity.id}
              className="relative flex gap-3 border-l border-[#DDE6EF] pb-1 pl-4 last:border-transparent"
            >
              <span
                className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ring-2 ring-white ${
                  index === 0 ? "bg-[#D0214F]" : "bg-[#315D7A]"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[11px] font-extrabold text-[#315D7A]">
                    {activity.title}
                  </h3>
                  <time className="text-[9px] text-[#8293A2]">
                    {formatDate(activity.created_at)}
                  </time>
                </div>
                <p className="mt-1 text-[10px] leading-5 text-[#71869A]">
                  {activity.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function OverviewPanel({
  data,
  onRefresh,
  onNavigateTab,
}: {
  data: CaseDetail;
  onRefresh: () => Promise<void>;
  onNavigateTab: (tab: CaseTab) => void;
}) {
  const split = data.split_bill;
  const latestCommunication = [...data.communications].sort(
    (first, second) =>
      new Date(second.created_at).getTime() -
      new Date(first.created_at).getTime()
  )[0];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <div className="space-y-4">
          <Panel
            title="Informasi pasien & konteks klinis"
            description="Ringkasan rekam kasus, diagnosis, dan episode perawatan."
            action={<Stethoscope className="h-4 w-4 text-[#315D7A]" />}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <DetailTile label="Nama pasien" value={data.patient.full_name} detail={`NIK ${data.patient.nik}`} />
              <DetailTile label="Dokter penanggung jawab" value={data.dpjp_name || "Belum ditentukan"} detail={data.entitled_class || "Kelas hak belum ditentukan"} />
              <DetailTile label="Diagnosis utama" value={`${data.diagnosis_icd10 || "Belum diisi"}${data.diagnosis_desc ? ` · ${data.diagnosis_desc}` : ""}`} detail="Kode diagnosis ICD-10" />
              <DetailTile label="Tindakan / prosedur" value={`${data.procedure_icd9 || "Belum diisi"}${data.procedure_desc ? ` · ${data.procedure_desc}` : ""}`} detail="Kode prosedur ICD-9-CM" />
            </div>
          </Panel>

          <Panel
            title="Rincian tagihan rumah sakit"
            description="Komponen dan nilai tagihan yang menjadi dasar simulasi split bill."
          >
            {data.bill_items.length === 0 ? (
              <EmptyState title="Belum ada item tagihan" description="Tambahkan item tagihan saat membuat kasus." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] border-collapse text-left text-[11px]">
                  <thead className="bg-[#EAF0FB] text-[9px] uppercase tracking-wide text-[#617B90]">
                    <tr>
                      <th className="px-3 py-2.5">Komponen layanan medis</th>
                      <th className="px-3 py-2.5">Kategori</th>
                      <th className="px-3 py-2.5 text-right">Jumlah</th>
                      <th className="px-3 py-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F6]">
                    {data.bill_items.map((item, index) => (
                      <tr key={item.id ?? item.description}>
                        <td className="px-3 py-3 font-semibold text-[#234B66]">
                          <span className="mr-2 text-[9px] text-[#8293A2]">{String(index + 1).padStart(2, "0")}</span>
                          {item.description}
                          {item.unit_info && <span className="ml-1 font-normal text-[#8293A2]">· {item.unit_info}</span>}
                        </td>
                        <td className="px-3 py-3 text-[#71869A]">{item.category.replaceAll("_", " ")}</td>
                        <td className="px-3 py-3 text-right text-[#71869A]">{item.quantity}</td>
                        <td className="px-3 py-3 text-right font-bold text-[#0B3A5B]">{formatRupiah(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#EAF0FB]">
                      <td colSpan={3} className="px-3 py-3 text-right font-bold text-[#34566E]">Total tagihan RS</td>
                      <td className="px-3 py-3 text-right font-extrabold text-[#0B3A5B]">{formatRupiah(data.total_hospital_bill)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Koordinasi subklaim multi-penjamin" description="Status pengajuan dan nilai klaim yang dikirim ke masing-masing penjamin.">
            {data.subclaims.length === 0 ? (
              <EmptyState title="Belum ada subklaim" description="Hitung dan terapkan split bill sebelum pengajuan." />
            ) : (
              <div className="space-y-3">
                {data.subclaims.map((claim, index) => (
                  <article key={claim.id} className={`rounded-lg border-l-4 border border-[#E3EAF5] bg-white p-4 ${claim.payer_type === "BPJS" ? "border-l-[#154B6B]" : "border-l-[#D0214F]"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[9px] font-extrabold uppercase tracking-wide text-[#8293A2]">Subklaim {index + 1} · {claim.payer_type === "BPJS" ? "Penjamin primer" : "Penjamin sekunder"}</div>
                        <h3 className="mt-1 text-sm font-extrabold text-[#234B66]">{claim.payer_name}</h3>
                        <p className="mt-1 text-[10px] text-[#8293A2]">{claim.subclaim_code}</p>
                      </div>
                      <StatusBadge status={claim.status}>{subclaimStatusLabel(claim.status)}</StatusBadge>
                    </div>
                    <div className="mt-3 grid gap-2 rounded-lg bg-[#F3F6FB] p-3 sm:grid-cols-3">
                      <AmountDetail label="Nilai diajukan" value={formatRupiah(claim.requested_amount)} />
                      <AmountDetail label="Nilai disetujui" value={formatRupiah(claim.approved_amount)} />
                      <AmountDetail
                        label="Dokumen wajib valid"
                        value={documentCountSummary(data.documents, claim.payer_type)}
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Ringkasan finansial" description={`Mode ${data.simulation_mode === "COB" ? "CoB aktif" : "Non-CoB · BPJS saja"}`}>
            <div className="rounded-lg bg-[#0B3A5B] p-4 text-white">
              <div className="text-[9px] font-bold uppercase tracking-wide text-white/70">Total tagihan rumah sakit</div>
              <div className="mt-1 text-xl font-extrabold">{formatRupiah(data.total_hospital_bill)}</div>
              <div className="mt-1 text-[10px] text-white/70">{data.bill_items.length} komponen tagihan</div>
            </div>
            <div className="mt-3 space-y-2">
              <PayerAmount label="BPJS Kesehatan" amount={split?.bpjs_estimated} percent={split?.bpjs_percent} color="bg-[#0B3A5B]" />
              {data.simulation_mode === "COB" && <PayerAmount label="Asuransi swasta" amount={split?.insurer_estimated} percent={split?.insurer_percent} color="bg-[#D0214F]" />}
              <PayerAmount label="Tanggungan pasien" amount={split?.patient_estimated} percent={split?.patient_percent} color="bg-[#E69A36]" />
            </div>
            <button type="button" onClick={() => onNavigateTab("split")} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#154B6B] px-3 py-2.5 text-[10px] font-extrabold text-white hover:bg-[#0B3A5B]">
              <GitBranch className="h-3.5 w-3.5" />
              Buka kalkulator split bill
            </button>
            <button type="button" onClick={() => onNavigateTab("invoice")} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#EAF0FB] px-3 py-2.5 text-[10px] font-extrabold text-[#315D7A] hover:bg-[#DFE9F8]">
              Lihat invoice & pembayaran
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </Panel>

          <Panel title="Komunikasi & log penjamin" description="Pesan terakhir pada kasus ini.">
            {latestCommunication ? (
              <div className="rounded-lg bg-[#F3F6FB] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold text-[#315D7A]">{latestCommunication.sender_name}</span>
                  <time className="text-[9px] text-[#8293A2]">{formatDate(latestCommunication.created_at)}</time>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-[#49667B]">{latestCommunication.message}</p>
                <button type="button" onClick={() => onNavigateTab("claims")} className="mt-3 text-[10px] font-bold text-[#154B6B] hover:underline">Buka riwayat komunikasi →</button>
              </div>
            ) : (
              <EmptyState title="Belum ada komunikasi" description="Pesan penjamin akan muncul setelah klaim diajukan." icon="clock" />
            )}
          </Panel>

          <Panel title="Dokumen kritis sebelum pulang">
            <div className="flex items-start gap-2 rounded-lg bg-[#F3F6FB] p-3">
              <FileCheck2 className={`mt-0.5 h-4 w-4 shrink-0 ${data.discharge_documents_complete ? "text-emerald-700" : "text-amber-700"}`} />
              <div>
                <div className="text-[10px] font-extrabold text-[#234B66]">{data.discharge_documents_complete ? "Checklist dokumen lengkap" : "Checklist dokumen belum lengkap"}</div>
                <p className="mt-1 text-[9px] leading-4 text-[#71869A]">Resume medis dan dokumen kritis harus valid sebelum pasien pulang.</p>
                <button type="button" onClick={() => onNavigateTab("documents")} className="mt-2 text-[10px] font-bold text-[#154B6B] hover:underline">Periksa dokumen →</button>
              </div>
            </div>
          </Panel>

          <Panel title="Aktivitas kasus" action={<Activity className="h-4 w-4 text-[#65839A]" />}>
            {data.activities.length === 0 ? (
              <EmptyState title="Belum ada aktivitas" description="Aktivitas akan muncul setelah ada tindakan pada kasus." icon="clock" />
            ) : (
              <ol className="space-y-3">
                {data.activities.slice(0, 5).map((activity) => (
                  <li key={activity.id} className="relative border-l border-[#DDE6EF] pl-3">
                    <span className="absolute -left-[4px] top-1 h-1.5 w-1.5 rounded-full bg-[#2D6C91]" />
                    <div className="text-[10px] font-bold text-[#31556E]">{activity.title}</div>
                    <div className="mt-1 text-[9px] leading-4 text-[#71869A]">{activity.description}</div>
                    <time className="mt-1 block text-[9px] text-[#96A4B0]">{formatDate(activity.created_at)}</time>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </aside>
      </div>
      <CaseEditPanel data={data} onRefresh={onRefresh} />
    </div>
  );
}

function DetailTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[#F3F6FB] px-3 py-2.5">
      <div className="text-[9px] font-bold uppercase tracking-wide text-[#8293A2]">{label}</div>
      <div className="mt-1 truncate text-[11px] font-extrabold text-[#234B66]">{value}</div>
      <div className="mt-1 text-[9px] text-[#71869A]">{detail}</div>
    </div>
  );
}

function AmountDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-semibold text-[#8293A2]">{label}</div>
      <div className="mt-1 text-[10px] font-extrabold text-[#234B66]">{value}</div>
    </div>
  );
}

function documentCountSummary(
  documents: CaseDetail["documents"],
  payerType: CaseDetail["subclaims"][number]["payer_type"]
): string {
  const requiredDocuments = documents.filter(
    (document) =>
      document.target_payer === payerType && document.is_mandatory
  );
  const validCount = requiredDocuments.filter(
    (document) => document.validation_status === "VALID"
  ).length;
  return requiredDocuments.length
    ? `${validCount} dari ${requiredDocuments.length} dokumen valid`
    : "Dokumen wajib belum tersedia";
}

function PayerAmount({
  label,
  amount,
  percent,
  color,
}: {
  label: string;
  amount?: number;
  percent?: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-[#E8EDF4] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#4D687C]">{label}</span>
        <span className="text-[10px] font-extrabold text-[#0B3A5B]">{amount === undefined ? "Belum dihitung" : formatRupiah(amount)}</span>
      </div>
      {percent !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ECF1F6]">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
          </div>
          <span className="w-10 text-right text-[9px] font-bold text-[#71869A]">{percent.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}

function CaseEditPanel({
  data,
  onRefresh,
}: {
  data: CaseDetail;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [values, setValues] = React.useState({
    room_name: data.room_name,
    entitled_class: data.entitled_class,
    dpjp_name: data.dpjp_name,
    discharge_date: data.discharge_date?.slice(0, 10) ?? "",
    diagnosis_desc: data.diagnosis_desc,
    procedure_desc: data.procedure_desc,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateCase(data.id, values);
      await onRefresh();
      toast({
        title: "Informasi kasus disimpan",
        variant: "success",
      });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Perubahan gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Informasi kasus dan klinis"
      description="Perbarui informasi operasional yang dapat diedit pada kasus."
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(
            [
              ["room_name", "Ruang / unit"],
              ["entitled_class", "Kelas hak"],
              ["dpjp_name", "DPJP"],
              ["discharge_date", "Tanggal keluar"],
              ["diagnosis_desc", "Deskripsi diagnosis"],
              ["procedure_desc", "Deskripsi prosedur"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-[10px] font-bold text-[#34566E]">
                {label}
              </span>
              <input
                type={key === "discharge_date" ? "date" : "text"}
                value={values[key]}
                min={key === "discharge_date" ? data.admission_date.slice(0, 10) : undefined}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                className="h-9 w-full rounded-lg border border-[#DCE5F0] bg-white px-3 text-[11px] text-[#0B3A5B] outline-none focus:border-[#3B789F] focus:ring-2 focus:ring-[#3B789F]/15"
              />
            </label>
          ))}
        </div>
        {error && (
          <div role="alert" className="text-[10px] font-semibold text-rose-700">
            {error}
          </div>
        )}
        <Button type="submit" isLoading={saving}>
          Simpan perubahan
        </Button>
      </form>
    </Panel>
  );
}
