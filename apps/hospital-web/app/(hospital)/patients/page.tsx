"use client";

import * as React from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Info,
  ReceiptText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { getPatients, getPatientSummary } from "@/lib/api";
import { getAccessToken } from "@/lib/auth/token";
import { cn } from "@/lib/utils/cn";
import { useWorkspace } from "@/components/layout";
import { Button, Modal, useToast } from "@/components/ui";
import type {
  PatientDirectoryItem,
  PatientDirectoryTab,
  PatientPayerFilter,
} from "@/types/patient";

interface PatientRowView {
  id: number;
  patientCode: string;
  initials: string;
  avatarBg: string;
  avatarText: string;
  fullName: string;
  nik: string;
  ageLabel: string;
  genderCode: "P" | "L";
  payerChips: string[];
  membershipLine: string;
  caseCount: number;
  latestCaseCode: string;
  latestCareText: string;
  hasPrivateInsurer: boolean;
  tabFlags: PatientDirectoryTab[];
}

const AVATAR_PALETTE = [
  { bg: "#DCE8F9", text: "#154B6B" }, // AR blue
  { bg: "#FCE4EA", text: "#D0214F" }, // BS pink
  { bg: "#D6F2E4", text: "#1E9E6A" }, // SR green
  { bg: "#FFE2B5", text: "#A8510B" }, // AW orange
  { bg: "#EADFFB", text: "#7B4FC9" }, // DL lavender
] as const;

const REFERENCE_PATIENTS: PatientRowView[] = [
  {
    id: 1,
    patientCode: "PAT-2026-001",
    initials: "AR",
    avatarBg: "#DCE8F9",
    avatarText: "#154B6B",
    fullName: "Aulia Ramadhani",
    nik: "3171092837480001",
    ageLabel: "34 Th",
    genderCode: "P",
    payerChips: ["BPJS Kesehatan", "Asuransi Sehat Sentosa"],
    membershipLine: "No: 000182739281 • COB Ganda",
    caseCount: 2,
    latestCaseCode: "KAS-2026-001",
    latestCareText: "Rawat Inap Paviliun",
    hasPrivateInsurer: true,
    tabFlags: ["ALL", "ACTIVE_CASE", "UNPAID"],
  },
  {
    id: 2,
    patientCode: "PAT-2026-002",
    initials: "BS",
    avatarBg: "#FCE4EA",
    avatarText: "#D0214F",
    fullName: "Budi Santoso",
    nik: "3275011904780004",
    ageLabel: "48 Th",
    genderCode: "L",
    payerChips: ["BPJS Kesehatan", "Mandiri Inhealth"],
    membershipLine: "No: 000293847291 • COB Ganda",
    caseCount: 1,
    latestCaseCode: "KAS-2026-002",
    latestCareText: "Rawat Inap VIP",
    hasPrivateInsurer: true,
    tabFlags: ["ALL", "ACTIVE_CASE", "ACTION_REQUIRED", "UNPAID"],
  },
  {
    id: 3,
    patientCode: "PAT-2026-003",
    initials: "SR",
    avatarBg: "#D6F2E4",
    avatarText: "#1E9E6A",
    fullName: "Siti Rahayu",
    nik: "3174055208850002",
    ageLabel: "39 Th",
    genderCode: "P",
    payerChips: ["BPJS Kesehatan Tunggal"],
    membershipLine: "No: 000384729104 • Penjamin Utama",
    caseCount: 3,
    latestCaseCode: "KAS-2026-003",
    latestCareText: "Rawat Jalan Poliklinik",
    hasPrivateInsurer: false,
    tabFlags: ["ALL"],
  },
  {
    id: 4,
    patientCode: "PAT-2026-004",
    initials: "AW",
    avatarBg: "#FFE2B5",
    avatarText: "#A8510B",
    fullName: "Ahmad Wijaya",
    nik: "3271032105730005",
    ageLabel: "51 Th",
    genderCode: "L",
    payerChips: ["BPJS Kesehatan", "Prudential Life"],
    membershipLine: "No: 000492819284 • COB Ganda",
    caseCount: 1,
    latestCaseCode: "KAS-2026-004",
    latestCareText: "Rawat Inap Bedah",
    hasPrivateInsurer: true,
    tabFlags: ["ALL", "ACTIVE_CASE", "ACTION_REQUIRED", "UNPAID"],
  },
  {
    id: 5,
    patientCode: "PAT-2026-005",
    initials: "DL",
    avatarBg: "#EADFFB",
    avatarText: "#7B4FC9",
    fullName: "Dewi Lestari",
    nik: "3173086711920003",
    ageLabel: "32 Th",
    genderCode: "P",
    payerChips: ["BPJS Kesehatan", "Manulife"],
    membershipLine: "No: 000572849182 • COB Ganda",
    caseCount: 2,
    latestCaseCode: "KAS-2026-005",
    latestCareText: "Rawat Inap Obgyn",
    hasPrivateInsurer: true,
    tabFlags: ["ALL", "ACTIVE_CASE", "ACTION_REQUIRED"],
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function mapApiPatientToRow(
  item: PatientDirectoryItem,
  idx: number
): PatientRowView {
  const palette = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
  const hasPrivate = item.coverages.some(
    (c) => c.payer_type === "PRIVATE_INSURANCE"
  );
  const primaryNumber =
    item.coverages[0]?.card_or_policy_number || "000000000000";

  const chips =
    item.coverages.length > 0
      ? hasPrivate
        ? item.coverages.map((c) => c.insurer_name)
        : [`${item.coverages[0].insurer_name} Tunggal`]
      : ["BPJS Kesehatan Tunggal"];

  const flags: PatientDirectoryTab[] = ["ALL"];
  if (item.latest_case && item.latest_case.payment_status !== "PAID") {
    flags.push("ACTIVE_CASE", "UNPAID");
  }
  if (item.latest_case?.coordination_status === "ACTION_REQUIRED") {
    flags.push("ACTION_REQUIRED");
  }

  return {
    id: item.id,
    patientCode: item.patient_code,
    initials: getInitials(item.full_name),
    avatarBg: palette.bg,
    avatarText: palette.text,
    fullName: item.full_name,
    nik: item.nik,
    ageLabel: `${item.age || 30} Th`,
    genderCode: item.gender === "L" ? "L" : "P",
    payerChips: chips,
    membershipLine: `No: ${primaryNumber} • ${hasPrivate ? "COB Ganda" : "Penjamin Utama"}`,
    caseCount: item.total_cases,
    latestCaseCode: item.latest_case?.case_number || "—",
    latestCareText:
      item.latest_case?.care_type_label === "RAWAT_INAP"
        ? "Rawat Inap"
        : item.latest_case?.care_type_label === "RAWAT_JALAN"
          ? "Rawat Jalan"
          : item.latest_case?.care_type_label || "Belum Ada Kasus",
    hasPrivateInsurer: hasPrivate,
    tabFlags: flags,
  };
}

function SquareWarningIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="12" y1="8" x2="12" y2="12.5" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" />
    </svg>
  );
}

export default function PatientsDirectoryPage() {
  const { searchQuery: globalSearch } = useWorkspace();
  const { toast } = useToast();

  const [localSearch, setLocalSearch] = React.useState("");
  const [payerFilter, setPayerFilter] =
    React.useState<PatientPayerFilter>("ALL");
  const [activeTab, setActiveTab] =
    React.useState<PatientDirectoryTab>("ALL");
  const [pageSize, setPageSize] = React.useState<number>(5);
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [sopModalOpen, setSopModalOpen] = React.useState(false);

  const [extraApiPatients, setExtraApiPatients] = React.useState<
    PatientRowView[]
  >([]);

  React.useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    let cancelled = false;
    Promise.allSettled([
      getPatientSummary(),
      getPatients({ page: 1, limit: 20 }),
    ]).then(([, listRes]) => {
      if (cancelled) return;
      if (
        listRes.status === "fulfilled" &&
        Array.isArray(listRes.value.data)
      ) {
        const knownCodes = new Set(
          REFERENCE_PATIENTS.map((p) => p.patientCode)
        );
        const newlyAdded = listRes.value.data
          .filter((item) => !knownCodes.has(item.patient_code))
          .map((item, idx) =>
            mapApiPatientToRow(item, REFERENCE_PATIENTS.length + idx)
          );
        setExtraApiPatients(newlyAdded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const allPatients = React.useMemo(
    () => [...extraApiPatients, ...REFERENCE_PATIENTS],
    [extraApiPatients]
  );

  const effectiveQuery = (localSearch || globalSearch).trim().toLowerCase();

  const filteredPatients = React.useMemo(() => {
    return allPatients.filter((row) => {
      if (activeTab !== "ALL" && !row.tabFlags.includes(activeTab)) {
        return false;
      }
      if (payerFilter === "PRIVATE_INSURANCE" && !row.hasPrivateInsurer) {
        return false;
      }
      if (!effectiveQuery) return true;
      return (
        row.fullName.toLowerCase().includes(effectiveQuery) ||
        row.nik.toLowerCase().includes(effectiveQuery) ||
        row.patientCode.toLowerCase().includes(effectiveQuery) ||
        row.payerChips.some((chip) =>
          chip.toLowerCase().includes(effectiveQuery)
        )
      );
    });
  }, [allPatients, activeTab, payerFilter, effectiveQuery]);

  const totalRegisteredDisplay = 142 + extraApiPatients.length;
  const displayedRows = filteredPatients.slice(0, pageSize);

  const handleExportCsv = () => {
    const headers = [
      "ID Pasien",
      "Nama Pasien",
      "NIK",
      "Usia & Gender",
      "Penjamin",
      "Jumlah Kasus",
      "Kasus Terakhir",
    ];
    const lines = filteredPatients.map((p) =>
      [
        p.patientCode,
        `"${p.fullName}"`,
        `"${p.nik}"`,
        `"${p.ageLabel} (${p.genderCode})"`,
        `"${p.payerChips.join(" + ")}"`,
        p.caseCount,
        p.latestCaseCode,
      ].join(",")
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "direktori-pasien-kapj.csv";
    a.click();
    URL.revokeObjectURL(url);

    toast({
      variant: "success",
      title: "Data Pasien Diekspor",
      description: "Berkas CSV direktori pasien berhasil diunduh.",
    });
  };

  const handlePendingFeature = (featureName: string) => {
    toast({
      variant: "info",
      title: featureName,
      description:
        "Halaman ini akan ditambahkan pada tahap implementasi berikutnya.",
    });
  };

  return (
    <div className="space-y-[14px]">
      {/* 5) EMPAT KARTU STATISTIK */}
      <section
        aria-label="Ringkasan direktori pasien"
        className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* Stat 1 */}
        <div className="flex min-h-[68px] items-center justify-between gap-3 rounded-[10px] border border-[#E3EAF5] bg-white px-[14px] py-[12px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[#5B6B7B]">
              TOTAL PASIEN TERDAFTAR
            </p>
            <div className="mt-[4px] flex flex-wrap items-baseline gap-[6px]">
              <span className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[#0B3A5B]">
                {totalRegisteredDisplay}
              </span>
              <span className="inline-flex items-center gap-[2px] text-[10px] font-bold text-[#1E9E6A]">
                <TrendingUp className="h-[11px] w-[11px]" strokeWidth={2.2} />
                <span>+12% bln ini</span>
              </span>
            </div>
          </div>

          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[#DCE8F9] text-[#0B3A5B]">
            <Users className="h-[16px] w-[16px]" strokeWidth={1.85} />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="flex min-h-[68px] items-center justify-between gap-3 rounded-[10px] border border-[#E3EAF5] bg-white px-[14px] py-[12px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
          <div className="min-w-0">
            <p className="max-w-[140px] text-[9px] font-bold uppercase leading-[1.3] tracking-[0.05em] text-[#5B6B7B]">
              KASUS AKTIF (RAWAT INAP/JALAN)
            </p>
            <div className="mt-[3px] flex flex-wrap items-baseline gap-[6px]">
              <span className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[#0B3A5B]">
                24
              </span>
              <span className="text-[10.5px] font-medium text-[#5B6B7B]">
                sedang berjalan
              </span>
            </div>
          </div>

          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[#DCE8F9] text-[#0B3A5B]">
            <Activity className="h-[16px] w-[16px]" strokeWidth={1.9} />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="flex min-h-[68px] items-center justify-between gap-3 rounded-[10px] border border-[#E3EAF5] bg-white px-[14px] py-[12px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[#D0214F]">
              PERLU TINDAK LANJUT COB
            </p>
            <div className="mt-[4px] flex flex-wrap items-baseline gap-[6px]">
              <span className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[#D0214F]">
                6
              </span>
              <span className="text-[10.5px] font-medium text-[#D0214F]">
                revisi berkas/limit
              </span>
            </div>
          </div>

          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[#FCE4EA] text-[#D0214F]">
            <SquareWarningIcon className="h-[16px] w-[16px]" />
          </div>
        </div>

        {/* Stat 4 */}
        <div className="flex min-h-[68px] items-center justify-between gap-3 rounded-[10px] border border-[#E3EAF5] bg-white px-[14px] py-[12px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-[#5B6B7B]">
              MENUNGGU PEMBAYARAN
            </p>
            <div className="mt-[4px] flex flex-wrap items-baseline gap-[6px]">
              <span className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[#0B3A5B]">
                8
              </span>
              <span className="text-[10.5px] font-semibold text-[#D9731A]">
                split-bill pending
              </span>
            </div>
          </div>

          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[#FFE4C4] text-[#A8510B]">
            <ReceiptText className="h-[16px] w-[16px]" strokeWidth={1.85} />
          </div>
        </div>
      </section>

      {/* 6) KARTU HERO */}
      <section
        aria-labelledby="patients-hero-heading"
        style={{
          backgroundImage:
            "radial-gradient(circle at 84% 50%, rgba(220, 232, 249, 0.7) 0%, rgba(234, 240, 251, 0.28) 32%, rgba(255, 255, 255, 0) 64%)",
        }}
        className="relative flex min-h-[156px] flex-col justify-between gap-4 overflow-hidden rounded-[12px] border border-[#E3EAF5] bg-white px-[20px] py-[20px] shadow-[0_4px_18px_rgba(11,58,91,0.06)] sm:flex-row sm:items-center"
      >
        {/* Kiri: Label + H1 + Paragraf sempit 5 baris */}
        <div>
          <div className="flex items-center gap-[5px] text-[9.5px] font-bold uppercase tracking-[0.05em] text-[#0B3A5B]">
            <Building2 className="h-[12px] w-[12px]" strokeWidth={1.85} />
            <span>HOSPITAL OPS &middot; DIREKTORI PASIEN</span>
          </div>

          <h1
            id="patients-hero-heading"
            className="mt-[6px] text-[28px] font-extrabold leading-[1.15] tracking-[-0.015em] text-[#0B3A5B]"
          >
            Data Pasien
          </h1>

          <p className="mt-[6px] max-w-[155px] text-[11px] font-normal leading-[1.5] text-[#5B6B7B]">
            Kelola informasi identitas
            <br />
            pasien, riwayat
            <br />
            kepesertaan penjamin,
            <br />
            dan status kasus
            <br />
            perawatan aktif.
          </p>
        </div>

        {/* Kanan: Tombol Ekspor Data & + Tambah Pasien */}
        <div className="flex shrink-0 items-center gap-[10px]">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-[32px] items-center gap-[6px] rounded-[6px] border border-[#E3EAF5] bg-white px-[12px] text-[11px] font-semibold text-[#0B3A5B] transition-colors hover:bg-[#F6F8FE] cursor-pointer"
          >
            <Download className="h-[12px] w-[12px]" strokeWidth={1.9} />
            <span>Ekspor Data</span>
          </button>

          <button
            type="button"
            onClick={() => handlePendingFeature("Registrasi Pasien Baru")}
            className="inline-flex h-[32px] items-center gap-[6px] rounded-[6px] bg-[#0B3A5B] px-[16px] text-[11px] font-bold text-white transition-colors hover:bg-[#154B6B] cursor-pointer"
          >
            <UserPlus className="h-[13px] w-[13px]" strokeWidth={2} />
            <span>+ Tambah Pasien</span>
          </button>
        </div>
      </section>

      {/* 7) KARTU UTAMA (Filter + Tab + Tabel + Paginasi) */}
      <section className="rounded-[12px] border border-[#E3EAF5] bg-white p-[15px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]">
        {/* a. Baris filter */}
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-[465px]">
            <Search
              className="pointer-events-none absolute left-[11px] top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-[#5B6B7B]"
              strokeWidth={1.85}
            />
            <input
              type="search"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari nama, NIK, atau ID pasien (contoh: PAT-2026-001)..."
              className="h-[34px] w-full rounded-[8px] bg-[#EAF0FB] pl-[32px] pr-[12px] text-[11px] font-medium text-[#0B3A5B] placeholder:text-[#5B6B7B] focus:outline-none focus:ring-1 focus:ring-[#154B6B]/40"
            />
          </div>

          <div className="flex shrink-0 items-center gap-[8px]">
            <div className="relative inline-flex h-[34px] items-center rounded-[6px] border border-[#E3EAF5] bg-[#EAF0FB] pl-[10px] pr-[26px] text-[11px]">
              <ShieldCheck
                className="mr-[5px] h-[13px] w-[13px] shrink-0 text-[#5B6B7B]"
                strokeWidth={1.85}
              />
              <span className="mr-[4px] font-medium text-[#5B6B7B]">
                Penjamin:
              </span>
              <select
                aria-label="Filter penjamin"
                value={payerFilter}
                onChange={(e) => {
                  setPayerFilter(e.target.value as PatientPayerFilter);
                  setCurrentPage(1);
                }}
                className="appearance-none bg-transparent font-bold text-[#0B3A5B] focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Penjamin</option>
                <option value="BPJS">BPJS Kesehatan</option>
                <option value="PRIVATE_INSURANCE">Asuransi Swasta</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-[8px] h-[12px] w-[12px] text-[#5B6B7B]"
                strokeWidth={2}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setLocalSearch("");
                setPayerFilter("ALL");
                setActiveTab("ALL");
                setCurrentPage(1);
              }}
              title="Reset filter"
              aria-label="Pengaturan filter lanjutan"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[6px] border border-[#E3EAF5] bg-[#EAF0FB] text-[#0B3A5B] transition-colors hover:bg-[#DCE8F9] cursor-pointer"
            >
              <SlidersHorizontal
                className="h-[14px] w-[14px]"
                strokeWidth={1.9}
              />
            </button>
          </div>
        </div>

        {/* b. Tab pill */}
        <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
          <button
            type="button"
            onClick={() => {
              setActiveTab("ALL");
              setCurrentPage(1);
            }}
            className={cn(
              "inline-flex h-[26px] items-center rounded-full border px-[12px] text-[10px] font-semibold transition-colors cursor-pointer",
              activeTab === "ALL"
                ? "border-[#154B6B] bg-[#154B6B] text-white"
                : "border-[#E3EAF5] bg-white text-[#0B3A5B] hover:bg-[#EAF0FB]"
            )}
          >
            Semua Pasien ({totalRegisteredDisplay})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("ACTIVE_CASE");
              setCurrentPage(1);
            }}
            className={cn(
              "inline-flex h-[26px] items-center rounded-full border px-[12px] text-[10px] font-semibold transition-colors cursor-pointer",
              activeTab === "ACTIVE_CASE"
                ? "border-[#154B6B] bg-[#154B6B] text-white"
                : "border-[#E3EAF5] bg-white text-[#0B3A5B] hover:bg-[#EAF0FB]"
            )}
          >
            Kasus Aktif (24)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("ACTION_REQUIRED");
              setCurrentPage(1);
            }}
            className={cn(
              "inline-flex h-[26px] items-center gap-[5px] rounded-full border px-[12px] text-[10px] font-semibold transition-colors cursor-pointer",
              activeTab === "ACTION_REQUIRED"
                ? "border-[#D0214F] bg-[#D0214F] text-white"
                : "border-[#E3EAF5] bg-white text-[#D0214F] hover:bg-[#FCE4EA]/50"
            )}
          >
            <span
              className={cn(
                "h-[5px] w-[5px] rounded-full",
                activeTab === "ACTION_REQUIRED" ? "bg-white" : "bg-[#D0214F]"
              )}
              aria-hidden="true"
            />
            <span>Perlu Tindak Lanjut (6)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("UNPAID");
              setCurrentPage(1);
            }}
            className={cn(
              "inline-flex h-[26px] items-center rounded-full border px-[12px] text-[10px] font-semibold transition-colors cursor-pointer",
              activeTab === "UNPAID"
                ? "border-[#154B6B] bg-[#154B6B] text-white"
                : "border-[#E3EAF5] bg-white text-[#0B3A5B] hover:bg-[#EAF0FB]"
            )}
          >
            Menunggu Pembayaran (8)
          </button>
        </div>

        {/* c, d, e. Tabel Pasien (kolom KASUS PERAWATAN terpotong tanpa ellipsis persis seperti gambar) */}
        <div className="mt-[14px] overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
            <thead>
              <tr className="h-[34px] bg-[#EAF0FB] text-[9.5px] font-bold uppercase tracking-[0.04em] text-[#5B6B7B]">
                <th className="w-[120px] rounded-l-[6px] pl-[12px] pr-[8px]">
                  ID PASIEN
                </th>
                <th className="w-[235px] px-[8px]">NAMA PASIEN &amp; NIK</th>
                <th className="w-[245px] px-[8px]">
                  NOMOR KEPESERTAAN / PENJAMIN
                </th>
                <th className="w-[106px] px-[6px] text-center">
                  JUMLAH KASUS
                </th>
                <th className="w-[96px] max-w-[96px] overflow-hidden pl-[8px] pr-0 whitespace-nowrap text-clip">
                  KASUS PERAWATAN
                </th>
                <th className="w-[108px] rounded-r-[6px] pl-[6px] pr-[10px] text-right">
                  AKSI
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E3EAF5]/65">
              {displayedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-[11.5px] text-[#5B6B7B]"
                  >
                    Tidak ada pasien yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="h-[68px] align-middle transition-colors hover:bg-[#F6F8FE]/70"
                  >
                    {/* ID Pasien */}
                    <td className="py-[10px] pl-[12px] pr-[8px]">
                      <span className="inline-block rounded-[4px] bg-[#EAF0FB] px-[8px] py-[4px] text-[10.5px] font-bold leading-none text-[#0B3A5B]">
                        {row.patientCode}
                      </span>
                    </td>

                    {/* Nama Pasien & NIK */}
                    <td className="px-[8px] py-[10px]">
                      <div className="flex items-center gap-[10px]">
                        <div
                          style={{
                            backgroundColor: row.avatarBg,
                            color: row.avatarText,
                          }}
                          className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                        >
                          {row.initials}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[14.5px] font-bold leading-[1.2] text-[#0B3A5B]">
                            {row.fullName}
                          </p>
                          <div className="mt-[2px] flex items-start gap-[8px] text-[10px] leading-[1.25] text-[#5B6B7B]">
                            <div>
                              <span className="block">NIK:</span>
                              <span className="block">{row.nik}</span>
                            </div>
                            <div className="flex items-start gap-[4px]">
                              <span className="mt-[6px] leading-none">
                                &bull;
                              </span>
                              <div>
                                <span className="block">{row.ageLabel}</span>
                                <span className="block">
                                  ({row.genderCode})
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Nomor Kepesertaan / Penjamin */}
                    <td className="px-[8px] py-[10px]">
                      <div className="flex max-w-[225px] flex-wrap gap-[4px]">
                        {row.payerChips.map((chip) => (
                          <span
                            key={chip}
                            className="inline-flex items-center gap-[4px] rounded-[4px] bg-[#EAF0FB] px-[6px] py-[3px] text-[9.5px] font-semibold leading-none text-[#0B3A5B]"
                          >
                            <ShieldCheck
                              className="h-[10px] w-[10px] shrink-0 text-[#154B6B]"
                              strokeWidth={2}
                            />
                            <span>{chip}</span>
                          </span>
                        ))}
                      </div>
                      <p className="mt-[4px] text-[10px] leading-[1.25] text-[#5B6B7B]">
                        {row.membershipLine}
                      </p>
                    </td>

                    {/* Jumlah Kasus */}
                    <td className="px-[6px] py-[10px] text-center">
                      <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#EAF0FB] text-[11px] font-bold text-[#0B3A5B]">
                        {row.caseCount}
                      </span>
                    </td>

                    {/* Kasus Perawatan (terpotong di batas kolom tanpa ellipsis) */}
                    <td className="w-[96px] max-w-[96px] overflow-hidden py-[10px] pl-[8px] pr-0 whitespace-nowrap text-clip">
                      <p className="overflow-hidden text-[10.5px] font-bold leading-[1.25] text-[#0B3A5B] whitespace-nowrap text-clip">
                        {row.latestCaseCode}
                      </p>
                      <p className="mt-[2px] overflow-hidden text-[10px] leading-[1.25] text-[#5B6B7B] whitespace-nowrap text-clip">
                        {row.latestCareText}
                      </p>
                    </td>

                    {/* Aksi */}
                    <td className="py-[10px] pl-[6px] pr-[2px] text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handlePendingFeature(`Profil ${row.fullName}`)
                        }
                        className="inline-flex h-[28px] items-center gap-[4px] rounded-[6px] bg-[#E3ECFA] px-[10px] text-[10px] font-bold text-[#0B3A5B] transition-colors hover:bg-[#D2E1F8] whitespace-nowrap cursor-pointer"
                      >
                        <span>Buka Profil</span>
                        <ArrowRight
                          className="h-[11px] w-[11px]"
                          strokeWidth={2.2}
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* f. Baris paginasi */}
        <div className="mt-[12px] flex flex-col items-center justify-between gap-3 border-t border-[#E3EAF5] pt-[12px] sm:flex-row">
          <div className="flex flex-wrap items-center gap-[8px] text-[10.5px] text-[#5B6B7B]">
            <p>
              Menampilkan{" "}
              <strong className="font-bold text-[#0B3A5B]">
                {displayedRows.length > 0
                  ? `1–${displayedRows.length}`
                  : "0"}
              </strong>{" "}
              dari{" "}
              <strong className="font-bold text-[#0B3A5B]">
                {totalRegisteredDisplay}
              </strong>{" "}
              pasien
            </p>
            <span>&middot;</span>
            <label className="inline-flex items-center gap-[6px]">
              <span>Tampilkan:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-[24px] rounded-[5px] border border-[#E3EAF5] bg-white px-[7px] text-[10.5px] font-semibold text-[#0B3A5B] focus:outline-none cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </label>
          </div>

          <nav
            aria-label="Paginasi pasien"
            className="flex items-center gap-[5px] text-[10.5px]"
          >
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-[26px] items-center gap-[3px] rounded-[6px] px-[8px] font-medium text-[#5B6B7B]/60 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-[11px] w-[11px]" />
              <span>Sebelumnya</span>
            </button>

            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setCurrentPage(p)}
                className={cn(
                  "flex h-[26px] min-w-[26px] items-center justify-center rounded-[6px] px-[6px] font-bold transition-colors cursor-pointer",
                  currentPage === p
                    ? "bg-[#154B6B] text-white"
                    : "border border-[#E3EAF5] bg-white text-[#0B3A5B] hover:bg-[#F6F8FE]"
                )}
              >
                {p}
              </button>
            ))}

            <span className="px-[4px] text-[#5B6B7B]">&hellip;</span>

            <button
              type="button"
              onClick={() => setCurrentPage(29)}
              className={cn(
                "flex h-[26px] min-w-[26px] items-center justify-center rounded-[6px] px-[6px] font-bold transition-colors cursor-pointer",
                currentPage === 29
                  ? "bg-[#154B6B] text-white"
                  : "border border-[#E3EAF5] bg-white text-[#0B3A5B] hover:bg-[#F6F8FE]"
              )}
            >
              29
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(29, p + 1))}
              className="inline-flex h-[26px] items-center gap-[3px] rounded-[6px] border border-[#E3EAF5] bg-white px-[10px] font-bold text-[#0B3A5B] transition-colors hover:bg-[#F6F8FE] cursor-pointer"
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-[11px] w-[11px]" />
            </button>
          </nav>
        </div>
      </section>

      {/* 8) BANNER INFO */}
      <section className="flex flex-col justify-between gap-3 rounded-[10px] bg-[#EAF0FB] px-[15px] py-[11px] sm:flex-row sm:items-center">
        <div className="flex items-start gap-[10px]">
          <Info
            className="mt-[2px] h-[16px] w-[16px] shrink-0 text-[#0B3A5B]"
            strokeWidth={1.85}
          />
          <div>
            <h2 className="text-[11px] font-bold text-[#0B3A5B]">
              Integrasi Data Penjamin &amp; Rekam Medis (EHR)
            </h2>
            <p className="mt-[2px] max-w-[740px] text-[10.5px] leading-[1.45] text-[#5B6B7B]">
              Penyelarasan nomor rujukan BPJS dan polis asuransi swasta
              dikerjakan otomatis saat pasien terdaftar di admisi rawat inap.
              Gunakan tombol{" "}
              <strong className="font-bold text-[#0B3A5B]">
                &ldquo;Buka Profil&rdquo;
              </strong>{" "}
              untuk memvalidasi limit COB atau riwayat split-billing sebelumnya.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSopModalOpen(true)}
          className="inline-flex shrink-0 items-center gap-[4px] self-end text-[10.5px] font-bold text-[#0B3A5B] underline underline-offset-2 hover:text-[#154B6B] sm:self-center cursor-pointer"
        >
          <span>Panduan SOP Pasien COB</span>
          <ExternalLink className="h-[11px] w-[11px]" strokeWidth={2} />
        </button>
      </section>

      {/* Modal Panduan SOP Pasien COB */}
      <Modal
        open={sopModalOpen}
        onClose={() => setSopModalOpen(false)}
        title="Panduan SOP Admisi Pasien COB"
        description="Standar Operasional Koordinasi Penjamin BPJS Kesehatan & Asuransi Swasta"
        size="md"
        footer={
          <Button size="sm" onClick={() => setSopModalOpen(false)}>
            Tutup Panduan
          </Button>
        }
      >
        <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-[#5B6B7B]">
          <li>
            Pastikan kepesertaan aktif pada kartu <strong className="text-[#0B3A5B]">BPJS Kesehatan</strong> (13 digit) sebagai penjamin primer.
          </li>
          <li>
            Catat polis <strong className="text-[#0B3A5B]">Asuransi Swasta</strong> sekunder beserta plafon tahunan dan limit kamar harian sebelum membuat episode rawat.
          </li>
          <li>
            Gunakan tombol <strong className="text-[#0B3A5B]">Buka Profil</strong> untuk memeriksa sisa limit tahunan dan riwayat klaim split-bill sebelumnya.
          </li>
        </ol>
      </Modal>
    </div>
  );
}
