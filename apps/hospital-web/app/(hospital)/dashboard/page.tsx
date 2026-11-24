"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bed,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FileUp,
  FolderKanban,
  GitFork,
  History,
  Hourglass,
  Link2,
  SlidersHorizontal,
  SquarePlus,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import {
  getDashboardActionRequired,
  getDashboardActivities,
  getDashboardSummary,
  updateSimulationMode,
} from "@/lib/api";
import { getAccessToken } from "@/lib/auth/token";
import { cn } from "@/lib/utils/cn";
import { useWorkspace } from "@/components/layout";
import { Button, Modal, useToast } from "@/components/ui";
import type { SimulationMode } from "@/types/api";
import type { DashboardCaseTab } from "@/types/dashboard";

interface CaseRowView {
  id: number;
  casePrefix: string;
  caseSuffix: string;
  fullCaseCode: string;
  patientName: string;
  patientCodePrefix: string;
  patientCodeSuffix: string;
  careLabel: string;
  careKind: "inap" | "jalan";
  dateLabel: string;
  primaryPayer: string;
  secondaryPayer?: string;
  claimStatusLabel: string;
  claimStatusTone: "blue" | "pink" | "peach";
  claimStatusIcon: "dot-navy" | "dot-red" | "check" | "clock";
  claimSubtext?: string;
  claimSubtextRed?: boolean;
  paymentLabel: string;
  paymentTone: "peach" | "muted" | "blue";
  tabCategory: DashboardCaseTab;
}

const REFERENCE_CASES: CaseRowView[] = [
  {
    id: 1,
    casePrefix: "KAS-",
    caseSuffix: "2026-001",
    fullCaseCode: "KAS-2026-001",
    patientName: "Aulia Ramadhani",
    patientCodePrefix: "PAT-2026-",
    patientCodeSuffix: "001",
    careLabel: "Rawat Inap (Kls 1)",
    careKind: "inap",
    dateLabel: "12–16 Okt 2026",
    primaryPayer: "BPJS Kesehatan",
    secondaryPayer: "+ Asuransi Sehat Sentosa",
    claimStatusLabel: "Sedang Ditinjau",
    claimStatusTone: "blue",
    claimStatusIcon: "dot-navy",
    claimSubtext: "BPJS Disetujui, Asuransi Proses",
    paymentLabel: "Menunggu",
    paymentTone: "peach",
    tabCategory: "IN_REVIEW",
  },
  {
    id: 2,
    casePrefix: "KAS-",
    caseSuffix: "2026-002",
    fullCaseCode: "KAS-2026-002",
    patientName: "Budi Santoso",
    patientCodePrefix: "PAT-2026-",
    patientCodeSuffix: "004",
    careLabel: "Rawat Inap (VIP)",
    careKind: "inap",
    dateLabel: "20–25 Okt 2026",
    primaryPayer: "BPJS Kesehatan",
    secondaryPayer: "+ Mandiri Inhealth",
    claimStatusLabel: "Perlu Revisi",
    claimStatusTone: "pink",
    claimStatusIcon: "dot-red",
    claimSubtext: "Catatan Medis Penjamin Swasta",
    claimSubtextRed: true,
    paymentLabel: "Belum Dica…",
    paymentTone: "muted",
    tabCategory: "NEEDS_DOCUMENTS",
  },
  {
    id: 3,
    casePrefix: "KAS-",
    caseSuffix: "2026-003",
    fullCaseCode: "KAS-2026-003",
    patientName: "Siti Rahayu",
    patientCodePrefix: "PAT-2026-",
    patientCodeSuffix: "009",
    careLabel: "Rawat Jalan",
    careKind: "jalan",
    dateLabel: "02 Nov 2026",
    primaryPayer: "BPJS Kesehatan Tunggal",
    claimStatusLabel: "Disetujui Penuh",
    claimStatusTone: "blue",
    claimStatusIcon: "check",
    paymentLabel: "Lunas",
    paymentTone: "blue",
    tabCategory: "READY_RECONCILE",
  },
  {
    id: 4,
    casePrefix: "KAS-",
    caseSuffix: "2026-004",
    fullCaseCode: "KAS-2026-004",
    patientName: "Ahmad Wijaya",
    patientCodePrefix: "PAT-2026-",
    patientCodeSuffix: "015",
    careLabel: "Rawat Inap",
    careKind: "inap",
    dateLabel: "10 Nov 2026",
    primaryPayer: "BPJS Kesehatan",
    secondaryPayer: "+ Prudential Life",
    claimStatusLabel: "Menunggu Berkas",
    claimStatusTone: "peach",
    claimStatusIcon: "clock",
    claimSubtext: "Resume Bedah Pending",
    paymentLabel: "Belum Dica…",
    paymentTone: "muted",
    tabCategory: "NEEDS_DOCUMENTS",
  },
];

interface ActionPriorityView {
  id: string;
  caseCode: string;
  badge: string;
  badgeTone: "red" | "peach" | "navy";
  description: string;
  buttonLabel: string;
  buttonVariant: "navy" | "soft";
  buttonIcon: "upload" | "link" | "split";
}

const REFERENCE_ACTIONS: ActionPriorityView[] = [
  {
    id: "act-1",
    caseCode: "KAS-2026-002",
    badge: "REVISI ASURANSI",
    badgeTone: "red",
    description:
      "Formulir klaim asuransi belum ditandatangani DPJP (diminta oleh Sehat Sentosa).",
    buttonLabel: "Unggah Dokumen",
    buttonVariant: "navy",
    buttonIcon: "upload",
  },
  {
    id: "act-2",
    caseCode: "KAS-2026-005",
    badge: "DOKUMEN HILANG",
    badgeTone: "peach",
    description:
      "Resume medis rontgen thorax digital belum diunggah dari sistem radiologi.",
    buttonLabel: "Lengkapi",
    buttonVariant: "soft",
    buttonIcon: "link",
  },
  {
    id: "act-3",
    caseCode: "KAS-2026-001",
    badge: "KLAIM DISETUJUI",
    badgeTone: "navy",
    description:
      "Subklaim BPJS disetujui Rp 37.500.000. Lanjutkan pemisahan billing final ke Mandiri Inhealth.",
    buttonLabel: "Buka Kalkulator",
    buttonVariant: "soft",
    buttonIcon: "split",
  },
];

export default function DashboardPage() {
  const { searchQuery, simulationMode, setSimulationMode } = useWorkspace();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<DashboardCaseTab>("ALL");
  const [bannerVisible, setBannerVisible] = React.useState(true);
  const [configModalOpen, setConfigModalOpen] = React.useState(false);
  const [draftMode, setDraftMode] =
    React.useState<SimulationMode>(simulationMode);
  const [savingMode, setSavingMode] = React.useState(false);

  // KPI state (starts with reference values, updated seamlessly when backend responds)
  const [kpi, setKpi] = React.useState({
    totalActive: 24,
    needsDocs: 6,
    inReview: 12,
    pendingCount: 8,
  });

  const [actions, setActions] =
    React.useState<ActionPriorityView[]>(REFERENCE_ACTIONS);

  React.useEffect(() => {
    setDraftMode(simulationMode);
  }, [simulationMode]);

  React.useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    let cancelled = false;
    Promise.allSettled([
      getDashboardSummary(activeTab),
      getDashboardActionRequired(),
      getDashboardActivities(),
    ]).then(([summaryRes, actionRes]) => {
      if (cancelled) return;

      if (summaryRes.status === "fulfilled" && summaryRes.value.data?.kpi) {
        const k = summaryRes.value.data.kpi;
        if (k.total_active_cases > 0) {
          setKpi({
            totalActive: k.total_active_cases,
            needsDocs: k.needs_documents,
            inReview: k.claims_in_review,
            pendingCount: k.pending_payments,
          });
        }
      }

      if (
        actionRes.status === "fulfilled" &&
        Array.isArray(actionRes.value.data) &&
        actionRes.value.data.length > 0
      ) {
        const mapped: ActionPriorityView[] = actionRes.value.data
          .slice(0, 3)
          .map((item, idx) => ({
            id: `api-act-${item.case_id}-${idx}`,
            caseCode: item.case_number,
            badge: item.badge,
            badgeTone:
              item.type === "REVISION_REQUIRED"
                ? "red"
                : item.type === "MISSING_DOCUMENTS"
                  ? "peach"
                  : "navy",
            description: item.description,
            buttonLabel:
              item.type === "REVISION_REQUIRED"
                ? "Unggah Dokumen"
                : item.type === "MISSING_DOCUMENTS"
                  ? "Lengkapi"
                  : "Buka Kalkulator",
            buttonVariant: item.type === "REVISION_REQUIRED" ? "navy" : "soft",
            buttonIcon:
              item.type === "REVISION_REQUIRED"
                ? "upload"
                : item.type === "MISSING_DOCUMENTS"
                  ? "link"
                  : "split",
          }));
        setActions(mapped);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const filteredCases = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return REFERENCE_CASES.filter((row) => {
      const matchesTab = activeTab === "ALL" || row.tabCategory === activeTab;
      if (!matchesTab) return false;
      if (!q) return true;
      return (
        row.fullCaseCode.toLowerCase().includes(q) ||
        row.patientName.toLowerCase().includes(q) ||
        `${row.patientCodePrefix}${row.patientCodeSuffix}`
          .toLowerCase()
          .includes(q) ||
        row.primaryPayer.toLowerCase().includes(q) ||
        (row.secondaryPayer?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [activeTab, searchQuery]);

  const handleSaveSimulationMode = async () => {
    setSavingMode(true);
    try {
      if (getAccessToken()) {
        await updateSimulationMode(draftMode);
      }
      setSimulationMode(draftMode);
      toast({
        variant: "success",
        title: "Konfigurasi Diperbarui",
        description: `Mode simulasi sekarang menggunakan ${draftMode === "COB" ? "COB (Penjamin Ganda)" : "Non-COB (BPJS Tunggal)"}.`,
      });
      setConfigModalOpen(false);
    } catch {
      setSimulationMode(draftMode);
      toast({
        variant: "info",
        title: "Mode Simulasi Diterapkan (Lokal)",
        description: `Tampilan disetel ke ${draftMode}. Sambungkan backend :8081 untuk persistensi database.`,
      });
      setConfigModalOpen(false);
    } finally {
      setSavingMode(false);
    }
  };

  return (
    <div className="space-y-[14px]">
      {/* 5) JUDUL HALAMAN */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-[8px]">
            <h1 className="text-[22px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[#0B3A5B]">
              Dashboard Operasional
            </h1>
            <span className="inline-flex items-center gap-[5px] rounded-full bg-[#EAF0FB] px-[9px] py-[4px] text-[10px] font-bold leading-none text-[#0B3A5B]">
              <span
                className="h-[5px] w-[5px] rounded-full bg-[#0B3A5B]"
                aria-hidden="true"
              />
              KAPJ RS Sentra Medika
            </span>
          </div>
          <p className="mt-[4px] text-[11.5px] font-normal text-[#5B6B7B]">
            Pantau aktivitas administrasi, koordinasi klaim multi-penjamin
            (COB), dan rekonsiliasi pembayaran rumah sakit.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-[8px]">
          <div className="inline-flex h-[34px] items-center gap-[6px] rounded-[8px] border border-[#E3EAF5] bg-white px-[11px] text-[10.5px] font-semibold text-[#0B3A5B]">
            <Calendar
              className="h-[13px] w-[13px] text-[#5B6B7B]"
              strokeWidth={1.8}
            />
            <span>18 November 2026</span>
          </div>

          <Link
            href="/patients"
            className="inline-flex h-[34px] items-center gap-[6px] rounded-[8px] bg-[#0B3A5B] px-[12px] text-[10.5px] font-bold text-white transition-colors hover:bg-[#154B6B]"
          >
            <UserPlus className="h-[13px] w-[13px]" strokeWidth={2} />
            <span>+ Tambah Pasien</span>
          </Link>
        </div>
      </div>

      {/* 6) BANNER MODE SIMULASI */}
      {bannerVisible && (
        <div className="flex flex-col justify-between gap-3 rounded-[10px] bg-[#EAF0FB] px-[14px] py-[11px] sm:flex-row sm:items-center">
          <div className="flex items-start gap-[10px] sm:items-center">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#DCE8F9] text-[#0B3A5B]">
              <SlidersHorizontal
                className="h-[14px] w-[14px]"
                strokeWidth={1.9}
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-[7px]">
                <p className="text-[12px] font-extrabold leading-tight text-[#0B3A5B]">
                  {simulationMode === "COB"
                    ? "Mode Simulasi COB Aktif"
                    : "Mode Simulasi Non-COB Aktif"}
                </p>
                <span className="rounded-full bg-[#DCE8F9] px-[7px] py-[2px] text-[8.5px] font-bold leading-none text-[#0B3A5B]">
                  v2.4 Sandbox
                </span>
              </div>
              <p className="mt-[2px] text-[10.5px] font-normal text-[#5B6B7B]">
                {simulationMode === "COB"
                  ? "Aturan koordinasi otomatis: BPJS Kesehatan sebagai penjamin primer + Mandiri Inhealth / Sehat Sentosa sebagai sekunder."
                  : "Mode BPJS Kesehatan tunggal aktif: alokasi penjamin asuransi swasta dikunci."}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-[8px] self-end sm:self-center">
            <button
              type="button"
              onClick={() => setConfigModalOpen(true)}
              className="rounded-[6px] border border-[#E3EAF5] bg-white px-[10px] py-[6px] text-[10px] font-bold text-[#0B3A5B] transition-colors hover:bg-[#F6F8FE] cursor-pointer"
            >
              Konfigurasi Matriks
            </button>
            <button
              type="button"
              onClick={() => setBannerVisible(false)}
              aria-label="Tutup banner simulasi"
              className="flex h-[24px] w-[24px] items-center justify-center rounded-[6px] text-[#5B6B7B] transition-colors hover:bg-[#DCE8F9] hover:text-[#0B3A5B] cursor-pointer"
            >
              <X className="h-[13px] w-[13px]" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* 7) 4 KARTU STATISTIK */}
      <section
        aria-label="Statistik operasional"
        className="grid grid-cols-1 items-start gap-[11px] sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* Card 1 */}
        <div className="flex min-h-[126px] flex-col justify-between rounded-[10px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[#5B6B7B]">
                TOTAL KASUS AKTIF
              </p>
              <p className="mt-[4px] text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[#0B3A5B]">
                {kpi.totalActive}
              </p>
            </div>
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#DCE8F9] text-[#0B3A5B]">
              <FolderKanban className="h-[15px] w-[15px]" strokeWidth={1.8} />
            </div>
          </div>

          <div className="mt-[14px] flex items-end justify-between gap-2">
            <p className="max-w-[115px] text-[10px] leading-[1.35] text-[#5B6B7B]">
              18 Rawat Inap, 6 Rawat Jalan
            </p>
            <span className="inline-flex shrink-0 items-center gap-[2px] text-[10px] font-bold text-[#0B3A5B]">
              <ArrowUpRight className="h-[12px] w-[12px]" strokeWidth={2.2} />
              +3 mgg ini
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="flex min-h-[126px] flex-col justify-between rounded-[10px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[#5B6B7B]">
                DOKUMEN BELUM LENGKAP
              </p>
              <div className="mt-[4px] flex flex-wrap items-center gap-[7px]">
                <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[#0B3A5B]">
                  {kpi.needsDocs}
                </span>
                <span className="rounded-full bg-[#FFE4C4] px-[8px] py-[3px] text-[9px] font-bold leading-none text-[#A8510B]">
                  Perlu Tindakan
                </span>
              </div>
            </div>
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#FFE4C4] text-[#A8510B]">
              <ClipboardList className="h-[15px] w-[15px]" strokeWidth={1.8} />
            </div>
          </div>

          <div className="mt-[14px] flex items-end justify-between gap-2">
            <p className="text-[10px] leading-[1.35] text-[#5B6B7B]">
              Menunggu resume &amp; rincian biaya
            </p>
            <span className="shrink-0 text-[12px] font-extrabold leading-none text-[#A8510B]">
              !
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="flex min-h-[126px] flex-col justify-between rounded-[10px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[#5B6B7B]">
                KLAIM MENUNGGU REVIEW
              </p>
              <div className="mt-[4px] flex flex-wrap items-center gap-[7px]">
                <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[#0B3A5B]">
                  {kpi.inReview}
                </span>
                <span className="rounded-full bg-[#DCE8F9] px-[8px] py-[3px] text-[9px] font-bold leading-none text-[#0B3A5B]">
                  Dalam Antrean
                </span>
              </div>
            </div>
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#DCE8F9] text-[#0B3A5B]">
              <Hourglass className="h-[15px] w-[15px]" strokeWidth={1.8} />
            </div>
          </div>

          <div className="mt-[14px] flex items-end justify-between gap-2">
            <p className="max-w-[115px] text-[10px] leading-[1.35] text-[#5B6B7B]">
              7 BPJS, 5 Asuransi Swasta
            </p>
            <span className="max-w-[44px] text-right text-[10px] font-semibold leading-[1.3] text-[#5B6B7B]">
              Est. 48 jam
            </span>
          </div>
        </div>

        {/* Card 4 — Lebih tinggi, angka merah 3 baris, garis aksen merah 5px di kanan */}
        <div className="relative flex min-h-[158px] flex-col justify-between overflow-hidden rounded-[10px] border border-[#E3EAF5] bg-white p-[14px] pr-[18px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
          <span
            className="absolute inset-y-0 right-0 w-[5px] bg-[#D0214F]"
            aria-hidden="true"
          />

          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[#5B6B7B]">
                PEMBAYARAN TERTUNDA
              </p>
              <div className="mt-[6px] text-[26px] font-extrabold leading-[1.08] tracking-[-0.02em] text-[#D0214F]">
                <span className="block">Rp</span>
                <span className="block">148.500.</span>
                <span className="block">000</span>
              </div>
            </div>
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#FCE4EA] text-[#D0214F]">
              <Wallet className="h-[15px] w-[15px]" strokeWidth={1.8} />
            </div>
          </div>

          <div className="mt-[12px] flex items-end justify-between gap-2">
            <p className="max-w-[115px] text-[10px] leading-[1.35] text-[#5B6B7B]">
              {kpi.pendingCount} kasus belum lunas / sebagian
            </p>
            <span className="max-w-[44px] text-right text-[10px] font-bold leading-[1.25] text-[#D0214F]">
              Triage COB
            </span>
          </div>
        </div>
      </section>

      {/* GRID DUA KOLOM: Kiri (±508px / 2.06fr) + Kanan (±247px / 1fr) */}
      <div className="grid grid-cols-1 items-start gap-[14px] xl:grid-cols-[minmax(0,2.06fr)_minmax(275px,1fr)]">
        {/* KOLOM KIRI */}
        <div className="min-w-0 space-y-[14px]">
          {/* 8) TABEL "KASUS PERAWATAN TERBARU" */}
          <section className="overflow-hidden rounded-[10px] border border-[#E3EAF5] bg-white shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
            {/* Header Kartu */}
            <div className="flex items-start justify-between gap-3 px-[14px] pt-[14px]">
              <div>
                <h2 className="text-[14px] font-bold text-[#0B3A5B]">
                  Kasus Perawatan Terbaru
                </h2>
                <p className="mt-[2px] text-[10.5px] text-[#5B6B7B]">
                  Daftar berkas klaim koordinasi asuransi yang sedang berjalan.
                </p>
              </div>
              <Link
                href="/cases"
                className="inline-flex shrink-0 items-center gap-[4px] text-[10.5px] font-bold text-[#0B3A5B] hover:underline"
              >
                <span>Lihat Semua Kasus</span>
                <ArrowRight className="h-[12px] w-[12px]" strokeWidth={2.2} />
              </Link>
            </div>

            {/* Tab Pill */}
            <div className="mt-[11px] flex flex-wrap items-center gap-[6px] px-[14px] pb-[12px]">
              {[
                {
                  key: "ALL" as const,
                  label: "Semua Kasus",
                  count: 24,
                  badgeClass: "bg-white/20 text-white",
                },
                {
                  key: "NEEDS_DOCUMENTS" as const,
                  label: "Perlu Kelengkapan",
                  count: 6,
                  badgeClass: "bg-[#FFE4C4] text-[#A8510B]",
                },
                {
                  key: "IN_REVIEW" as const,
                  label: "Dalam Review",
                  count: 12,
                  badgeClass: "bg-[#DCE8F9] text-[#0B3A5B]",
                },
                {
                  key: "READY_RECONCILE" as const,
                  label: "Siap Rekonsiliasi",
                  count: 4,
                  badgeClass: "bg-[#DCE8F9] text-[#0B3A5B]",
                },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "inline-flex items-center gap-[6px] rounded-[7px] px-[10px] py-[5px] text-[10.5px] font-semibold transition-colors cursor-pointer",
                      isActive
                        ? "bg-[#154B6B] text-white"
                        : "bg-[#EAF0FB] text-[#0B3A5B] hover:bg-[#DCE8F9]"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-[5px] py-[1px] text-[9px] font-bold leading-tight",
                        isActive ? "bg-white/20 text-white" : tab.badgeClass
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tabel (kolom terakhir Pembayaran pas di tepi kanan dengan efek crop halus sesuai referensi) */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[685px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#EAF0FB] text-[8.5px] font-bold uppercase tracking-[0.05em] text-[#5B6B7B]">
                    <th className="w-[106px] py-[9px] pl-[14px] pr-[8px]">
                      ID &amp; PASIEN
                    </th>
                    <th className="w-[122px] px-[8px] py-[9px]">
                      JENIS RAWAT
                    </th>
                    <th className="w-[96px] px-[8px] py-[9px]">TANGGAL</th>
                    <th className="w-[116px] px-[8px] py-[9px]">
                      PENJAMIN (COB)
                    </th>
                    <th className="w-[140px] px-[8px] py-[9px]">
                      STATUS KLAIM
                    </th>
                    <th className="w-[85px] overflow-hidden py-[9px] pl-[8px] pr-0 whitespace-nowrap">
                      PEMBAYARAN
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3EAF5]/70">
                  {filteredCases.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-[11px] text-[#5B6B7B]"
                      >
                        Tidak ada kasus yang sesuai dengan filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    filteredCases.map((row) => (
                      <tr
                        key={row.id}
                        className="align-middle transition-colors hover:bg-[#F6F8FE]/80"
                      >
                        {/* ID & Pasien */}
                        <td className="py-[12px] pl-[14px] pr-[8px]">
                          <div className="text-[10.5px] font-bold leading-[1.25] text-[#0B3A5B]">
                            <span className="block">{row.casePrefix}</span>
                            <span className="block">{row.caseSuffix}</span>
                          </div>
                          <p className="mt-[2px] text-[9.5px] font-bold leading-[1.25] text-[#0B3A5B]">
                            {row.patientName}
                          </p>
                          <div className="mt-[2px] text-[9px] leading-[1.25] text-[#5B6B7B]">
                            <span className="block">
                              {row.patientCodePrefix}
                            </span>
                            <span className="block">
                              {row.patientCodeSuffix}
                            </span>
                          </div>
                        </td>

                        {/* Jenis Rawat */}
                        <td className="px-[8px] py-[12px]">
                          <span className="inline-flex items-center gap-[5px] rounded-[4px] bg-[#EAF0FB] px-[7px] py-[4px] text-[9.5px] font-semibold text-[#0B3A5B] whitespace-nowrap">
                            {row.careKind === "inap" ? (
                              <Bed
                                className="h-[11px] w-[11px] shrink-0 text-[#154B6B]"
                                strokeWidth={1.9}
                              />
                            ) : (
                              <SquarePlus
                                className="h-[11px] w-[11px] shrink-0 text-[#154B6B]"
                                strokeWidth={1.9}
                              />
                            )}
                            {row.careLabel}
                          </span>
                        </td>

                        {/* Tanggal */}
                        <td className="px-[8px] py-[12px] text-[10px] font-medium text-[#0B3A5B] whitespace-nowrap">
                          {row.dateLabel}
                        </td>

                        {/* Penjamin (COB) */}
                        <td className="px-[8px] py-[12px]">
                          <p className="max-w-[100px] text-[9.5px] font-bold leading-[1.3] text-[#0B3A5B]">
                            {row.primaryPayer}
                          </p>
                          {row.secondaryPayer && (
                            <p className="mt-[2px] max-w-[100px] text-[9px] leading-[1.3] text-[#5B6B7B]">
                              {row.secondaryPayer}
                            </p>
                          )}
                        </td>

                        {/* Status Klaim */}
                        <td className="px-[8px] py-[12px]">
                          <span
                            className={cn(
                              "inline-flex items-center gap-[5px] rounded-full px-[9px] py-[4px] text-[9.5px] font-bold leading-[1.2]",
                              row.claimStatusTone === "blue" &&
                                "bg-[#DCE8F9] text-[#0B3A5B]",
                              row.claimStatusTone === "pink" &&
                                "bg-[#FCE4EA] text-[#D0214F]",
                              row.claimStatusTone === "peach" &&
                                "bg-[#FFE4C4] text-[#A8510B]"
                            )}
                          >
                            {row.claimStatusIcon === "dot-navy" && (
                              <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#0B3A5B]" />
                            )}
                            {row.claimStatusIcon === "dot-red" && (
                              <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#D0214F]" />
                            )}
                            {row.claimStatusIcon === "check" && (
                              <CheckCircle2
                                className="h-[11px] w-[11px] shrink-0"
                                strokeWidth={2}
                              />
                            )}
                            {row.claimStatusIcon === "clock" && (
                              <Clock
                                className="h-[11px] w-[11px] shrink-0"
                                strokeWidth={2}
                              />
                            )}
                            <span>{row.claimStatusLabel}</span>
                          </span>
                          {row.claimSubtext && (
                            <p
                              className={cn(
                                "mt-[4px] max-w-[125px] text-[8.5px] leading-[1.3]",
                                row.claimSubtextRed
                                  ? "font-medium text-[#D0214F]"
                                  : "text-[#5B6B7B]"
                              )}
                            >
                              {row.claimSubtext}
                            </p>
                          )}
                        </td>

                        {/* Pembayaran */}
                        <td className="py-[12px] pl-[8px] pr-[6px]">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-[8px] py-[3px] text-[9.5px] font-bold whitespace-nowrap",
                              row.paymentTone === "peach" &&
                                "bg-[#FFE4C4] text-[#A8510B]",
                              row.paymentTone === "muted" &&
                                "bg-[#EAF0FB] text-[#5B6B7B]",
                              row.paymentTone === "blue" &&
                                "bg-[#DCE8F9] text-[#0B3A5B]"
                            )}
                          >
                            {row.paymentLabel}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Tabel */}
            <div className="flex items-center justify-between bg-[#EAF0FB] px-[14px] py-[9px]">
              <p className="text-[9.5px] font-medium text-[#5B6B7B]">
                Menampilkan {filteredCases.length} dari {kpi.totalActive} berkas
                kasus aktif
              </p>
              <div className="flex items-center gap-[4px]">
                <button
                  type="button"
                  aria-label="Halaman sebelumnya"
                  className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] text-[#5B6B7B] hover:bg-white/70 cursor-pointer"
                >
                  <ChevronLeft className="h-[12px] w-[12px]" />
                </button>
                <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[4px] bg-white px-[6px] text-[10px] font-bold text-[#0B3A5B] shadow-2xs">
                  1
                </span>
                <button
                  type="button"
                  aria-label="Halaman berikutnya"
                  className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] text-[#5B6B7B] hover:bg-white/70 cursor-pointer"
                >
                  <ChevronRight className="h-[12px] w-[12px]" />
                </button>
              </div>
            </div>
          </section>

          {/* 9) KARTU KALKULATOR */}
          <section className="flex flex-col justify-between gap-3 rounded-[10px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)] sm:flex-row sm:items-center">
            <div className="flex items-start gap-[12px] sm:items-center">
              <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] bg-[#0B3A5B] text-white">
                <GitFork className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[13.5px] font-bold leading-snug text-[#0B3A5B]">
                  Simulasi &amp; Kalkulator Split-Bill Terpadu
                </h2>
                <p className="mt-[2px] text-[10.5px] leading-[1.4] text-[#5B6B7B]">
                  Hitung pembagian proporsional plafon INA-CBG terhadap excess
                  claim asuransi komersial secara otomatis.
                </p>
              </div>
            </div>

            <Link
              href="/cases"
              className="inline-flex shrink-0 items-center justify-center gap-[6px] rounded-[8px] bg-[#DCE8F9] px-[12px] py-[8px] text-[10.5px] font-bold text-[#0B3A5B] transition-colors hover:bg-[#CBE0F7]"
            >
              <Calculator className="h-[13px] w-[13px]" strokeWidth={2} />
              <span>Buka Kalkulator COB</span>
            </Link>
          </section>
        </div>

        {/* 10) KOLOM KANAN */}
        <aside className="space-y-[14px]">
          {/* A. Perlu Tindak Lanjut */}
          <section className="rounded-[10px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-[7px]">
                <span
                  className="h-[8px] w-[8px] shrink-0 rounded-full bg-[#D0214F]"
                  aria-hidden="true"
                />
                <h2 className="text-[13.5px] font-bold text-[#0B3A5B]">
                  Perlu Tindak Lanjut
                </h2>
              </div>
              <span className="rounded-full bg-[#FCE4EA] px-[8px] py-[3px] text-[8.5px] font-bold leading-none text-[#D0214F]">
                {actions.length} Prioritas
              </span>
            </div>

            <div className="mt-[10px] space-y-[8px]">
              {actions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[6px] bg-[#EAF0FB] p-[10px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9.5px] font-bold text-[#0B3A5B]">
                      {item.caseCode}
                    </span>
                    <span
                      className={cn(
                        "text-[8.5px] font-extrabold uppercase tracking-[0.04em]",
                        item.badgeTone === "red" && "text-[#D0214F]",
                        item.badgeTone === "peach" && "text-[#A8510B]",
                        item.badgeTone === "navy" && "text-[#0B3A5B]"
                      )}
                    >
                      {item.badge}
                    </span>
                  </div>

                  <p className="mt-[4px] text-[10px] leading-[1.45] text-[#5B6B7B]">
                    {item.description}
                  </p>

                  <div className="mt-[8px] flex justify-end">
                    <Link
                      href="/cases"
                      className={cn(
                        "inline-flex items-center gap-[5px] rounded-[6px] px-[9px] py-[5px] text-[9.5px] font-bold transition-colors",
                        item.buttonVariant === "navy"
                          ? "bg-[#0B3A5B] text-white hover:bg-[#154B6B]"
                          : "bg-[#DCE8F9] text-[#0B3A5B] hover:bg-[#CBE0F7]"
                      )}
                    >
                      {item.buttonIcon === "upload" && (
                        <FileUp className="h-[11px] w-[11px]" strokeWidth={2} />
                      )}
                      {item.buttonIcon === "link" && (
                        <Link2 className="h-[11px] w-[11px]" strokeWidth={2} />
                      )}
                      {item.buttonIcon === "split" && (
                        <GitFork
                          className="h-[11px] w-[11px]"
                          strokeWidth={2}
                        />
                      )}
                      <span>{item.buttonLabel}</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* B. Aktivitas Terbaru */}
          <section className="rounded-[10px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13.5px] font-bold text-[#0B3A5B]">
                Aktivitas Terbaru
              </h2>
              <History
                className="h-[14px] w-[14px] text-[#5B6B7B]"
                strokeWidth={1.8}
              />
            </div>

            <div className="relative mt-[12px] space-y-[12px] pl-[16px] before:absolute before:bottom-[6px] before:left-[3px] before:top-[6px] before:w-[1px] before:bg-[#E3EAF5]">
              <div className="relative">
                <span className="absolute -left-[16px] top-[3px] h-[7px] w-[7px] rounded-full bg-[#0B3A5B]" />
                <p className="text-[9.5px] font-medium text-[#5B6B7B]">
                  Hari ini, 10:45 WIB
                </p>
                <p className="mt-[2px] text-[10.5px] leading-[1.45] text-[#5B6B7B]">
                  <strong className="font-bold text-[#0B3A5B]">
                    BPJS Kesehatan
                  </strong>{" "}
                  menyetujui subklaim KAS-2026-001 sebesar{" "}
                  <strong className="font-bold text-[#0B3A5B]">
                    Rp 37.500.000
                  </strong>
                  .
                </p>
              </div>

              <div className="relative">
                <span className="absolute -left-[16px] top-[3px] h-[7px] w-[7px] rounded-full bg-[#94A3B8]" />
                <p className="text-[9.5px] font-medium text-[#5B6B7B]">
                  Hari ini, 09:15 WIB
                </p>
                <p className="mt-[2px] text-[10.5px] leading-[1.45] text-[#5B6B7B]">
                  Dokumen revisi resume medis diunggah oleh Petugas Rina untuk
                  kasus KAS-2026-002.
                </p>
              </div>

              <div className="relative">
                <span className="absolute -left-[16px] top-[3px] h-[7px] w-[7px] rounded-full bg-[#7FA9CE]" />
                <p className="text-[9.5px] font-medium text-[#5B6B7B]">
                  Kemarin, 16:30 WIB
                </p>
                <p className="mt-[2px] text-[10.5px] leading-[1.45] text-[#5B6B7B]">
                  Penerimaan dana klaim sebesar{" "}
                  <strong className="font-bold text-[#0B3A5B]">
                    Rp 22.000.000
                  </strong>{" "}
                  dicatat untuk KAS-2025-089 (Lunas).
                </p>
              </div>
            </div>
          </section>

          {/* C. Alokasi Biaya Bulan Ini */}
          <section className="rounded-[10px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13.5px] font-bold text-[#0B3A5B]">
                Alokasi Biaya Bulan Ini
              </h2>
              <span className="text-[9.5px] font-semibold text-[#5B6B7B]">
                Nov 2026
              </span>
            </div>
            <p className="mt-[2px] text-[10px] text-[#5B6B7B]">
              Distribusi penjaminan portofolio klaim aktif.
            </p>

            {/* Stacked Horizontal Bar 55 / 35 / 10 */}
            <div className="mt-[12px] flex h-[8px] w-full overflow-hidden rounded-full bg-[#EAF0FB]">
              <div
                className="h-full bg-[#0B3A5B]"
                style={{ width: "55%" }}
                title="BPJS Kesehatan: 55%"
              />
              <div
                className="h-full bg-[#1F5F8B]"
                style={{ width: "35%" }}
                title="Asuransi Tambahan: 35%"
              />
              <div
                className="h-full bg-[#D0214F]"
                style={{ width: "10%" }}
                title="Ekses Pasien (OOP): 10%"
              />
            </div>

            {/* Legenda 3 Baris */}
            <div className="mt-[12px] space-y-[7px]">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-[7px] text-[10.5px] font-medium text-[#0B3A5B]">
                  <span className="h-[7px] w-[7px] rounded-full bg-[#0B3A5B]" />
                  BPJS Kesehatan
                </span>
                <span className="text-[10.5px] font-bold text-[#0B3A5B]">
                  55%{" "}
                  <span className="text-[9.5px] font-normal text-[#5B6B7B]">
                    (Rp 245,2 Jt)
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-[7px] text-[10.5px] font-medium text-[#0B3A5B]">
                  <span className="h-[7px] w-[7px] rounded-full bg-[#1F5F8B]" />
                  Asuransi Tambahan
                </span>
                <span className="text-[10.5px] font-bold text-[#0B3A5B]">
                  35%{" "}
                  <span className="text-[9.5px] font-normal text-[#5B6B7B]">
                    (Rp 156,0 Jt)
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-[7px] text-[10.5px] font-medium text-[#0B3A5B]">
                  <span className="h-[7px] w-[7px] rounded-full bg-[#D0214F]" />
                  Ekses Pasien (OOP)
                </span>
                <span className="text-[10.5px] font-bold text-[#D0214F]">
                  10%{" "}
                  <span className="text-[9.5px] font-normal text-[#5B6B7B]">
                    (Rp 44,5 Jt)
                  </span>
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Modal Konfigurasi Matriks Mode Simulasi */}
      <Modal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        title="Konfigurasi Matriks Simulasi"
        description="Pilih mode koordinasi penjamin yang aktif di Hospital Workspace."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              isLoading={savingMode}
              onClick={handleSaveSimulationMode}
            >
              Simpan Konfigurasi
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          {(
            [
              {
                mode: "COB" as const,
                title: "Mode COB (Coordination of Benefits)",
                desc: "BPJS Kesehatan sebagai penjamin primer dan Asuransi Swasta sebagai penjamin sekunder.",
              },
              {
                mode: "NON_COB" as const,
                title: "Mode Non-COB (BPJS Tunggal)",
                desc: "Klaim hanya diajukan ke BPJS Kesehatan; porsi asuransi swasta dikunci.",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setDraftMode(opt.mode)}
              className={cn(
                "w-full rounded-[8px] border p-3 text-left transition-colors cursor-pointer",
                draftMode === opt.mode
                  ? "border-[#154B6B] bg-[#EAF0FB]"
                  : "border-[#E3EAF5] bg-white hover:bg-[#F6F8FE]"
              )}
            >
              <p className="text-xs font-bold text-[#0B3A5B]">{opt.title}</p>
              <p className="mt-1 text-[11px] text-[#5B6B7B]">{opt.desc}</p>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
