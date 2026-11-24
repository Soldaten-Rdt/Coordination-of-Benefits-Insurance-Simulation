"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  FileCheck2,
  FileText,
  GitBranch,
  ReceiptText,
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
  paymentStatusLabel,
  StatusBadge,
  subclaimStatusLabel,
} from "./case-ui";
import { CaseDocumentsPanel } from "./case-documents-panel";
import { SplitBillPanel } from "./split-bill-panel";
import { ClaimsPanel } from "./claims-panel";
import { InvoicePanel } from "./invoice-panel";

const STEPS = [
  "Kasus dibuat",
  "Dokumen",
  "Split bill",
  "Pengajuan klaim",
  "Rekonsiliasi",
  "Pembayaran",
];

const TABS = [
  { id: "overview", label: "Ringkasan", icon: ClipboardList },
  { id: "documents", label: "Dokumen klaim", icon: FileText },
  { id: "split", label: "Split bill", icon: GitBranch },
  { id: "claims", label: "Pengajuan & pesan", icon: FileCheck2 },
  { id: "invoice", label: "Invoice & pembayaran", icon: ReceiptText },
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

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#55758D] hover:text-[#0B3A5B]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Daftar kasus
        </Link>
        <div className="mt-3 flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-extrabold tracking-tight text-[#0B3A5B]">
                {data.case_number}
              </h1>
              <StatusBadge status={data.payment_status}>
                {paymentStatusLabel(data.payment_status)}
              </StatusBadge>
              <StatusBadge status={data.simulation_mode} />
            </div>
            <p className="mt-1 text-xs text-[#5B6B7B]">
              {data.patient.full_name} · {data.patient.patient_code} ·{" "}
              {data.care_type === "RAWAT_JALAN" ? "Rawat jalan" : "Rawat inap"}
            </p>
          </div>
          {refreshing && (
            <span className="text-[10px] font-semibold text-[#6A7E90]">
              Memperbarui data…
            </span>
          )}
        </div>
      </div>

      <section
        aria-label="Tahapan koordinasi manfaat"
        className="overflow-x-auto rounded-xl border border-[#E3EAF5] bg-white px-4 py-4 shadow-[0_4px_18px_rgba(11,58,91,0.04)]"
      >
        <ol className="flex min-w-[690px] items-center">
          {STEPS.map((step, index) => {
            const number = index + 1;
            const complete = number < activeStep;
            const current = number === activeStep;
            return (
              <li
                key={step}
                className={`relative flex flex-1 items-center ${
                  index < STEPS.length - 1
                    ? "after:absolute after:left-[34px] after:right-0 after:top-[14px] after:h-px after:bg-[#DCE5EE]"
                    : ""
                }`}
              >
                <span
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                    complete
                      ? "bg-[#154B6B] text-white"
                      : current
                        ? "bg-[#EAF0FB] text-[#154B6B] ring-2 ring-[#154B6B]/25"
                        : "bg-[#F0F3F7] text-[#8193A3]"
                  }`}
                >
                  {number}
                </span>
                <span
                  className={`relative z-10 ml-2 bg-white pr-2 text-[10px] font-bold ${
                    complete || current ? "text-[#154B6B]" : "text-[#8293A2]"
                  }`}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Total tagihan" value={formatRupiah(data.total_hospital_bill)} />
        <InfoCard
          label="Pasien / NIK"
          value={data.patient.full_name}
          subvalue={`NIK ${data.patient.nik}`}
        />
        <InfoCard
          label="Diagnosis utama"
          value={data.diagnosis_icd10 || "Belum diisi"}
          subvalue={data.diagnosis_desc || "Kode ICD-10"}
        />
        <InfoCard
          label="Perawatan"
          value={data.room_name || "Ruang belum ditentukan"}
          subvalue={`${formatDate(data.admission_date)}${data.discharge_date ? ` – ${formatDate(data.discharge_date)}` : ""}`}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E3EAF5] bg-white">
        <div className="flex min-w-max gap-1 border-b border-[#E3EAF5] p-2">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[11px] font-bold transition ${
                  active
                    ? "bg-[#154B6B] text-white"
                    : "text-[#587287] hover:bg-[#F2F6FB] hover:text-[#0B3A5B]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5">
          {tab === "overview" && (
            <OverviewPanel data={data} onRefresh={refresh} />
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
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#E3EAF5] bg-white p-4 shadow-[0_4px_18px_rgba(11,58,91,0.03)]">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#8293A2]">
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-extrabold text-[#0B3A5B]">
        {value}
      </div>
      {subvalue && (
        <div className="mt-1 truncate text-[10px] text-[#6B8091]">
          {subvalue}
        </div>
      )}
    </div>
  );
}

function OverviewPanel({
  data,
  onRefresh,
}: {
  data: CaseDetail;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <Panel
          title="Rincian tagihan"
          description="Item dan alokasi pembayaran ditampilkan sesuai data kasus."
        >
          {data.bill_items.length === 0 ? (
            <EmptyState
              title="Belum ada item tagihan"
              description="Tambahkan item tagihan saat membuat kasus."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
                <thead className="border-b border-[#E7EDF4] text-[9px] uppercase tracking-wide text-[#8293A2]">
                  <tr>
                    <th className="pb-2 pr-3">Item</th>
                    <th className="px-2 pb-2">Kategori</th>
                    <th className="px-2 pb-2 text-right">Jumlah</th>
                    <th className="pb-2 pl-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {data.bill_items.map((item) => (
                    <tr key={item.id ?? item.description}>
                      <td className="py-3 pr-3 font-semibold text-[#234B66]">
                        {item.description}
                        {item.unit_info && (
                          <span className="ml-1 font-normal text-[#8293A2]">
                            · {item.unit_info}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-[#71869A]">
                        {item.category.replaceAll("_", " ")}
                      </td>
                      <td className="px-2 py-3 text-right text-[#71869A]">
                        {item.quantity}
                      </td>
                      <td className="py-3 pl-2 text-right font-bold text-[#0B3A5B]">
                        {formatRupiah(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#DDE6EF]">
                    <td
                      colSpan={3}
                      className="pt-3 text-right font-bold text-[#34566E]"
                    >
                      Total tagihan
                    </td>
                    <td className="pt-3 text-right font-extrabold text-[#0B3A5B]">
                      {formatRupiah(data.total_hospital_bill)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Status subklaim" description="Status terbaru dari backend.">
            {data.subclaims.length === 0 ? (
              <EmptyState
                title="Belum ada subklaim"
                description="Hitung dan terapkan split bill sebelum pengajuan."
              />
            ) : (
              <div className="space-y-3">
                {data.subclaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E8EDF4] p-3"
                  >
                    <div>
                      <div className="text-[11px] font-extrabold text-[#154B6B]">
                        {claim.payer_name}
                      </div>
                      <div className="mt-1 text-[10px] text-[#8191A0]">
                        {claim.subclaim_code} · Diajukan{" "}
                        {formatRupiah(claim.requested_amount)}
                      </div>
                    </div>
                    <StatusBadge status={claim.status}>
                      {subclaimStatusLabel(claim.status)}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Aktivitas kasus">
            {data.activities.length === 0 ? (
            <EmptyState
              title="Belum ada aktivitas"
              description="Aktivitas akan muncul setelah ada tindakan pada kasus."
              icon="clock"
            />
            ) : (
              <ol className="space-y-3">
                {data.activities.slice(0, 6).map((activity) => (
                  <li
                    key={activity.id}
                    className="relative border-l border-[#DDE6EF] pl-3"
                  >
                    <span className="absolute -left-[4px] top-1 h-1.5 w-1.5 rounded-full bg-[#2D6C91]" />
                    <div className="text-[11px] font-bold text-[#31556E]">
                      {activity.title}
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-[#71869A]">
                      {activity.description}
                    </div>
                    <time className="mt-1 block text-[9px] text-[#96A4B0]">
                      {formatDate(activity.created_at)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
      <CaseEditPanel data={data} onRefresh={onRefresh} />
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
