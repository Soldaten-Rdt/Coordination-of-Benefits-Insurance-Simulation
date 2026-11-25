"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  ChevronDown,
  CreditCard,
  Fingerprint,
  IdCard,
  Image as ImageIcon,
  Info,
  Mail,
  MapPin,
  PlusCircle,
  Save,
  ShieldCheck,
  Smartphone,
  SquarePlus,
  X,
} from "lucide-react";
import { createPatient, verifyBpjsNumber } from "@/lib/api";
import { getAccessToken } from "@/lib/auth/token";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui";

function parseSlashDateToIso(raw: string, fallbackIso: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    const n2 = Number(p2);
    // Handle MM/DD/YYYY (e.g. 12/31/2027) vs DD/MM/YYYY (e.g. 10/08/1993)
    if (n2 > 12) {
      return `${p3}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
    }
    return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
  }
  return fallbackIso;
}

function ShieldLockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="11" r="1.5" />
      <path d="M12 12.5V15" />
    </svg>
  );
}

function ShieldSyncIcon({ className }: { className?: string }) {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function NewPatientPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Kartu A — Informasi Identitas Pasien (exact reference values)
  const [fullName, setFullName] = React.useState("Dewi Sartika Dewi");
  const [nik, setNik] = React.useState("3271044810930002");
  const [birthDate, setBirthDate] = React.useState("10/08/1993");
  const [gender, setGender] = React.useState<"L" | "P">("P");
  const [phone, setPhone] = React.useState("081298457721");
  const [email, setEmail] = React.useState("sartika.dewi@gmail.com");
  const [address, setAddress] = React.useState(
    "Jl. Margonda Raya No. 412, RT 003 / RW 008, Kemiri Muka, Kecamatan Beji, Kota Depok, Jawa Barat 16423"
  );

  // Kartu B — Kepesertaan BPJS Kesehatan
  const [bpjsNumber, setBpjsNumber] = React.useState("0001847291038");
  const [bpjsStatusText, setBpjsStatusText] = React.useState(
    "Aktif (PBI / Non-PBI Mandiri)"
  );
  const [bpjsValidSubtext, setBpjsValidSubtext] = React.useState(
    "Iuran terbayar s/d 31 Des 2026"
  );
  const [careClass, setCareClass] = React.useState("Kelas 1 (Satu)");
  const [primaryFaskes, setPrimaryFaskes] = React.useState(
    "Puskesmas Beji Kota Depok (Kode Faskes: 0112U004)"
  );
  const [verifyingBpjs, setVerifyingBpjs] = React.useState(false);

  // Kartu C — Kepesertaan Asuransi Swasta Tambahan
  const [insurerName, setInsurerName] = React.useState(
    "Asuransi Sehat Sentosa (TPA Integrated)"
  );
  const [policyNumber, setPolicyNumber] = React.useState("POL-99281-SENTOSA");
  const [policyExpiry, setPolicyExpiry] = React.useState("12/31/2027");
  const [planDescription, setPlanDescription] = React.useState(
    "Gold Executive Inpatient Plafon Rp 200 Juta / Tahun (Full Coverage)"
  );
  const [showSecondInsurer, setShowSecondInsurer] = React.useState(false);
  const [secondInsurerName, setSecondInsurerName] =
    React.useState("Mandiri Inhealth");
  const [secondPolicyNumber, setSecondPolicyNumber] =
    React.useState("POL-44102-INHEALTH");

  const [submitting, setSubmitting] = React.useState(false);

  const handleVerifyBpjs = async () => {
    const clean = bpjsNumber.trim();
    if (!/^\d{13}$/.test(clean)) {
      toast({
        variant: "error",
        title: "Format Nomor BPJS Tidak Valid",
        description: "Nomor Kartu BPJS harus terdiri dari 13 digit angka.",
      });
      return;
    }

    setVerifyingBpjs(true);
    try {
      if (getAccessToken()) {
        const res = await verifyBpjsNumber(clean);
        if (res.data) {
          setBpjsStatusText(
            res.data.is_active
              ? `Aktif (${res.data.participant_type})`
              : "Tidak Aktif"
          );
          if (res.data.care_class) {
            setCareClass(res.data.care_class);
          }
        }
      }
      setBpjsValidSubtext("Iuran terbayar s/d 31 Des 2026");
      toast({
        variant: "success",
        title: "Verifikasi VClaim Berhasil",
        description: `Nomor peserta ${clean} berstatus Aktif (${careClass}).`,
      });
    } catch {
      toast({
        variant: "info",
        title: "Simulasi VClaim Terverifikasi",
        description: `Peserta ${clean} tervalidasi aktif pada mode sandbox lokal.`,
      });
    } finally {
      setVerifyingBpjs(false);
    }
  };

  const handleSaveDraft = () => {
    try {
      window.localStorage.setItem(
        "kapj_patient_draft",
        JSON.stringify({
          fullName,
          nik,
          birthDate,
          gender,
          phone,
          email,
          address,
          bpjsNumber,
          careClass,
          primaryFaskes,
          insurerName,
          policyNumber,
          policyExpiry,
          planDescription,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
    toast({
      variant: "success",
      title: "Draft Identitas Tersimpan",
      description:
        "Draft data pasien berhasil disimpan secara lokal di simulator KAPJ Flow.",
    });
  };

  const handleSubmitPatient = async (redirectToCreateCase: boolean) => {
    if (!fullName.trim() || !/^\d{16}$/.test(nik.trim())) {
      toast({
        variant: "error",
        title: "Validasi Identitas Belum Lengkap",
        description: "Pastikan Nama Lengkap dan 16 digit NIK telah diisi valid.",
      });
      return;
    }

    setSubmitting(true);
    const normalizedInsurer = insurerName.replace(" (TPA Integrated)", "").trim();

    const privateCoverages = [
      {
        payer_tier: "SECONDARY" as const,
        insurer_name: normalizedInsurer,
        policy_number: policyNumber.trim(),
        plan_name: planDescription.trim(),
        annual_limit: 200_000_000,
        room_daily_limit: 1_500_000,
        valid_until: parseSlashDateToIso(policyExpiry, "2027-12-31"),
      },
      ...(showSecondInsurer && secondPolicyNumber.trim()
        ? [
            {
              payer_tier: "TERTIARY" as const,
              insurer_name: secondInsurerName.trim(),
              policy_number: secondPolicyNumber.trim(),
              plan_name: "Corporate Cob Supplement Plan",
              annual_limit: 100_000_000,
              room_daily_limit: 1_000_000,
              valid_until: "2027-12-31",
            },
          ]
        : []),
    ];

    try {
      if (getAccessToken()) {
        const res = await createPatient({
          full_name: fullName.trim(),
          nik: nik.trim(),
          birth_date: parseSlashDateToIso(birthDate, "1993-08-10"),
          gender,
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim(),
          bpjs_number: bpjsNumber.trim(),
          care_class: careClass,
          primary_faskes: primaryFaskes.trim(),
          private_coverages: privateCoverages,
        });

        toast({
          variant: "success",
          title: "Pasien Baru Berhasil Didaftarkan",
          description: `${res.data.full_name} (${res.data.patient_code}) tersimpan ke direktori RS.`,
        });
      } else {
        toast({
          variant: "success",
          title: "Data Pasien Disimpan (Mode Simulasi)",
          description: `${fullName} (PAT-2026-008) dicatat pada sesi simulasi.`,
        });
      }

      router.push(redirectToCreateCase ? "/cases" : "/patients");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal menyimpan data pasien ke server.";
      toast({
        variant: "error",
        title: "Gagal Menyimpan Pasien",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* 5) HEADER HALAMAN */}
      <section
        aria-labelledby="add-patient-heading"
        className="flex flex-col justify-between gap-4 rounded-[10px] border border-[#E3EAF5] bg-white px-[18px] py-[16px] shadow-[0_4px_18px_rgba(11,58,91,0.06)] sm:flex-row sm:items-center"
      >
        <div>
          <nav
            aria-label="Breadcrumb halaman"
            className="flex items-center gap-[5px] text-[10px]"
          >
            <Link
              href="/patients"
              className="font-medium text-[#5B6B7B] transition-colors hover:text-[#0B3A5B]"
            >
              Data Pasien
            </Link>
            <span className="text-[#5B6B7B]">&rsaquo;</span>
            <span className="font-bold text-[#0B3A5B]">Tambah Pasien Baru</span>
          </nav>

          <h1
            id="add-patient-heading"
            className="mt-[3px] text-[21px] font-extrabold leading-[1.2] tracking-[-0.015em] text-[#0B3A5B]"
          >
            Tambah Data Pasien
          </h1>

          <p className="mt-[4px] max-w-[525px] text-[11px] font-normal leading-[1.45] text-[#5B6B7B]">
            Daftarkan identitas pasien baru serta data kepesertaan BPJS Kesehatan
            dan Asuransi Swasta untuk simulasi CoB (Coordination of Benefit).
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-[10px]">
          <button
            type="button"
            onClick={() => router.push("/patients")}
            className="inline-flex h-[30px] items-center gap-[5px] rounded-[6px] border border-[#E3EAF5] bg-[#EAF0FB]/75 px-[12px] text-[10.5px] font-semibold text-[#0B3A5B] transition-colors hover:bg-[#DCE8F9] cursor-pointer"
          >
            <X className="h-[12px] w-[12px]" strokeWidth={2} />
            <span>Batal</span>
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmitPatient(false)}
            className="inline-flex h-[30px] items-center gap-[6px] rounded-[6px] bg-[#0B3A5B] px-[13px] text-[10.5px] font-bold text-white transition-colors hover:bg-[#154B6B] disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-[12px] w-[12px]" strokeWidth={2} />
            <span>Simpan Pasien</span>
          </button>
        </div>
      </section>

      {/* GRID DUA KOLOM (tinggi tiap kolom berbeda, items-start) */}
      <div className="mt-[16px] grid grid-cols-1 items-start gap-[18px] lg:grid-cols-2">
        {/* ==================== 6) KOLOM KIRI ==================== */}
        <div className="space-y-[15px]">
          {/* KARTU A: Informasi Identitas Pasien */}
          <section
            aria-labelledby="card-a-title"
            className="rounded-[12px] border border-[#E3EAF5] bg-white p-[18px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]"
          >
            {/* a. Header Kartu A */}
            <div className="flex items-start justify-between gap-[10px]">
              <div className="flex items-start gap-[10px]">
                <span className="mt-[1px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[8px] bg-[#EAF0FB] text-[11px] font-extrabold text-[#0B3A5B]">
                  A
                </span>
                <div>
                  <h2
                    id="card-a-title"
                    className="text-[13.5px] font-extrabold leading-[1.25] text-[#0B3A5B]"
                  >
                    Informasi Identitas Pasien
                  </h2>
                  <p className="mt-[2px] text-[10px] leading-[1.35] text-[#5B6B7B]">
                    Kelengkapan data demografi &amp;
                    <br />
                    kontak valid
                  </p>
                </div>
              </div>

              {/* Kapsul gabungan PAT-2026-008 (wrap 2 baris) + Auto Terbit */}
              <div className="inline-flex shrink-0 items-center gap-[8px] rounded-full border border-[#E3EAF5] bg-[#EAF0FB] py-[4px] pl-[12px] pr-[4px]">
                <span className="text-[9.5px] font-extrabold leading-[1.18] text-[#0B3A5B]">
                  PAT-2026-
                  <br />
                  008
                </span>
                <span className="inline-flex items-center justify-center rounded-full bg-[#0B3A5B] px-[9px] py-[4px] text-center text-[9px] font-bold leading-[1.15] text-white">
                  Auto
                  <br />
                  Terbit
                </span>
              </div>
            </div>

            {/* Form Fields Kartu A */}
            <div className="mt-[16px] space-y-[14px]">
              {/* b. Nama Lengkap Pasien * */}
              <div>
                <label
                  htmlFor="patient-fullname"
                  className="block text-[10.5px] font-bold text-[#0B3A5B]"
                >
                  Nama Lengkap Pasien{" "}
                  <span className="text-[#D0214F]">*</span>
                </label>
                <div className="mt-[5px] flex items-center gap-[9px] rounded-[6px] border-b border-[#EEF3FA] bg-white px-[4px] py-[5px]">
                  <IdCard
                    className="h-[14px] w-[14px] shrink-0 text-[#5B6B7B]"
                    strokeWidth={1.75}
                  />
                  <input
                    id="patient-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-transparent text-[11px] font-medium text-[#0B3A5B] focus:outline-none"
                  />
                </div>
              </div>

              {/* c. Nomor Induk Kependudukan (NIK) * */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="patient-nik"
                    className="text-[10.5px] font-bold text-[#0B3A5B]"
                  >
                    Nomor Induk Kependudukan (NIK){" "}
                    <span className="text-[#D0214F]">*</span>
                  </label>
                  <span className="rounded-[4px] bg-[#DCE8F9] px-[6px] py-[2px] text-[9px] font-semibold leading-none text-[#5B6B7B]">
                    16 Digit KTP
                  </span>
                </div>

                <div className="mt-[5px] flex items-center gap-[9px] rounded-[6px] border-b border-[#EEF3FA] bg-white px-[4px] py-[5px]">
                  <Fingerprint
                    className="h-[14px] w-[14px] shrink-0 text-[#5B6B7B]"
                    strokeWidth={1.75}
                  />
                  <input
                    id="patient-nik"
                    type="text"
                    maxLength={16}
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    className="w-full bg-transparent text-[11px] font-medium text-[#0B3A5B] focus:outline-none"
                  />
                  <BadgeCheck
                    className="h-[14px] w-[14px] shrink-0 text-[#0B3A5B]"
                    strokeWidth={1.9}
                  />
                </div>

                <p className="mt-[5px] flex items-center gap-[5px] text-[9.5px] font-medium text-[#5B6B7B]">
                  <span
                    className="h-[4.5px] w-[4.5px] shrink-0 rounded-full bg-[#0B3A5B]"
                    aria-hidden="true"
                  />
                  <span>
                    Terhubung ke database simulasi Dukcapil Kemendagri
                  </span>
                </p>
              </div>

              {/* d. Tanggal Lahir * & Jenis Kelamin * */}
              <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="patient-birthdate"
                    className="block text-[10.5px] font-bold text-[#0B3A5B]"
                  >
                    Tanggal Lahir <span className="text-[#D0214F]">*</span>
                  </label>
                  <div className="mt-[5px] flex h-[30px] items-center gap-[8px] rounded-[6px] border-b border-[#EEF3FA] bg-white px-[4px]">
                    <Calendar
                      className="h-[13.5px] w-[13.5px] shrink-0 text-[#5B6B7B]"
                      strokeWidth={1.75}
                    />
                    <input
                      id="patient-birthdate"
                      type="text"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full bg-transparent text-[11px] font-medium text-[#0B3A5B] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-[10.5px] font-bold text-[#0B3A5B]">
                    Jenis Kelamin <span className="text-[#D0214F]">*</span>
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Jenis Kelamin"
                    className="mt-[5px] grid h-[30px] grid-cols-2 rounded-[8px] bg-[#EAF0FB] p-[2.5px]"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={gender === "L"}
                      onClick={() => setGender("L")}
                      className={cn(
                        "flex items-center justify-center gap-[4px] rounded-[6px] text-[10px] transition-all cursor-pointer",
                        gender === "L"
                          ? "bg-white font-bold text-[#0B3A5B] shadow-[0_1px_3px_rgba(11,58,91,0.08)]"
                          : "bg-transparent font-medium text-[#0B3A5B]/80 hover:text-[#0B3A5B]"
                      )}
                    >
                      <span aria-hidden="true">&#9794;</span>
                      <span>Laki-laki</span>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={gender === "P"}
                      onClick={() => setGender("P")}
                      className={cn(
                        "flex items-center justify-center gap-[4px] rounded-[6px] text-[10px] transition-all cursor-pointer",
                        gender === "P"
                          ? "bg-white font-bold text-[#0B3A5B] shadow-[0_1px_3px_rgba(11,58,91,0.08)]"
                          : "bg-transparent font-medium text-[#0B3A5B]/80 hover:text-[#0B3A5B]"
                      )}
                    >
                      <span aria-hidden="true">&#9792;</span>
                      <span>Perempuan</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* e. Nomor WhatsApp / Telp * & Alamat Email (Opsional) */}
              <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="patient-phone"
                    className="block text-[10.5px] font-bold text-[#0B3A5B]"
                  >
                    Nomor WhatsApp / Telp{" "}
                    <span className="text-[#D0214F]">*</span>
                  </label>
                  <div className="mt-[5px] flex items-center gap-[8px] rounded-[6px] border-b border-[#EEF3FA] bg-white px-[4px] py-[5px]">
                    <Smartphone
                      className="h-[13.5px] w-[13.5px] shrink-0 text-[#5B6B7B]"
                      strokeWidth={1.75}
                    />
                    <input
                      id="patient-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-transparent text-[11px] font-medium text-[#0B3A5B] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="patient-email"
                    className="block text-[10.5px] font-bold text-[#0B3A5B]"
                  >
                    Alamat Email{" "}
                    <span className="font-normal text-[#5B6B7B]">
                      (Opsional)
                    </span>
                  </label>
                  <div className="mt-[5px] flex items-center gap-[8px] rounded-[6px] border-b border-[#EEF3FA] bg-white px-[4px] py-[5px]">
                    <Mail
                      className="h-[13.5px] w-[13.5px] shrink-0 text-[#5B6B7B]"
                      strokeWidth={1.75}
                    />
                    <input
                      id="patient-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent text-[11px] font-medium text-[#0B3A5B] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* f. Alamat Domisili Lengkap * */}
              <div>
                <label
                  htmlFor="patient-address"
                  className="block text-[10.5px] font-bold text-[#0B3A5B]"
                >
                  Alamat Domisili Lengkap{" "}
                  <span className="text-[#D0214F]">*</span>
                </label>
                <div className="mt-[5px] flex items-start gap-[8px] rounded-[6px] border-b border-[#EEF3FA] bg-white px-[4px] py-[4px]">
                  <MapPin
                    className="mt-[2px] h-[13.5px] w-[13.5px] shrink-0 text-[#5B6B7B]"
                    strokeWidth={1.75}
                  />
                  <textarea
                    id="patient-address"
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full resize-none bg-transparent text-[11px] font-medium leading-[1.5] text-[#0B3A5B] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* g. Kotak info Enkripsi Berkas Rekam Medis */}
            <div className="mt-[16px] flex items-center gap-[9px] rounded-[6px] bg-[#EAF0FB] px-[12px] py-[9px]">
              <ShieldLockIcon className="h-[15px] w-[15px] shrink-0 text-[#0B3A5B]" />
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold leading-[1.3] text-[#0B3A5B]">
                  Enkripsi Berkas Rekam Medis
                </p>
                <p className="mt-[1px] text-[9.5px] leading-[1.35] text-[#5B6B7B]">
                  Data NIK dan Rekam Medis dianonimkan sesuai UU PDP No. 27/20
                </p>
              </div>
            </div>
          </section>

          {/* KARTU DOKUMEN: Dokumen Pendukung Fisik */}
          <section
            aria-labelledby="card-docs-title"
            className="rounded-[12px] border border-[#E3EAF5] bg-white p-[18px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                id="card-docs-title"
                className="text-[13px] font-extrabold text-[#0B3A5B]"
              >
                Dokumen Pendukung Fisik
              </h2>
              <span className="text-[9.5px] font-medium text-[#5B6B7B]">
                2 dari 2 Terunggah
              </span>
            </div>

            <div className="mt-[12px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
              {/* Tile 1 */}
              <div className="flex items-center gap-[9px] rounded-[8px] bg-[#EAF0FB] px-[10px] py-[9px]">
                <div className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[4px] bg-white text-[#0B3A5B]">
                  <ImageIcon className="h-[13px] w-[13px]" strokeWidth={1.85} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10.5px] font-bold leading-[1.25] text-[#0B3A5B]">
                    Scan_eKTP.pdf
                  </p>
                  <p className="mt-[1px] truncate text-[9px] text-[#5B6B7B]">
                    1.2 MB &middot; Terunggah
                  </p>
                </div>
              </div>

              {/* Tile 2 */}
              <div className="flex items-center gap-[9px] rounded-[8px] bg-[#EAF0FB] px-[10px] py-[9px]">
                <div className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[4px] bg-white text-[#0B3A5B]">
                  <IdCard className="h-[13px] w-[13px]" strokeWidth={1.85} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10.5px] font-bold leading-[1.25] text-[#0B3A5B]">
                    Kartu_BPJS_Digital.png
                  </p>
                  <p className="mt-[1px] truncate text-[9px] text-[#5B6B7B]">
                    840 KB &middot; Terunggah
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ==================== 7) KOLOM KANAN ==================== */}
        <div className="space-y-[18px]">
          {/* KARTU B: Kepesertaan BPJS Kesehatan */}
          <section
            aria-labelledby="card-b-title"
            className="rounded-[12px] border border-[#E3EAF5] bg-white p-[18px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]"
          >
            {/* a. Header Kartu B */}
            <div className="flex items-start justify-between gap-[10px]">
              <div className="flex items-start gap-[10px]">
                <span className="mt-[1px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[8px] bg-[#EAF0FB] text-[11px] font-extrabold text-[#0B3A5B]">
                  B
                </span>
                <div>
                  <h2
                    id="card-b-title"
                    className="text-[13.5px] font-extrabold leading-[1.25] text-[#0B3A5B]"
                  >
                    Kepesertaan BPJS Kesehatan
                  </h2>
                  <p className="mt-[2px] text-[10px] text-[#5B6B7B]">
                    Pembayar Primer (Primary Payer)
                  </p>
                </div>
              </div>

              <span className="inline-flex shrink-0 items-center gap-[5px] rounded-full border border-[#E3EAF5] bg-[#EAF0FB] px-[10px] py-[4px] text-[9.5px] font-bold leading-none text-[#0B3A5B] whitespace-nowrap">
                <span
                  className="h-[5px] w-[5px] rounded-full bg-[#0B3A5B]"
                  aria-hidden="true"
                />
                <span>Primer (CoB Tier 1)</span>
              </span>
            </div>

            {/* b. Nomor Kartu BPJS / No. Peserta * */}
            <div className="mt-[16px]">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="bpjs-number"
                  className="text-[10.5px] font-bold text-[#0B3A5B]"
                >
                  Nomor Kartu BPJS / No. Peserta{" "}
                  <span className="text-[#D0214F]">*</span>
                </label>
                <span className="text-[9.5px] font-medium text-[#5B6B7B]">
                  13 Digit BPJS
                </span>
              </div>

              <div className="mt-[6px] flex items-center gap-[8px]">
                <div className="flex h-[32px] min-w-0 flex-1 items-center gap-[8px] rounded-[6px] border-b border-[#EEF3FA] bg-white px-[4px]">
                  <CreditCard
                    className="h-[14px] w-[14px] shrink-0 text-[#5B6B7B]"
                    strokeWidth={1.75}
                  />
                  <input
                    id="bpjs-number"
                    type="text"
                    maxLength={13}
                    value={bpjsNumber}
                    onChange={(e) => setBpjsNumber(e.target.value)}
                    className="w-full bg-transparent text-[11px] font-medium text-[#0B3A5B] focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={verifyingBpjs}
                  onClick={handleVerifyBpjs}
                  className="inline-flex min-h-[32px] w-[166px] shrink-0 items-center justify-center gap-[5px] rounded-[6px] bg-[#DCE8F9] px-[9px] py-[4px] text-[9.5px] font-bold leading-[1.2] text-[#0B3A5B] transition-colors hover:bg-[#CBE0FA] disabled:opacity-60 cursor-pointer"
                >
                  <ShieldSyncIcon className="h-[12px] w-[12px] shrink-0 text-[#0B3A5B]" />
                  <span>
                    {verifyingBpjs
                      ? "Memverifikasi..."
                      : "Verifikasi VClaim API Dummy"}
                  </span>
                </button>
              </div>
            </div>

            {/* c. Panel tint Status Kepesertaan & Hak Kelas Rawat */}
            <div className="mt-[12px] grid grid-cols-1 gap-[10px] rounded-[8px] bg-[#EAF0FB] p-[11px] sm:grid-cols-2">
              <div>
                <p className="text-[9.5px] font-medium text-[#5B6B7B]">
                  Status Kepesertaan
                </p>
                <p className="mt-[3px] flex items-center gap-[5px] text-[10.5px] font-bold text-[#0B3A5B]">
                  <span
                    className="h-[5.5px] w-[5.5px] shrink-0 rounded-full bg-[#0B3A5B]"
                    aria-hidden="true"
                  />
                  <span>{bpjsStatusText}</span>
                </p>
                <p className="mt-[2px] text-[9.5px] text-[#5B6B7B]">
                  {bpjsValidSubtext}
                </p>
              </div>

              <div>
                <label
                  htmlFor="bpjs-care-class"
                  className="block text-[9.5px] font-medium text-[#5B6B7B]"
                >
                  Hak Kelas Rawat
                </label>
                <div className="relative mt-[4px]">
                  <select
                    id="bpjs-care-class"
                    value={careClass}
                    onChange={(e) => setCareClass(e.target.value)}
                    className="h-[30px] w-full appearance-none rounded-[6px] border border-[#E3EAF5] bg-white pl-[10px] pr-[26px] text-[10.5px] font-semibold text-[#0B3A5B] focus:outline-none cursor-pointer"
                  >
                    <option value="Kelas 1 (Satu)">Kelas 1 (Satu)</option>
                    <option value="Kelas 2 (Dua)">Kelas 2 (Dua)</option>
                    <option value="Kelas 3 (Tiga)">Kelas 3 (Tiga)</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-[8px] top-1/2 h-[12px] w-[12px] -translate-y-1/2 text-[#5B6B7B]"
                    strokeWidth={2}
                  />
                </div>
              </div>
            </div>

            {/* d. Faskes Tingkat 1 / Rujukan Asal */}
            <div className="mt-[13px]">
              <label
                htmlFor="bpjs-faskes"
                className="block text-[10.5px] font-bold text-[#0B3A5B]"
              >
                Faskes Tingkat 1 / Rujukan Asal
              </label>
              <div className="mt-[5px] flex items-center gap-[8px] rounded-[6px] border-b border-[#EEF3FA] bg-white px-[4px] py-[5px]">
                <SquarePlus
                  className="h-[14px] w-[14px] shrink-0 text-[#5B6B7B]"
                  strokeWidth={1.75}
                />
                <input
                  id="bpjs-faskes"
                  type="text"
                  value={primaryFaskes}
                  onChange={(e) => setPrimaryFaskes(e.target.value)}
                  className="w-full bg-transparent text-[11px] font-medium text-[#0B3A5B] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* KARTU C: Kepesertaan Asuransi Swasta Tambahan */}
          <section
            aria-labelledby="card-c-title"
            className="rounded-[12px] border border-[#E3EAF5] bg-white p-[18px] shadow-[0_4px_18px_rgba(11,58,91,0.06)]"
          >
            {/* a. Header Kartu C */}
            <div className="flex items-start justify-between gap-[10px]">
              <div className="flex items-start gap-[10px]">
                <span className="mt-[2px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[8px] bg-[#EAF0FB] text-[11px] font-extrabold text-[#0B3A5B]">
                  C
                </span>
                <div>
                  <h2
                    id="card-c-title"
                    className="text-[13.5px] font-extrabold leading-[1.25] text-[#0B3A5B]"
                  >
                    Kepesertaan Asuransi Swasta
                    <br />
                    Tambahan
                  </h2>
                  <p className="mt-[2px] text-[10px] text-[#5B6B7B]">
                    Penjamin Sekunder (Secondary CoB Payer)
                  </p>
                </div>
              </div>

              {/* Pill Sekunder (Tier 2) wrap 2 baris */}
              <span className="inline-block shrink-0 rounded-full bg-[#DCE8F9] px-[12px] py-[5px] text-[9.5px] font-bold leading-[1.18] text-[#0B3A5B]">
                Sekunder (Tier
                <br />
                2)
              </span>
            </div>

            {/* b. Panel tint Polis Utama Asuransi Swasta */}
            <div className="mt-[15px] rounded-[8px] border border-[#E3EAF5] bg-[#EAF0FB]/65 p-[13px]">
              {/* Baris judul panel */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-[6px]">
                  <ShieldCheck
                    className="h-[13.5px] w-[13.5px] shrink-0 text-[#0B3A5B]"
                    strokeWidth={1.9}
                  />
                  <span className="text-[11px] font-extrabold text-[#0B3A5B]">
                    Polis Utama Asuransi Swasta
                  </span>
                </div>

                <span className="rounded-full bg-[#0B3A5B] px-[9px] py-[3px] text-[9px] font-bold leading-none text-white">
                  Aktif
                </span>
              </div>

              {/* Nama Perusahaan Asuransi Swasta */}
              <div className="mt-[10px]">
                <label
                  htmlFor="private-insurer-name"
                  className="block text-[10px] font-bold text-[#0B3A5B]"
                >
                  Nama Perusahaan Asuransi Swasta
                </label>
                <div className="relative mt-[4px]">
                  <select
                    id="private-insurer-name"
                    value={insurerName}
                    onChange={(e) => setInsurerName(e.target.value)}
                    className="h-[32px] w-full appearance-none rounded-[6px] border border-[#E3EAF5] bg-white pl-[10px] pr-[28px] text-[11px] font-semibold text-[#0B3A5B] focus:outline-none cursor-pointer"
                  >
                    <option value="Asuransi Sehat Sentosa (TPA Integrated)">
                      Asuransi Sehat Sentosa (TPA Integrated)
                    </option>
                    <option value="Mandiri Inhealth">Mandiri Inhealth</option>
                    <option value="Prudential Life">Prudential Life</option>
                    <option value="Manulife">Manulife</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-[9px] top-1/2 h-[12px] w-[12px] -translate-y-1/2 text-[#5B6B7B]"
                    strokeWidth={2}
                  />
                </div>
              </div>

              {/* Nomor Polis & Masa Berlaku Polis */}
              <div className="mt-[10px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="private-policy-no"
                    className="block text-[10px] font-bold text-[#0B3A5B]"
                  >
                    Nomor Polis / Nomor Kartu
                  </label>
                  <input
                    id="private-policy-no"
                    type="text"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    className="mt-[4px] h-[32px] w-full rounded-[6px] border border-[#E3EAF5] bg-white px-[10px] text-[11px] font-medium text-[#0B3A5B] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="private-policy-expiry"
                    className="block text-[10px] font-bold text-[#0B3A5B]"
                  >
                    Masa Berlaku Polis
                  </label>
                  <input
                    id="private-policy-expiry"
                    type="text"
                    value={policyExpiry}
                    onChange={(e) => setPolicyExpiry(e.target.value)}
                    className="mt-[4px] h-[32px] w-full rounded-[6px] border border-[#E3EAF5] bg-white px-[10px] text-[11px] font-medium text-[#0B3A5B] focus:outline-none"
                  />
                </div>
              </div>

              {/* Jenis Plan & Plafon Manfaat (terpotong di "(Full Cove" tanpa ellipsis) */}
              <div className="mt-[10px]">
                <label
                  htmlFor="private-plan-name"
                  className="block text-[10px] font-bold text-[#0B3A5B]"
                >
                  Jenis Plan &amp; Plafon Manfaat
                </label>
                <div className="@container mt-[4px] flex h-[32px] w-full items-center overflow-hidden rounded-[6px] border border-[#E3EAF5] bg-white">
                  <input
                    id="private-plan-name"
                    type="text"
                    value={planDescription}
                    onChange={(e) => setPlanDescription(e.target.value)}
                    style={{ fontSize: "3.21cqw", paddingLeft: "3.1cqw" }}
                    className="h-full w-full overflow-hidden bg-transparent pr-0 font-medium text-[#0B3A5B] whitespace-nowrap text-clip focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {showSecondInsurer && (
              <div className="mt-[10px] rounded-[8px] border border-[#E3EAF5] bg-[#EAF0FB]/50 p-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-extrabold text-[#0B3A5B]">
                    Polis Tambahan Kedua (Tier 3)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSecondInsurer(false)}
                    className="text-[9.5px] font-semibold text-[#D0214F] hover:underline cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
                <div className="mt-[8px] grid grid-cols-1 gap-[8px] sm:grid-cols-2">
                  <input
                    type="text"
                    value={secondInsurerName}
                    onChange={(e) => setSecondInsurerName(e.target.value)}
                    placeholder="Nama Asuransi"
                    className="h-[30px] rounded-[6px] border border-[#E3EAF5] bg-white px-[9px] text-[10.5px] font-medium text-[#0B3A5B] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={secondPolicyNumber}
                    onChange={(e) => setSecondPolicyNumber(e.target.value)}
                    placeholder="Nomor Polis"
                    className="h-[30px] rounded-[6px] border border-[#E3EAF5] bg-white px-[9px] text-[10.5px] font-medium text-[#0B3A5B] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* c. Tombol + Tambah Asuransi Tambahan Kedua (Opsional) */}
            <button
              type="button"
              onClick={() => setShowSecondInsurer((prev) => !prev)}
              className="mt-[12px] flex h-[30px] w-full items-center justify-center gap-[6px] rounded-[8px] bg-[#DCE8F9] px-[12px] text-[10.5px] font-bold text-[#0B3A5B] transition-colors hover:bg-[#CBE0FA] cursor-pointer"
            >
              <PlusCircle className="h-[13px] w-[13px]" strokeWidth={2} />
              <span>+ Tambah Asuransi Tambahan Kedua (Opsional)</span>
            </button>
          </section>
        </div>
      </div>

      {/* 8) KARTU FOOTER AKSI */}
      <section
        aria-label="Footer aksi pendaftaran pasien"
        className="mt-[22px] flex flex-col justify-between gap-4 rounded-[12px] border border-[#E3EAF5] bg-white px-[18px] py-[16px] shadow-[0_4px_18px_rgba(11,58,91,0.06)] md:flex-row md:items-center"
      >
        <div className="flex items-start gap-[12px]">
          <div className="mt-[2px] flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-[#EAF0FB] text-[#0B3A5B]">
            <Info className="h-[16px] w-[16px]" strokeWidth={1.85} />
          </div>
          <div className="max-w-[415px]">
            <h3 className="text-[11px] font-extrabold text-[#0B3A5B]">
              Privasi Data Simulasi KAPJ Flow
            </h3>
            <p className="mt-[2px] text-[9.5px] leading-[1.45] text-[#5B6B7B]">
              Data pasien ini disimpan secara lokal dalam simulator KAPJ Flow.
              Verifikasi nomor kartu menggunakan protokol simulasi API
              terstandar (VClaim BPJS &amp; Adjudication Engine Terpadu).
            </p>
          </div>
        </div>

        {/* Dua baris tombol rata kanan */}
        <div className="flex shrink-0 flex-col items-end gap-[8px]">
          <div className="flex items-center justify-end gap-[8px]">
            <button
              type="button"
              onClick={() => router.push("/patients")}
              className="inline-flex h-[30px] items-center justify-center rounded-[6px] border border-[#E3EAF5] bg-[#EAF0FB]/75 px-[12px] text-[10.5px] font-semibold text-[#0B3A5B] transition-colors hover:bg-[#DCE8F9] cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex h-[30px] items-center gap-[6px] rounded-[6px] bg-[#DCE8F9] px-[12px] text-[10.5px] font-bold text-[#0B3A5B] transition-colors hover:bg-[#CBE0FA] cursor-pointer"
            >
              <Save className="h-[12px] w-[12px]" strokeWidth={2} />
              <span>Simpan Draft Identitas</span>
            </button>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmitPatient(true)}
            className="inline-flex h-[32px] items-center justify-center gap-[6px] rounded-[6px] bg-[#0B3A5B] px-[16px] text-[10.5px] font-bold text-white transition-colors hover:bg-[#154B6B] disabled:opacity-60 cursor-pointer"
          >
            <ArrowRight className="h-[12.5px] w-[12.5px]" strokeWidth={2.2} />
            <span>Simpan &amp; Buat Kasus Perawatan Baru</span>
          </button>
        </div>
      </section>
    </div>
  );
}
