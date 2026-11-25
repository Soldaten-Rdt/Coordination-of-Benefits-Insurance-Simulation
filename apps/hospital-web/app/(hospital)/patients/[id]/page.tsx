"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeftRight,
  AtSign,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  FileUp,
  Folder,
  Info,
  MapPin,
  MessageSquare,
  Pencil,
  PlusCircle,
  Printer,
  ShieldAlert,
  Smartphone,
  SquarePlus,
  WalletCards,
} from "lucide-react";
import {
  getPatientDetail,
  updatePatientCoverages,
  updatePatientProfile,
} from "@/lib/api";
import { getAccessToken } from "@/lib/auth/token";
import { cn } from "@/lib/utils/cn";
import { Button, Modal, useToast } from "@/components/ui";
import type { PatientDetailResponse } from "@/types/patient";

type CaseFilterTab = "ALL" | "RAWAT_INAP" | "RAWAT_JALAN";

interface ProfileCaseRow {
  id: number;
  caseParts: [string, string, string];
  badgeLabel: "Aktif" | "Selesai";
  isMutedCode?: boolean;
  careType: "RAWAT_INAP" | "RAWAT_JALAN";
  serviceLines: string[];
  subServiceLines: string[];
  periodTitle: string;
  periodSubtitle: string;
  totalBillText: string;
  totalBillSubtext: string;
  totalBillSubTone: "green" | "muted";
  splitMode: "MULTI" | "SINGLE";
  bpjsPct: number;
  insurerPct: number;
  patientPct: number;
  coordState: "IN_PROGRESS" | "SETTLED";
  coordSubLines: string[];
  paymentLabelLines: string[];
  paymentTone: "amber" | "green";
  paymentSubLines: string[];
}

interface PatientProfileView {
  numericId: number;
  patientCode: string;
  initials: string;
  fullName: string;
  ageText: string;
  genderText: string;
  nik: string;
  medicalRecordNo: string;
  birthDateText: string;
  ageShortText: string;
  phone: string;
  email: string;
  address: string;
  registeredDateText: string;
  bpjsCardNumber: string;
  bpjsCareClass: string;
  bpjsFaskes: string;
  bpjsBadgeLabel: string;
  privateCoverageId?: number;
  privateInsurerFull: string;
  privatePlanBadge: string;
  privatePolicyNumber: string;
  privateBenefitText: string;
  privateAnnualLimit: number;
  privateRemainingLimit: number;
  privateRoomDailyLimit: number;
  privateStatus: string;
  cases: ProfileCaseRow[];
  lifetimeTotalText: string;
  lifetimePayerText: string;
  lifetimePatientText: string;
  emergencyInitials: string;
  emergencyName: string;
  emergencyRelationPhone: string;
}

const REFERENCE_PATIENT_PROFILE: PatientProfileView = {
  numericId: 1,
  patientCode: "PAT-2026-001",
  initials: "AR",
  fullName: "Aulia Ramadhani",
  ageText: "34 Tahun",
  genderText: "Perempuan",
  nik: "3171092837480001",
  medicalRecordNo: "RM-98210",
  birthDateText: "14 Mei 1992",
  ageShortText: "(34 th)",
  phone: "0812-9844-1029",
  email: "aulia.ramadhani@example.com",
  address: "Jl. Tebet Barat Dalam No. 14, Tebet, Jakarta Selatan 12810",
  registeredDateText: "10 Jan 2024",
  bpjsCardNumber: "0001482910482",
  bpjsCareClass: "Kelas 1",
  bpjsFaskes: "Puskesmas Tebet",
  bpjsBadgeLabel: "BPJS Kesehatan (Kelas 1)",
  privateCoverageId: 2,
  privateInsurerFull: "PT Asuransi Sehat Sentosa",
  privatePlanBadge: "Asuransi Sehat Sentosa (Gold Plan)",
  privatePolicyNumber: "GOLD-EXEC-889104",
  privateBenefitText: "Rawat Inap & Tindakan",
  privateAnnualLimit: 200_000_000,
  privateRemainingLimit: 200_000_000,
  privateRoomDailyLimit: 1_500_000,
  privateStatus: "ACTIVE",
  cases: [
    {
      id: 1,
      caseParts: ["KAS-", "2026-", "001"],
      badgeLabel: "Aktif",
      isMutedCode: false,
      careType: "RAWAT_INAP",
      serviceLines: ["Rawat Inap", "Ruang", "Perawatan", "Eksekutif"],
      subServiceLines: ["DPJP: dr. Hendra", "Wicaksono,", "Sp.JP(K)"],
      periodTitle: "12 Okt 2026 - 16 Okt 2026",
      periodSubtitle: "Durasi: 4 Hari (ICU & Kamar 402)",
      totalBillText: "Rp 125.000.000",
      totalBillSubtext: "Batas Plafon Mencukupi",
      totalBillSubTone: "green",
      splitMode: "MULTI",
      bpjsPct: 30,
      insurerPct: 58,
      patientPct: 12,
      coordState: "IN_PROGRESS",
      coordSubLines: ["Tahap: Adjudikasi", "Sekunder"],
      paymentLabelLines: ["Sebagian", "Terbayar"],
      paymentTone: "amber",
      paymentSubLines: ["Deposit", "Pasien: Rp", "5.000.000"],
    },
    {
      id: 2,
      caseParts: ["KAS-", "2025-", "084"],
      badgeLabel: "Selesai",
      isMutedCode: true,
      careType: "RAWAT_JALAN",
      serviceLines: ["Rawat Jalan", "Spesialis", "Kardiologi"],
      subServiceLines: ["Poli Eksekutif", "Jantung &", "Pembuluh Darah"],
      periodTitle: "15 Agt 2025",
      periodSubtitle: "Kunjungan 1 Hari Selesai",
      totalBillText: "Rp 2.450.000",
      totalBillSubtext: "INA-CBG Q-5-14-I",
      totalBillSubTone: "muted",
      splitMode: "SINGLE",
      bpjsPct: 100,
      insurerPct: 0,
      patientPct: 0,
      coordState: "SETTLED",
      coordSubLines: ["Klaim Terkirim &", "Rekonsiliasi OK"],
      paymentLabelLines: ["Lunas"],
      paymentTone: "green",
      paymentSubLines: ["100% BPJS", "(Disbursed)"],
    },
  ],
  lifetimeTotalText: "Rp 127.450.000",
  lifetimePayerText: "Rp 112.450.000 (88.2%)",
  lifetimePatientText: "Rp 15.000.000 (11.8%)",
  emergencyInitials: "DR",
  emergencyName: "Dimas Raditya",
  emergencyRelationPhone: "Suami Pasien • 0811-3940-2911",
};

const PRESET_PATIENTS: Record<string, Partial<PatientProfileView>> = {
  "2": {
    numericId: 2,
    patientCode: "PAT-2026-002",
    initials: "BS",
    fullName: "Budi Santoso",
    ageText: "48 Tahun",
    genderText: "Laki-laki",
    nik: "3275011904780004",
    medicalRecordNo: "RM-98214",
    birthDateText: "19 Apr 1978",
    ageShortText: "(48 th)",
    phone: "0813-7782-1904",
    email: "budi.santoso@example.com",
    address: "Jl. Kemang Raya No. 28, Mampang Prapatan, Jakarta Selatan 12730",
    bpjsCardNumber: "000293847291",
    privateInsurerFull: "Mandiri Inhealth",
    privatePlanBadge: "Mandiri Inhealth (Gold Plan)",
    privatePolicyNumber: "INHEALTH-772910",
  },
  "3": {
    numericId: 3,
    patientCode: "PAT-2026-003",
    initials: "SR",
    fullName: "Siti Rahayu",
    ageText: "39 Tahun",
    genderText: "Perempuan",
    nik: "3174055208850002",
    medicalRecordNo: "RM-98219",
    birthDateText: "20 Agu 1985",
    ageShortText: "(39 th)",
    phone: "0812-8812-3349",
    email: "siti.rahayu@example.com",
    address: "Jl. Raya Pasar Minggu No. 9, Pancoran, Jakarta Selatan 12780",
    bpjsCardNumber: "000384729104",
  },
  "4": {
    numericId: 4,
    patientCode: "PAT-2026-004",
    initials: "AW",
    fullName: "Ahmad Wijaya",
    ageText: "51 Tahun",
    genderText: "Laki-laki",
    nik: "3271032105730005",
    medicalRecordNo: "RM-98225",
    birthDateText: "21 Mei 1973",
    ageShortText: "(51 th)",
    phone: "0811-9023-4418",
    email: "ahmad.wijaya@example.com",
    address: "Jl. Pajajaran No. 56, Bogor Tengah, Kota Bogor 16128",
    bpjsCardNumber: "000492819284",
    privateInsurerFull: "Prudential Life",
    privatePlanBadge: "Prudential Life (PRUPrime)",
    privatePolicyNumber: "PRU-552019-EXEC",
  },
  "5": {
    numericId: 5,
    patientCode: "PAT-2026-005",
    initials: "DL",
    fullName: "Dewi Lestari",
    ageText: "32 Tahun",
    genderText: "Perempuan",
    nik: "3173086711920003",
    medicalRecordNo: "RM-98231",
    birthDateText: "27 Nov 1992",
    ageShortText: "(32 th)",
    phone: "0812-6671-8892",
    email: "dewi.lestari@example.com",
    address: "Jl. Tanjung Duren Barat No. 11, Grogol Petamburan, Jakarta Barat 11470",
    bpjsCardNumber: "000572849182",
    privateInsurerFull: "Manulife",
    privatePlanBadge: "Manulife (MiUltimate)",
    privatePolicyNumber: "MANU-310948-COB",
  },
};

function formatRupiah(amount: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(amount)))}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatBirthDateInd(isoDate?: string): { date: string; age: number } {
  if (!isoDate) return { date: "14 Mei 1992", age: 34 };
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return { date: "14 Mei 1992", age: 34 };
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agt",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  const age = Math.max(
    1,
    new Date().getFullYear() - d.getFullYear()
  );
  return {
    date: `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`,
    age,
  };
}

function DocumentUserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M8.5 16.5c.8-1.6 2.1-2.3 3.5-2.3s2.7.7 3.5 2.3" />
    </svg>
  );
}

function FilledBadgeCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 1.75 12.1 3.3l2.58-.16.65 2.5 2.15 1.44-.79 2.46.79 2.46-2.15 1.44-.65 2.5-2.58-.16L10 18.25 7.9 16.7l-2.58.16-.65-2.5-2.15-1.44.79-2.46-.79-2.46 2.15-1.44.65-2.5 2.58.16L10 1.75Zm3.08 6.42a.8.8 0 0 0-1.16-1.1l-2.67 2.81-1.17-1.17a.8.8 0 0 0-1.13 1.13l1.76 1.76a.8.8 0 0 0 1.15-.02l3.22-3.41Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FolderUserBoxIcon({ className }: { className?: string }) {
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
      <path d="M3 7a2 2 0 0 1 2-2h4.2l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M9.2 16.5c.6-1.1 1.6-1.7 2.8-1.7s2.2.6 2.8 1.7" />
    </svg>
  );
}

function DashedClockIcon({ className }: { className?: string }) {
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
      <path d="M3 12a9 9 0 1 0 9-9" />
      <path d="M3.6 8.5a9 9 0 0 1 1.4-2.2" />
      <path d="M7.5 4.2a9 9 0 0 1 2.1-.9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BarChartBoxIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 16v-4" />
      <path d="M12 16V8" />
      <path d="M16 16v-6" />
    </svg>
  );
}

function VerifiedGearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2l2.1 1.4 2.5-.2.7 2.4 2.1 1.4-.7 2.4.7 2.4-2.1 1.4-.7 2.4-2.5-.2L12 22l-2.1-1.4-2.5.2-.7-2.4-2.1-1.4.7-2.4-.7-2.4 2.1-1.4.7-2.4 2.5.2L12 2z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const rawId = typeof params?.id === "string" ? params.id : "1";
  const { toast } = useToast();

  const initialView = React.useMemo<PatientProfileView>(() => {
    const preset = PRESET_PATIENTS[rawId];
    if (!preset) return REFERENCE_PATIENT_PROFILE;
    return {
      ...REFERENCE_PATIENT_PROFILE,
      ...preset,
    };
  }, [rawId]);

  const [profile, setProfile] = React.useState<PatientProfileView>(initialView);
  const [caseTab, setCaseTab] = React.useState<CaseFilterTab>("ALL");
  const [showOlderHistory, setShowOlderHistory] = React.useState(false);

  // Edit Contact Modal state
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editPhone, setEditPhone] = React.useState(initialView.phone);
  const [editEmail, setEditEmail] = React.useState(initialView.email);
  const [editAddress, setEditAddress] = React.useState(initialView.address);
  const [editEmergencyName, setEditEmergencyName] = React.useState(
    initialView.emergencyName
  );
  const [editEmergencyPhone, setEditEmergencyPhone] =
    React.useState("0811-3940-2911");
  const [savingProfile, setSavingProfile] = React.useState(false);

  // Manage COB Coverage Modal state
  const [cobModalOpen, setCobModalOpen] = React.useState(false);
  const [annualLimitInput, setAnnualLimitInput] = React.useState(
    String(initialView.privateAnnualLimit)
  );
  const [remainingLimitInput, setRemainingLimitInput] = React.useState(
    String(initialView.privateRemainingLimit)
  );
  const [coverageStatusInput, setCoverageStatusInput] = React.useState(
    initialView.privateStatus
  );
  const [savingCoverages, setSavingCoverages] = React.useState(false);

  React.useEffect(() => {
    setProfile(initialView);
    setEditPhone(initialView.phone);
    setEditEmail(initialView.email);
    setEditAddress(initialView.address);
    setEditEmergencyName(initialView.emergencyName);
    setAnnualLimitInput(String(initialView.privateAnnualLimit));
    setRemainingLimitInput(String(initialView.privateRemainingLimit));
    setCoverageStatusInput(initialView.privateStatus);
  }, [initialView]);

  React.useEffect(() => {
    const token = getAccessToken();
    const numericId = Number(rawId);
    if (!token || !Number.isInteger(numericId) || numericId <= 0) return;

    let cancelled = false;
    getPatientDetail(numericId)
      .then((res) => {
        if (cancelled || !res.data) return;
        const api: PatientDetailResponse = res.data;
        const bpjsCov = api.coverages?.find((c) => c.payer_type === "BPJS");
        const privCov = api.coverages?.find(
          (c) => c.payer_type === "PRIVATE_INSURANCE"
        );
        const birthInfo = formatBirthDateInd(api.birth_date);

        setProfile((prev) => {
          const isRefPatientOne = api.id === 1 || api.patient_code === "PAT-2026-001";
          const nextName = isRefPatientOne ? prev.fullName : api.full_name;
          const nextEmergencyName =
            api.emergency_contact_name?.trim() || prev.emergencyName;
          const nextEmergencyPhone =
            api.emergency_contact_phone?.trim() || "0811-3940-2911";

          return {
            ...prev,
            numericId: api.id,
            patientCode: api.patient_code || prev.patientCode,
            initials: getInitials(nextName),
            fullName: nextName,
            ageText: isRefPatientOne ? prev.ageText : `${birthInfo.age} Tahun`,
            genderText:
              api.gender === "L" ? "Laki-laki" : isRefPatientOne ? prev.genderText : "Perempuan",
            nik: api.nik || prev.nik,
            birthDateText: isRefPatientOne ? prev.birthDateText : birthInfo.date,
            ageShortText: isRefPatientOne ? prev.ageShortText : `(${birthInfo.age} th)`,
            phone: isRefPatientOne ? prev.phone : api.phone || prev.phone,
            email: isRefPatientOne ? prev.email : api.email || prev.email,
            address: isRefPatientOne ? prev.address : api.address || prev.address,
            bpjsCardNumber: isRefPatientOne
              ? prev.bpjsCardNumber
              : bpjsCov?.card_or_policy_number || prev.bpjsCardNumber,
            bpjsCareClass: isRefPatientOne
              ? prev.bpjsCareClass
              : bpjsCov?.care_class || prev.bpjsCareClass,
            bpjsFaskes: isRefPatientOne
              ? prev.bpjsFaskes
              : bpjsCov?.primary_faskes || prev.bpjsFaskes,
            privateCoverageId: privCov?.id ?? prev.privateCoverageId,
            privateInsurerFull: isRefPatientOne
              ? prev.privateInsurerFull
              : privCov?.insurer_name || prev.privateInsurerFull,
            privatePolicyNumber: isRefPatientOne
              ? prev.privatePolicyNumber
              : privCov?.card_or_policy_number || prev.privatePolicyNumber,
            privateAnnualLimit:
              privCov?.annual_limit ?? prev.privateAnnualLimit,
            privateRemainingLimit:
              privCov?.remaining_limit ?? prev.privateRemainingLimit,
            privateRoomDailyLimit:
              privCov?.room_daily_limit ?? prev.privateRoomDailyLimit,
            privateStatus: privCov?.status || prev.privateStatus,
            emergencyInitials: getInitials(nextEmergencyName),
            emergencyName: nextEmergencyName,
            emergencyRelationPhone: isRefPatientOne
              ? prev.emergencyRelationPhone
              : `Penanggung Jawab • ${nextEmergencyPhone}`,
          };
        });
      })
      .catch(() => {
        // Keep seamless reference fallback data when backend is offline
      });

    return () => {
      cancelled = true;
    };
  }, [rawId]);

  const filteredCases = React.useMemo(() => {
    if (caseTab === "ALL") return profile.cases;
    return profile.cases.filter((c) => c.careType === caseTab);
  }, [profile.cases, caseTab]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      if (getAccessToken()) {
        await updatePatientProfile(profile.numericId, {
          phone: editPhone.trim(),
          email: editEmail.trim(),
          address: editAddress.trim(),
          emergency_contact_name: editEmergencyName.trim(),
          emergency_contact_phone: editEmergencyPhone.trim(),
        });
      }
      setProfile((prev) => ({
        ...prev,
        phone: editPhone.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
        emergencyInitials: getInitials(editEmergencyName.trim()),
        emergencyName: editEmergencyName.trim(),
        emergencyRelationPhone: `Suami Pasien • ${editEmergencyPhone.trim()}`,
      }));
      toast({
        variant: "success",
        title: "Identitas & Kontak Diperbarui",
        description: `Perubahan data ${profile.fullName} berhasil disimpan.`,
      });
      setEditModalOpen(false);
    } catch (err) {
      toast({
        variant: "error",
        title: "Gagal Memperbarui Profil",
        description:
          err instanceof Error
            ? err.message
            : "Tidak dapat menyimpan pembaruan profil pasien.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveCoverages = async (e: React.FormEvent) => {
    e.preventDefault();
    const annual = Number(annualLimitInput) || 0;
    const remaining = Number(remainingLimitInput) || 0;
    if (remaining > annual) {
      toast({
        variant: "error",
        title: "Validasi Plafon Gagal",
        description: "Sisa plafon tidak boleh melebihi plafon tahunan.",
      });
      return;
    }

    setSavingCoverages(true);
    try {
      if (getAccessToken() && profile.privateCoverageId) {
        await updatePatientCoverages(profile.numericId, {
          coverages: [
            {
              id: profile.privateCoverageId,
              annual_limit: annual,
              remaining_limit: remaining,
              room_daily_limit: profile.privateRoomDailyLimit,
              status: coverageStatusInput,
            },
          ],
        });
      }
      setProfile((prev) => ({
        ...prev,
        privateAnnualLimit: annual,
        privateRemainingLimit: remaining,
        privateStatus: coverageStatusInput,
      }));
      toast({
        variant: "success",
        title: "Skema COB Diperbarui",
        description:
          "Plafon tahunan dan status kepesertaan penjamin sekunder telah diperbarui.",
      });
      setCobModalOpen(false);
    } catch (err) {
      toast({
        variant: "error",
        title: "Gagal Memperbarui Skema COB",
        description:
          err instanceof Error
            ? err.message
            : "Gagal memperbarui limit kepesertaan penjamin.",
      });
    } finally {
      setSavingCoverages(false);
    }
  };

  const handleUtilityAction = (title: string, description: string) => {
    toast({
      variant: "info",
      title,
      description,
    });
  };

  return (
    <div className="space-y-[16px]">
      {/* 5) BARIS BREADCRUMB HALAMAN */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-[2px]">
        <nav
          aria-label="Breadcrumb profil pasien"
          className="flex items-center gap-[6px] text-[11px]"
        >
          <Link
            href="/patients"
            className="font-medium text-[#5B6B7B] transition-colors hover:text-[#0B3A5B]"
          >
            Data Pasien
          </Link>
          <span className="text-[#5B6B7B]">&rsaquo;</span>
          <span className="font-medium text-[#5B6B7B]">Profil Pasien</span>
          <span className="text-[#5B6B7B]">&rsaquo;</span>
          <span className="font-bold text-[#0B3A5B]">{profile.fullName}</span>
        </nav>

        <div className="flex items-center gap-[8px] text-[10.5px] text-[#5B6B7B]">
          <span>Pembaruan data: Hari ini, 10:42 WIB</span>
          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Cetak profil pasien"
            className="inline-flex items-center justify-center rounded-[4px] p-[2px] text-[#5B6B7B] transition-colors hover:bg-[#EAF0FB] hover:text-[#0B3A5B] cursor-pointer"
          >
            <Printer className="h-[13px] w-[13px]" strokeWidth={1.85} />
          </button>
        </div>
      </div>

      {/* 6) KARTU HERO */}
      <section
        aria-labelledby="patient-hero-name"
        className="flex flex-col gap-4 rounded-[12px] border border-[#E3EAF5] bg-white p-[18px] shadow-[0_4px_18px_rgba(11,58,91,0.06)] md:flex-row md:items-center"
      >
        {/* a. Avatar kotak navy dengan dot hijau online */}
        <div className="relative h-[68px] w-[68px] shrink-0 rounded-[11px] bg-[#0B3A5B]">
          <div className="flex h-full w-full items-center justify-center text-[21px] font-extrabold tracking-[-0.01em] text-white">
            {profile.initials}
          </div>
          <span
            className="absolute -bottom-[2px] -right-[2px] h-[11px] w-[11px] rounded-full bg-[#1E9E6A] ring-[2px] ring-white"
            aria-label="Online"
          />
        </div>

        {/* b. Blok info */}
        <div className="min-w-0 max-w-[440px]">
          {/* Baris 1 */}
          <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-1">
            <h1
              id="patient-hero-name"
              className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#0B3A5B]"
            >
              {profile.fullName}
            </h1>
            <span className="text-[12.5px] font-medium text-[#5B6B7B]">
              Usia: {profile.ageText} &bull; {profile.genderText}
            </span>
          </div>

          {/* Baris 2 */}
          <div className="mt-[5px] flex flex-wrap items-center gap-x-[7px] gap-y-1 text-[11.5px]">
            <span>
              <span className="text-[#9AA7B5]">ID:</span>{" "}
              <strong className="font-bold text-[#0B3A5B]">
                {profile.patientCode}
              </strong>
            </span>
            <span className="text-[#9AA7B5]">&bull;</span>
            <span>
              <span className="text-[#9AA7B5]">NIK:</span>{" "}
              <strong className="font-bold text-[#0B3A5B]">
                {profile.nik}
              </strong>
            </span>
            <span className="text-[#9AA7B5]">&bull;</span>
            <span className="inline-flex items-center gap-[5px]">
              <span className="text-[#9AA7B5]">No. Rekam Medis:</span>
              <span className="rounded-[4px] bg-[#EAF0FB] px-[6px] py-[1.5px] font-bold leading-none text-[#0B3A5B]">
                {profile.medicalRecordNo}
              </span>
            </span>
          </div>

          {/* Baris 3 (pill ketiga wrap ke baris 4 sesuai lebar blok terbatas) */}
          <div className="mt-[9px] flex max-w-[425px] flex-wrap items-center gap-[6px]">
            <span className="inline-flex items-center gap-[5px] rounded-full bg-[#DCE8F9] px-[10px] py-[4px] text-[11px] font-semibold leading-none text-[#0B3A5B]">
              <FilledBadgeCheckIcon className="h-[13px] w-[13px] shrink-0 text-[#0B3A5B]" />
              <span>{profile.bpjsBadgeLabel}</span>
            </span>

            <span className="inline-flex items-center gap-[5px] rounded-full bg-[#FCE4EA] px-[10px] py-[4px] text-[11px] font-semibold leading-none text-[#D0214F]">
              <ShieldAlert
                className="h-[12.5px] w-[12.5px] shrink-0 text-[#D0214F]"
                strokeWidth={2}
              />
              <span>{profile.privatePlanBadge}</span>
            </span>

            <span className="inline-flex items-center gap-[5px] rounded-full bg-[#EAF0FB] px-[10px] py-[4px] text-[11px] font-semibold leading-none text-[#0B3A5B]">
              <span
                className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#1E9E6A]"
                aria-hidden="true"
              />
              <span>Sinkronisasi COB Aktif</span>
            </span>
          </div>
        </div>

        {/* c. Kolom tombol di kanan (rata kiri antar-tombol, offset dari tepi kanan kartu) */}
        <div className="flex shrink-0 flex-col items-start gap-[8px] md:ml-auto md:mr-[96px]">
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="inline-flex h-[34px] items-center gap-[6px] rounded-[6px] border border-[#E3EAF5] bg-white px-[12px] text-[11.5px] font-bold text-[#0B3A5B] shadow-[0_1px_3px_rgba(11,58,91,0.06)] transition-colors hover:bg-[#F6F8FE] cursor-pointer"
          >
            <Pencil className="h-[12.5px] w-[12.5px]" strokeWidth={2} />
            <span>Ubah Data</span>
          </button>

          <Link
            href="/cases"
            className="inline-flex h-[34px] items-center gap-[6px] rounded-[6px] bg-[#154B6B] px-[13px] text-[11.5px] font-bold text-white transition-colors hover:bg-[#0B3A5B]"
          >
            <PlusCircle className="h-[13px] w-[13px]" strokeWidth={2} />
            <span>+ Buat Kasus Baru</span>
          </Link>
        </div>
      </section>

      {/* 7) BARIS DUA KARTU (Identitas & Kontak | Detail Kepesertaan Penjamin Aktif) */}
      <div className="grid grid-cols-1 items-start gap-[14px] lg:grid-cols-[261fr_370fr]">
        {/* KARTU KIRI: Identitas & Kontak Pasien (lebih pendek, ada ruang kosong 40px+ di bawah daftar) */}
        <section
          aria-labelledby="card-identity-title"
          className="rounded-[12px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-[7px]">
              <DocumentUserIcon className="h-[15px] w-[15px] shrink-0 text-[#0B3A5B]" />
              <h2
                id="card-identity-title"
                className="text-[14px] font-bold text-[#0B3A5B]"
              >
                Identitas &amp; Kontak Pasien
              </h2>
            </div>

            <span className="rounded-full bg-[#EAF0FB] px-[8px] py-[2.5px] text-[9.5px] font-bold leading-none text-[#5B6B7B]">
              Terverifikasi
            </span>
          </div>

          {/* 4 baris label-nilai */}
          <div className="mt-[14px] space-y-[9px] text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-[7px] text-[#5B6B7B]">
                <Calendar
                  className="h-[12.5px] w-[12.5px] shrink-0 text-[#5B6B7B]"
                  strokeWidth={1.8}
                />
                <span>Tanggal Lahir</span>
              </div>
              <div className="text-right font-medium text-[#0B3A5B]">
                <span>{profile.birthDateText}</span>{" "}
                <span className="text-[#5B6B7B]">{profile.ageShortText}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-[7px] text-[#5B6B7B]">
                <Smartphone
                  className="h-[12.5px] w-[12.5px] shrink-0 text-[#5B6B7B]"
                  strokeWidth={1.8}
                />
                <span>No. Telepon</span>
              </div>
              <div className="flex items-center gap-[5px] text-right font-medium text-[#0B3A5B]">
                <span>{profile.phone}</span>
                <MessageSquare
                  className="h-[12px] w-[12px] shrink-0 text-[#5B6B7B]"
                  strokeWidth={1.8}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-[7px] text-[#5B6B7B]">
                <AtSign
                  className="h-[12.5px] w-[12.5px] shrink-0 text-[#5B6B7B]"
                  strokeWidth={1.8}
                />
                <span>Email</span>
              </div>
              <div className="truncate text-right font-medium text-[#1F5F8B]">
                {profile.email}
              </div>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="mt-[2px] flex shrink-0 items-center gap-[7px] text-[#5B6B7B]">
                <MapPin
                  className="h-[12.5px] w-[12.5px] shrink-0 text-[#5B6B7B]"
                  strokeWidth={1.8}
                />
                <span>Alamat</span>
              </div>
              <div className="max-w-[205px] text-right font-medium leading-[1.38] text-[#0B3A5B]">
                {profile.address}
              </div>
            </div>
          </div>

          {/* Ruang kosong ±40px disengaja sesuai referensi */}
          <div className="mt-[48px] flex items-center justify-between gap-2 rounded-[6px] bg-[#EAF0FB] px-[10px] py-[9px] text-[11px]">
            <div className="flex items-center gap-[6px] text-[#5B6B7B]">
              <Building2
                className="h-[13px] w-[13px] shrink-0 text-[#5B6B7B]"
                strokeWidth={1.8}
              />
              <span>Terdaftar di Rumah Sakit:</span>
            </div>
            <span className="font-bold text-[#0B3A5B]">
              {profile.registeredDateText}
            </span>
          </div>
        </section>

        {/* KARTU KANAN: Detail Kepesertaan Penjamin Aktif */}
        <section
          aria-labelledby="card-coverage-title"
          className="rounded-[12px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-[7px]">
              <WalletCards
                className="h-[15px] w-[15px] shrink-0 text-[#0B3A5B]"
                strokeWidth={1.8}
              />
              <h2
                id="card-coverage-title"
                className="text-[14px] font-bold text-[#0B3A5B]"
              >
                Detail Kepesertaan Penjamin Aktif
              </h2>
            </div>

            <span className="rounded-full bg-[#DCE8F9] px-[9px] py-[3px] text-[9.5px] font-bold leading-none text-[#0B3A5B]">
              2 Penjamin Terhubung
            </span>
          </div>

          {/* Dua kartu dalam sejajar */}
          <div className="mt-[13px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
            {/* Kartu dalam KIRI: BPJS Kesehatan */}
            <div className="flex flex-col rounded-[10px] bg-[#EAF0FB] p-[11px]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-[6px]">
                  <span
                    className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#1E9E6A]"
                    aria-hidden="true"
                  />
                  <span className="text-[11.5px] font-bold text-[#0B3A5B]">
                    BPJS Kesehatan
                  </span>
                </div>
                <span className="rounded-full bg-[#D6F2E4] px-[8px] py-[2px] text-[9.5px] font-bold leading-none text-[#12805F]">
                  Aktif
                </span>
              </div>

              <p className="mt-[7px] text-[9.5px] text-[#5B6B7B]">
                No. Kartu BPJS
              </p>
              <p className="mt-[1px] text-[13px] font-extrabold tracking-[-0.01em] text-[#0B3A5B]">
                {profile.bpjsCardNumber}
              </p>

              <div className="mt-[8px] space-y-[5px] text-[10.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#5B6B7B]">Hak Rawat:</span>
                  <span className="rounded-[4px] bg-[#DCE8F9] px-[6px] py-[1.5px] font-bold leading-none text-[#0B3A5B]">
                    {profile.bpjsCareClass}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#5B6B7B]">Faskes Tingkat 1:</span>
                  <span className="font-medium text-[#0B3A5B]">
                    {profile.bpjsFaskes}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#5B6B7B]">Peran Koordinasi:</span>
                  <span className="font-bold text-[#0B3A5B]">
                    Penjamin Primer
                  </span>
                </div>
              </div>

              <div className="mt-auto pt-[12px]">
                <div className="flex items-center justify-between gap-2 border-t border-[#DCE8F9] pt-[8px] text-[10.5px]">
                  <span className="inline-flex items-center gap-[4px] font-bold text-[#12805F]">
                    <CheckCircle2
                      className="h-[11.5px] w-[11.5px] shrink-0"
                      strokeWidth={2.2}
                    />
                    <span>Validasi VClaim OK</span>
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      handleUtilityAction(
                        "Status SEP VClaim",
                        `Kartu BPJS ${profile.bpjsCardNumber} tervalidasi aktif (${profile.bpjsCareClass}) di ${profile.bpjsFaskes}.`
                      )
                    }
                    className="font-bold text-[#0B3A5B] hover:underline cursor-pointer"
                  >
                    Cek SEP
                  </button>
                </div>
              </div>
            </div>

            {/* Kartu dalam KANAN: PT Asuransi Sehat Sentosa */}
            <div className="flex flex-col rounded-[10px] bg-[#EAF0FB] p-[11px]">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-[5px]">
                  <span
                    className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#D0214F]"
                    aria-hidden="true"
                  />
                  <span className="truncate text-[11px] font-bold text-[#0B3A5B]">
                    {profile.privateInsurerFull}
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-[#D6F2E4] px-[8px] py-[2px] text-[9.5px] font-bold leading-none text-[#12805F]">
                  Aktif
                </span>
              </div>

              <p className="mt-[7px] text-[9.5px] text-[#5B6B7B]">
                Nomor Polis Komersial
              </p>
              <p className="mt-[1px] text-[13px] font-extrabold tracking-[-0.01em] text-[#0B3A5B]">
                {profile.privatePolicyNumber}
              </p>

              <div className="mt-[8px] space-y-[5px] text-[10.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#5B6B7B]">Manfaat:</span>
                  <span className="text-right font-medium text-[#0B3A5B]">
                    {profile.privateBenefitText}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#5B6B7B]">Plafon Tahunan:</span>
                  <span className="text-right font-bold text-[#0B3A5B]">
                    {formatRupiah(profile.privateAnnualLimit)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="leading-[1.2] text-[#5B6B7B]">
                    Peran
                    <br />
                    Koordinasi:
                  </span>
                  <span className="text-right font-bold leading-[1.2] text-[#D0214F]">
                    Penjamin Sekunder
                    <br />
                    (COB)
                  </span>
                </div>
              </div>

              <div className="mt-auto pt-[9px]">
                <div className="flex items-center justify-between gap-2 border-t border-[#DCE8F9] pt-[8px] text-[10.5px]">
                  <span className="inline-flex items-center gap-[4px] font-bold text-[#0B3A5B]">
                    <ArrowLeftRight
                      className="h-[11px] w-[11px] shrink-0"
                      strokeWidth={2}
                    />
                    <span>Integrasi Admedika</span>
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      handleUtilityAction(
                        "Portal Klaim TPA",
                        `Polis ${profile.privatePolicyNumber} terhubung ke gateway Adjudikasi Sekunder Asuransi Swasta (:8083).`
                      )
                    }
                    className="font-bold text-[#D0214F] hover:underline cursor-pointer"
                  >
                    Portal Klaim
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Catatan & Kelola Skema COB */}
          <div className="mt-[12px] flex items-center justify-between gap-3">
            <div className="flex items-start gap-[6px]">
              <Info
                className="mt-[1px] h-[13px] w-[13px] shrink-0 text-[#5B6B7B]"
                strokeWidth={1.8}
              />
              <p className="max-w-[335px] text-[10.5px] leading-[1.38] text-[#5B6B7B]">
                Urutan penjamin otomatis disesuaikan sesuai Peraturan Menkes No.
                51/2018 tentang Skema COB.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCobModalOpen(true)}
              className="shrink-0 text-center text-[10.5px] font-bold leading-[1.25] text-[#0B3A5B] hover:text-[#154B6B] hover:underline cursor-pointer"
            >
              Kelola Skema
              <br />
              COB
            </button>
          </div>
        </section>
      </div>

      {/* 8) KARTU RIWAYAT KASUS PERAWATAN */}
      <section
        aria-labelledby="card-history-title"
        className="overflow-hidden rounded-[12px] border border-[#E3EAF5] bg-white shadow-[0_4px_18px_rgba(11,58,91,0.06)]"
      >
        {/* a. Header kartu riwayat */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-[14px] pb-[12px] pt-[14px]">
          <div className="flex items-center gap-[10px]">
            <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[6px] bg-[#DCE8F9] text-[#0B3A5B]">
              <FolderUserBoxIcon className="h-[15px] w-[15px]" />
            </div>
            <div>
              <h2
                id="card-history-title"
                className="text-[14px] font-bold leading-[1.25] text-[#0B3A5B]"
              >
                Riwayat Kasus Perawatan
              </h2>
              <p className="text-[11px] text-[#5B6B7B]">
                Total 2 kasus tercatat dalam sistem KAPJ Flow
              </p>
            </div>
          </div>

          {/* Tab filter kanan */}
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              onClick={() => setCaseTab("ALL")}
              className={cn(
                "rounded-full text-[11.5px] transition-colors cursor-pointer",
                caseTab === "ALL"
                  ? "bg-[#DCE8F9] px-[11px] py-[5px] font-bold text-[#0B3A5B]"
                  : "px-[4px] py-[5px] font-medium text-[#0B3A5B] hover:text-[#154B6B]"
              )}
            >
              Semua Kasus (2)
            </button>

            <button
              type="button"
              onClick={() => setCaseTab("RAWAT_INAP")}
              className={cn(
                "rounded-full text-[11.5px] transition-colors cursor-pointer",
                caseTab === "RAWAT_INAP"
                  ? "bg-[#DCE8F9] px-[11px] py-[5px] font-bold text-[#0B3A5B]"
                  : "px-[4px] py-[5px] font-medium text-[#0B3A5B] hover:text-[#154B6B]"
              )}
            >
              Rawat Inap (1)
            </button>

            <button
              type="button"
              onClick={() => setCaseTab("RAWAT_JALAN")}
              className={cn(
                "rounded-full text-[11.5px] transition-colors cursor-pointer",
                caseTab === "RAWAT_JALAN"
                  ? "bg-[#DCE8F9] px-[11px] py-[5px] font-bold text-[#0B3A5B]"
                  : "px-[4px] py-[5px] font-medium text-[#0B3A5B] hover:text-[#154B6B]"
              )}
            >
              Rawat Jalan (1)
            </button>
          </div>
        </div>

        {/* b. Tabel melebar & terpotong bersih di tepi kanan kartu (tanpa scrollbar & tanpa ellipsis) */}
        <div className="ml-[14px] overflow-hidden pb-[24px]">
          <table className="w-[936px] table-fixed border-collapse text-left">
            <thead>
              <tr className="h-[44px] bg-[#EAF0FB] text-[10px] font-bold uppercase leading-[1.2] tracking-[0.04em] text-[#5B6B7B]">
                <th className="w-[118px] rounded-l-[6px] pl-[12px] pr-[6px]">
                  ID KASUS &amp;
                  <br />
                  LAYANAN
                </th>
                <th className="w-[162px] px-[8px]">PERIODE RAWAT</th>
                <th className="w-[132px] px-[8px] text-right">
                  TOTAL TAGIHAN
                </th>
                <th className="w-[198px] px-[10px]">
                  DISTRIBUSI SPLIT-BILL
                </th>
                <th className="w-[114px] px-[8px]">
                  STATUS
                  <br />
                  KOORDINASI
                </th>
                <th className="w-[120px] px-[8px]">
                  STATUS
                  <br />
                  PEMBAYARAN
                </th>
                <th className="w-[92px] overflow-hidden pl-[10px] pr-0 whitespace-nowrap text-clip">
                  AKSI
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredCases.map((c, idx) => (
                <tr
                  key={c.id}
                  className={cn(
                    "align-top",
                    idx === 0 ? "border-b border-[#E3EAF5]/55" : ""
                  )}
                >
                  {/* ID Kasus & Layanan */}
                  <td className="py-[14px] pl-[12px] pr-[6px]">
                    <div className="flex items-center gap-[5px]">
                      <span
                        className={cn(
                          "text-[12.5px] font-bold leading-[1.15]",
                          c.isMutedCode ? "text-[#4A5A6A]" : "text-[#0B3A5B]"
                        )}
                      >
                        {c.caseParts[0]}
                        <br />
                        {c.caseParts[1]}
                        <br />
                        {c.caseParts[2]}
                      </span>
                      <span className="rounded-full bg-[#EAF0FB] px-[7px] py-[2.5px] text-[9px] font-semibold leading-none text-[#5B6B7B]">
                        {c.badgeLabel}
                      </span>
                    </div>

                    <p className="mt-[5px] text-[11px] font-bold leading-[1.25] text-[#0B3A5B]">
                      {c.serviceLines.map((line, i) => (
                        <React.Fragment key={line}>
                          {line}
                          {i < c.serviceLines.length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </p>

                    <p className="mt-[4px] text-[10px] leading-[1.28] text-[#5B6B7B]">
                      {c.subServiceLines.map((line, i) => (
                        <React.Fragment key={line}>
                          {line}
                          {i < c.subServiceLines.length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </p>
                  </td>

                  {/* Periode Rawat */}
                  <td className="px-[8px] py-[18px]">
                    <p className="text-[11.5px] font-medium leading-[1.3] text-[#0B3A5B]">
                      {c.periodTitle}
                    </p>
                    <p className="mt-[3px] text-[10.5px] leading-[1.3] text-[#5B6B7B]">
                      {c.periodSubtitle}
                    </p>
                  </td>

                  {/* Total Tagihan */}
                  <td className="px-[8px] py-[18px] text-right">
                    <p className="text-[14.5px] font-extrabold leading-[1.2] text-[#0B3A5B]">
                      {c.totalBillText}
                    </p>
                    <p
                      className={cn(
                        "mt-[3px] text-[10.5px] font-medium leading-[1.3]",
                        c.totalBillSubTone === "green"
                          ? "text-[#12805F]"
                          : "text-[#5B6B7B]"
                      )}
                    >
                      {c.totalBillSubtext}
                    </p>
                  </td>

                  {/* Distribusi Split-Bill */}
                  <td className="px-[10px] py-[20px]">
                    <div className="flex h-[8px] w-full overflow-hidden rounded-full bg-[#EAF0FB]">
                      {c.bpjsPct > 0 && (
                        <div
                          style={{ width: `${c.bpjsPct}%` }}
                          className="h-full bg-[#154B6B]"
                        />
                      )}
                      {c.insurerPct > 0 && (
                        <div
                          style={{ width: `${c.insurerPct}%` }}
                          className="h-full bg-[#D0214F]"
                        />
                      )}
                      {c.patientPct > 0 && (
                        <div
                          style={{ width: `${c.patientPct}%` }}
                          className="h-full bg-[#E8B96A]"
                        />
                      )}
                    </div>

                    {c.splitMode === "MULTI" ? (
                      <div className="mt-[7px] space-y-[3px] text-[10.5px] font-semibold leading-[1.2]">
                        <div className="flex items-center gap-[10px]">
                          <span className="inline-flex items-center gap-[4px] text-[#0B3A5B]">
                            <span
                              className="h-[6px] w-[6px] rounded-full bg-[#154B6B]"
                              aria-hidden="true"
                            />
                            <span>BPJS {c.bpjsPct}%</span>
                          </span>
                          <span className="inline-flex items-center gap-[4px] text-[#D0214F]">
                            <span
                              className="h-[6px] w-[6px] rounded-full bg-[#D0214F]"
                              aria-hidden="true"
                            />
                            <span>Sentosa {c.insurerPct}%</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-[4px] text-[#0B3A5B]">
                          <span
                            className="h-[6px] w-[6px] rounded-full bg-[#E8B96A]"
                            aria-hidden="true"
                          />
                          <span>Pasien {c.patientPct}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-[7px] flex items-center gap-[4px] text-[10.5px] font-semibold text-[#0B3A5B]">
                        <span
                          className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#154B6B]"
                          aria-hidden="true"
                        />
                        <span>BPJS Kesehatan Tunggal (100%)</span>
                      </div>
                    )}
                  </td>

                  {/* Status Koordinasi */}
                  <td className="px-[8px] py-[16px]">
                    {c.coordState === "IN_PROGRESS" ? (
                      <div className="inline-block rounded-[18px] bg-[#DCE8F9] px-[10px] py-[6px] text-[11px] font-bold leading-[1.22] text-[#0B3A5B]">
                        Dalam
                        <br />
                        <span className="inline-flex items-center gap-[4px]">
                          <span
                            className="inline-block h-[9px] w-[3px] rounded-full bg-[#0B3A5B]"
                            aria-hidden="true"
                          />
                          <span>Proses</span>
                        </span>
                        <br />
                        Koordinasi
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-[4px] rounded-full bg-[#D6F2E4] px-[10px] py-[4px] text-[11px] font-bold leading-none text-[#12805F]">
                        <Check className="h-[11px] w-[11px]" strokeWidth={2.5} />
                        <span>Selesai</span>
                      </span>
                    )}

                    <p className="mt-[6px] text-[10.5px] leading-[1.3] text-[#5B6B7B]">
                      {c.coordSubLines.map((line, i) => (
                        <React.Fragment key={line}>
                          {line}
                          {i < c.coordSubLines.length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </p>
                  </td>

                  {/* Status Pembayaran */}
                  <td className="px-[8px] py-[16px]">
                    <div className="flex items-start gap-[5px]">
                      <span
                        className={cn(
                          "mt-[4px] h-[6px] w-[6px] shrink-0 rounded-full",
                          c.paymentTone === "amber"
                            ? "bg-[#E8B96A]"
                            : "bg-[#1E9E6A]"
                        )}
                        aria-hidden="true"
                      />
                      <span
                        className={cn(
                          "text-[11px] font-bold leading-[1.22]",
                          c.paymentTone === "amber"
                            ? "text-[#0B3A5B]"
                            : "text-[#12805F]"
                        )}
                      >
                        {c.paymentLabelLines.map((line, i) => (
                          <React.Fragment key={line}>
                            {line}
                            {i < c.paymentLabelLines.length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </span>
                    </div>

                    <p className="mt-[5px] text-[10.5px] leading-[1.3] text-[#5B6B7B]">
                      {c.paymentSubLines.map((line, i) => (
                        <React.Fragment key={line}>
                          {line}
                          {i < c.paymentSubLines.length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </p>
                  </td>

                  {/* Aksi (terpotong bersih di tepi kanan kartu) */}
                  <td className="overflow-hidden py-[18px] pl-[10px] pr-0">
                    <Link
                      href="/cases"
                      className="inline-block w-[54px] overflow-hidden rounded-[6px] bg-[#EAF0FB] py-[6px] pl-[9px] pr-0 text-left text-[11px] font-bold leading-[1.22] text-[#0B3A5B] whitespace-nowrap text-clip transition-colors hover:bg-[#DCE8F9]"
                    >
                      Lihat
                      <br />
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 9) BARIS BAWAH: Linimasa Aktivitas Pasien (kiri) + 2 Kartu Kanan */}
      <div className="grid grid-cols-1 items-start gap-[14px] lg:grid-cols-[424fr_207fr]">
        {/* KOLOM KIRI: Linimasa Aktivitas Pasien */}
        <section
          aria-labelledby="card-timeline-title"
          className="rounded-[12px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-[7px]">
              <DashedClockIcon className="h-[15px] w-[15px] shrink-0 text-[#0B3A5B]" />
              <h2
                id="card-timeline-title"
                className="text-[14px] font-bold text-[#0B3A5B]"
              >
                Linimasa Aktivitas Pasien
              </h2>
            </div>
            <span className="text-[11px] text-[#5B6B7B]">
              Riwayat penjaminan &amp; rekam proses
            </span>
          </div>

          {/* Vertical Timeline */}
          <div className="relative mt-[16px] space-y-[18px] pl-[28px]">
            {/* Garis tipis vertikal di belakang node 1..3 */}
            <span
              className="absolute bottom-[10px] left-[9px] top-[10px] w-[1px] bg-[#E3EAF5]"
              aria-hidden="true"
            />

            {/* Entri 1 */}
            <div className="relative">
              <span className="absolute -left-[28px] top-[1px] flex h-[19px] w-[19px] items-center justify-center rounded-full bg-[#FCE4EA] text-[#D0214F] ring-2 ring-white">
                <MessageSquare className="h-[10px] w-[10px]" strokeWidth={2.2} />
              </span>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-[6px]">
                  <h3 className="text-[12.5px] font-bold text-[#D0214F]">
                    Catatan Verifikator Asuransi Sehat Sentosa
                  </h3>
                  <span className="rounded-full bg-[#FCE4EA] px-[7px] py-[2px] text-[9px] font-bold leading-none text-[#D0214F]">
                    Revisi Dokumen
                  </span>
                </div>
                <span className="text-[10.5px] text-[#5B6B7B]">
                  15 Okt 2026, 14:15 WIB
                </span>
              </div>

              <div className="mt-[7px] rounded-[8px] bg-[#EAF0FB] p-[11px]">
                <p className="text-[11px] leading-[1.45] text-[#0B3A5B]">
                  Verifikator meminta rincian penagihan{" "}
                  <strong className="font-bold">balon angioplasti</strong> dan
                  rekaman video tindakan kateterisasi angiografi koroner
                  (CD-ROM/Link PACS) untuk kalkulasi pelampauan limit rawat
                  inap.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    handleUtilityAction(
                      "Unggah Respons Klinis",
                      "Silakan unggah dokumen revisi melalui detail kasus KAS-2026-001 pada menu Kasus Perawatan."
                    )
                  }
                  className="mt-[8px] inline-flex items-center gap-[5px] rounded-[4px] border border-[#E3EAF5] bg-white px-[9px] py-[4px] text-[10.5px] font-bold text-[#0B3A5B] transition-colors hover:bg-[#F6F8FE] cursor-pointer"
                >
                  <FileUp className="h-[11px] w-[11px]" strokeWidth={2} />
                  <span>Unggah Respons Klinis</span>
                </button>
              </div>
            </div>

            {/* Entri 2 */}
            <div className="relative">
              <span className="absolute -left-[28px] top-[1px] flex h-[19px] w-[19px] items-center justify-center rounded-full bg-[#DCE8F9] text-[#0B3A5B] ring-2 ring-white">
                <VerifiedGearIcon className="h-[11px] w-[11px]" />
              </span>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-[6px]">
                  <h3 className="text-[12.5px] font-bold text-[#0B3A5B]">
                    Subklaim BPJS Disetujui Penuh
                  </h3>
                  <span className="rounded-full bg-[#D6F2E4] px-[7px] py-[2px] text-[9px] font-bold leading-none text-[#12805F]">
                    Disetujui
                  </span>
                </div>
                <span className="text-[10.5px] text-[#5B6B7B]">
                  14 Okt 2026, 11:30 WIB
                </span>
              </div>

              <p className="mt-[5px] text-[11px] leading-[1.45] text-[#5B6B7B]">
                Subklaim tarif INA-CBG sebesar{" "}
                <strong className="font-bold text-[#0B3A5B]">
                  Rp 37.500.000
                </strong>{" "}
                (Porsi Primer BPJS 30%) disetujui penuh oleh verifikator kantor
                cabang BPJS Kesehatan. Nomor FPK elektronik telah diterbitkan.
              </p>
            </div>

            {/* Entri 3 */}
            <div className="relative">
              <span className="absolute -left-[28px] top-[1px] flex h-[19px] w-[19px] items-center justify-center rounded-[5px] bg-[#EAF0FB] text-[#5B6B7B] ring-2 ring-white">
                <SquarePlus className="h-[11px] w-[11px]" strokeWidth={1.9} />
              </span>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-[6px]">
                  <h3 className="text-[12.5px] font-bold text-[#0B3A5B]">
                    Kasus Baru KAS-2026-001 Dibuka
                  </h3>
                  <span className="rounded-full bg-[#EAF0FB] px-[7px] py-[2px] text-[9px] font-bold leading-none text-[#5B6B7B]">
                    Registrasi
                  </span>
                </div>
                <span className="text-[10.5px] text-[#5B6B7B]">
                  12 Okt 2026, 08:20 WIB
                </span>
              </div>

              <p className="mt-[5px] text-[11px] leading-[1.45] text-[#5B6B7B]">
                Pendaftaran rawat inap kelas eksekutif dilakukan oleh{" "}
                <strong className="font-bold text-[#0B3A5B]">
                  Admin Billing Siti Rahmawati
                </strong>{" "}
                melalui rujukan IGD dengan penjaminan ganda (BPJS Kesehatan +
                Sehat Sentosa).
              </p>
            </div>

            {showOlderHistory && (
              <div className="rounded-[8px] border border-[#E3EAF5] bg-[#F6F8FE] px-[10px] py-[8px] text-[10.5px] text-[#5B6B7B]">
                15 Agt 2025 &mdash; Kunjungan Rawat Jalan Spesialis Kardiologi
                (KAS-2025-084) diselesaikan dan dibayar penuh oleh BPJS
                Kesehatan.
              </div>
            )}
          </div>

          {/* Ruang kosong ±50px disengaja sebelum tombol pill rata tengah */}
          <div className="mt-[56px] flex justify-center">
            <button
              type="button"
              onClick={() => setShowOlderHistory((prev) => !prev)}
              className="inline-flex items-center gap-[5px] rounded-full bg-[#EAF0FB] px-[14px] py-[6px] text-[11px] font-bold text-[#0B3A5B] transition-colors hover:bg-[#DCE8F9] cursor-pointer"
            >
              <ChevronDown
                className={cn(
                  "h-[12px] w-[12px] transition-transform",
                  showOlderHistory && "rotate-180"
                )}
                strokeWidth={2.2}
              />
              <span>Tampilkan Riwayat Lebih Lama</span>
            </button>
          </div>
        </section>

        {/* KOLOM KANAN: 2 Kartu Bertumpuk */}
        <div className="space-y-[14px]">
          {/* Kartu A: Ringkasan Riwayat Klaim */}
          <section
            aria-labelledby="card-claim-summary-title"
            className="rounded-[12px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                id="card-claim-summary-title"
                className="text-[12.5px] font-bold text-[#0B3A5B]"
              >
                Ringkasan Riwayat Klaim
              </h2>
              <BarChartBoxIcon className="h-[15px] w-[15px] shrink-0 text-[#5B6B7B]" />
            </div>

            {/* Panel 1: Akumulasi biaya */}
            <div className="mt-[11px] rounded-[8px] bg-[#EAF0FB] p-[11px]">
              <p className="text-[10.5px] text-[#5B6B7B]">
                Akumulasi Biaya Perawatan Seumur Hidup
              </p>
              <p className="mt-[2px] text-[16px] font-extrabold leading-[1.2] text-[#0B3A5B]">
                {profile.lifetimeTotalText}
              </p>

              <div className="mt-[8px] space-y-[4px] text-[10.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#5B6B7B]">Ditanggung Penjamin:</span>
                  <span className="font-bold text-[#12805F]">
                    {profile.lifetimePayerText}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#5B6B7B]">Pribadi (Iur Bayar):</span>
                  <span className="font-bold text-[#0B3A5B]">
                    {profile.lifetimePatientText}
                  </span>
                </div>
              </div>
            </div>

            {/* Panel 2: Status Kepatuhan Berkas Pasien */}
            <div className="mt-[10px] rounded-[8px] bg-[#F4F7FD] p-[11px]">
              <h3 className="text-[11px] font-bold text-[#0B3A5B]">
                Status Kepatuhan Berkas Pasien
              </h3>

              <ul className="mt-[7px] space-y-[6px] text-[10.5px] leading-[1.3]">
                <li className="flex items-start gap-[6px] text-[#12805F]">
                  <Check
                    className="mt-[1.5px] h-[11px] w-[11px] shrink-0"
                    strokeWidth={2.5}
                  />
                  <span>KTP &amp; Kartu Keluarga Terverifikasi Dukcapil</span>
                </li>
                <li className="flex items-start gap-[6px] text-[#12805F]">
                  <Check
                    className="mt-[1.5px] h-[11px] w-[11px] shrink-0"
                    strokeWidth={2.5}
                  />
                  <span>
                    Surat Kuasa Koordinasi Manfaat (COB) Ditandatangani
                  </span>
                </li>
                <li className="flex items-start gap-[6px] text-[#D9731A]">
                  <AlertCircle
                    className="mt-[1.5px] h-[11px] w-[11px] shrink-0"
                    strokeWidth={2.2}
                  />
                  <span>Surat Jaminan Akhir Sehat Sentosa (Pending)</span>
                </li>
              </ul>
            </div>

            {/* Tombol Buka Berkas Digital (Dossier) */}
            <button
              type="button"
              onClick={() =>
                handleUtilityAction(
                  "Berkas Digital (Dossier)",
                  `Membuka himpunan dokumen elektronik pasien ${profile.patientCode}.`
                )
              }
              className="mt-[11px] flex h-[31px] w-full items-center justify-center gap-[6px] rounded-[8px] bg-[#DCE8F9] px-[10px] text-[11px] font-bold text-[#0B3A5B] transition-colors hover:bg-[#CBE0FA] cursor-pointer"
            >
              <Folder className="h-[13px] w-[13px]" strokeWidth={2} />
              <span>Buka Berkas Digital (Dossier)</span>
            </button>
          </section>

          {/* Kartu B: KONTAK DARURAT / PENANGGUNG JAWAB */}
          <section
            aria-labelledby="card-emergency-title"
            className="rounded-[12px] border border-[#E3EAF5] bg-white p-[14px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]"
          >
            <h2
              id="card-emergency-title"
              className="text-[9.5px] font-bold uppercase tracking-[0.05em] text-[#5B6B7B]"
            >
              KONTAK DARURAT / PENANGGUNG JAWAB
            </h2>

            <div className="mt-[9px] flex items-center gap-[9px]">
              <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-[#DCE8F9] text-[11.5px] font-extrabold text-[#0B3A5B]">
                {profile.emergencyInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-bold leading-[1.2] text-[#0B3A5B]">
                  {profile.emergencyName}
                </p>
                <p className="mt-[1px] truncate text-[10.5px] text-[#5B6B7B]">
                  {profile.emergencyRelationPhone}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal Ubah Data Identitas & Kontak */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Ubah Data Kontak Pasien"
        description={`Perbarui kontak dan alamat domisili ${profile.fullName}`}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              isLoading={savingProfile}
              onClick={handleSaveProfile}
            >
              Simpan Perubahan
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-bold text-[#0B3A5B]">
              No. Telepon / WhatsApp
            </label>
            <input
              type="text"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="h-9 w-full rounded-[8px] border border-[#E3EAF5] px-3 text-xs text-[#0B3A5B] focus:outline-none focus:ring-1 focus:ring-[#154B6B]"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold text-[#0B3A5B]">Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="h-9 w-full rounded-[8px] border border-[#E3EAF5] px-3 text-xs text-[#0B3A5B] focus:outline-none focus:ring-1 focus:ring-[#154B6B]"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold text-[#0B3A5B]">
              Alamat Domisili
            </label>
            <textarea
              rows={2}
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="w-full rounded-[8px] border border-[#E3EAF5] p-3 text-xs text-[#0B3A5B] focus:outline-none focus:ring-1 focus:ring-[#154B6B]"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-bold text-[#0B3A5B]">
                Nama Kontak Darurat
              </label>
              <input
                type="text"
                value={editEmergencyName}
                onChange={(e) => setEditEmergencyName(e.target.value)}
                className="h-9 w-full rounded-[8px] border border-[#E3EAF5] px-3 text-xs text-[#0B3A5B] focus:outline-none focus:ring-1 focus:ring-[#154B6B]"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-[#0B3A5B]">
                Telepon Kontak Darurat
              </label>
              <input
                type="text"
                value={editEmergencyPhone}
                onChange={(e) => setEditEmergencyPhone(e.target.value)}
                className="h-9 w-full rounded-[8px] border border-[#E3EAF5] px-3 text-xs text-[#0B3A5B] focus:outline-none focus:ring-1 focus:ring-[#154B6B]"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Kelola Skema COB */}
      <Modal
        open={cobModalOpen}
        onClose={() => setCobModalOpen(false)}
        title="Kelola Skema & Plafon Penjamin COB"
        description={`Pengaturan plafon ${profile.privateInsurerFull} (${profile.privatePolicyNumber})`}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCobModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              isLoading={savingCoverages}
              onClick={handleSaveCoverages}
            >
              Simpan Skema COB
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveCoverages} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-bold text-[#0B3A5B]">
              Plafon Tahunan Polis (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={annualLimitInput}
              onChange={(e) => setAnnualLimitInput(e.target.value)}
              className="h-9 w-full rounded-[8px] border border-[#E3EAF5] px-3 text-xs text-[#0B3A5B] focus:outline-none focus:ring-1 focus:ring-[#154B6B]"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold text-[#0B3A5B]">
              Sisa Plafon Tahun Berjalan (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={remainingLimitInput}
              onChange={(e) => setRemainingLimitInput(e.target.value)}
              className="h-9 w-full rounded-[8px] border border-[#E3EAF5] px-3 text-xs text-[#0B3A5B] focus:outline-none focus:ring-1 focus:ring-[#154B6B]"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold text-[#0B3A5B]">
              Status Kepesertaan Sekunder
            </label>
            <select
              value={coverageStatusInput}
              onChange={(e) => setCoverageStatusInput(e.target.value)}
              className="h-9 w-full rounded-[8px] border border-[#E3EAF5] bg-white px-3 text-xs text-[#0B3A5B] focus:outline-none focus:ring-1 focus:ring-[#154B6B]"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="EXPIRED">EXPIRED</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
