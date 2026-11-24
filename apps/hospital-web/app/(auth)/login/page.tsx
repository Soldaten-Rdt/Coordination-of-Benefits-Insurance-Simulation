"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  AtSign,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  IdCard,
  Landmark,
  Loader2,
  Lock,
  ShieldCheck,
  SquarePlus,
  User,
  UserSquare2,
  Wallet,
} from "lucide-react";
import { ApiClientError, loginHospital } from "@/lib/api";
import { setAccessToken, setStoredSession } from "@/lib/auth/token";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const DEMO_ACCOUNT = {
  fullName: "Siti Rahmawati, S.Kep",
  roleTitle: "Admin Billing & Casemix",
  email: "siti.rahmawati@rs-jantung.co.id",
  password: "KasirRS#2025",
} as const;

const OPERATIONAL_MODULES = [
  {
    title: "Manajemen Pasien & Kasus Terintegrasi",
    description:
      "Kelola rekam medik kasus, eligibilitas peserta, serta alur rawat inap dan rawat jalan multi-penjamin secara runtut.",
    icon: UserSquare2,
  },
  {
    title: "Split-Bill CoB Calculator",
    description:
      "Simulasi proporsi tagihan BPJS Kesehatan dan Asuransi Swasta otomatis sesuai formularium tarif INA-CBGs & polis komersial.",
    icon: Calculator,
  },
  {
    title: "Sinkronisasi Klaim & Rekonsiliasi Kasir",
    description:
      "Pantau realisasi pembayaran multi-penyelenggara, split-dossier, serta approval surat jaminan (SEP & GL) tanpa jeda verifikasi manual.",
    icon: Landmark,
  },
] as const;

type TopNavDialogKey = "sso" | "security" | "audit" | "help" | null;

const TOP_NAV_INFO: Record<
  Exclude<TopNavDialogKey, null>,
  { title: string; description: string; body: string }
> = {
  sso: {
    title: "Institutional SSO — Node Faskes v2.4",
    description: "Integrasi Single Sign-On Rumah Sakit Mitra",
    body: "Pada mode Simulator Sandbox v2.4.0, autentikasi dilakukan menggunakan kredensial SIMRS lokal (JWT Bearer) pada Hospital Service (:8081). Gunakan akun demo petugas atau kredensial SIMRS yang terdaftar.",
  },
  security: {
    title: "Security Verification",
    description: "Standar Keamanan Pertukaran Klaim KAPJ Flow",
    body: "Komunikasi antar-node (Hospital, BPJS Kesehatan, dan Asuransi Swasta) menggunakan token otorisasi Bearer JWT untuk sesi pengguna dan kunci layanan terverifikasi (X-KAPJ-Service-Key) untuk callback webhook.",
  },
  audit: {
    title: "Audit Status — Node Faskes v2.4",
    description: "Status Kesiapan Infrastruktur Simulasi",
    body: "Node Hospital Workspace siap mencatat jejak audit untuk setiap perubahan status klaim, unggah dokumen pendukung (SEP/GL), kalkulasi split-bill, dan rekonsiliasi pembayaran kasir.",
  },
  help: {
    title: "Bantuan Akses & Reset Kredensial SIMRS",
    description: "Administrasi Akun Petugas Rumah Sakit",
    body: "Untuk pembuatan akun petugas baru atau pengaturan ulang kata sandi di lingkungan simulasi, hubungi Administrator SIMRS RS Jantung Nusantara atau gunakan tombol 'Terapkan' pada kartu akun demo.",
  },
};

export default function HospitalLoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = React.useState<string>(DEMO_ACCOUNT.email);
  const [password, setPassword] = React.useState<string>(DEMO_ACCOUNT.password);
  const [showPassword, setShowPassword] = React.useState(true);
  const [rememberMe, setRememberMe] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [statusState, setStatusState] = React.useState<{
    type: "ready" | "error" | "success";
    message: string;
  }>({
    type: "ready",
    message: "Siap diarahkan ke Hospital Dashboard",
  });

  const [fieldErrors, setFieldErrors] = React.useState<{
    email?: string;
    password?: string;
  }>({});

  const [isValidationSimulated, setIsValidationSimulated] =
    React.useState(false);
  const [infoModal, setInfoModal] = React.useState<TopNavDialogKey>(null);

  const handleApplyDemo = () => {
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    setFieldErrors({});
    setIsValidationSimulated(false);
    setStatusState({
      type: "ready",
      message: "Siap diarahkan ke Hospital Dashboard",
    });
  };

  const handleToggleValidationSim = () => {
    if (isValidationSimulated) {
      setIsValidationSimulated(false);
      setFieldErrors({});
      setStatusState({
        type: "ready",
        message: "Siap diarahkan ke Hospital Dashboard",
      });
      return;
    }

    setIsValidationSimulated(true);
    setFieldErrors({
      email: "Format email institusi RS atau ID petugas tidak dikenali.",
      password: "Kata sandi tidak sesuai dengan kebijakan kredensial SIMRS.",
    });
    setStatusState({
      type: "error",
      message: "Validasi gagal (401): Email atau kata sandi tidak sesuai",
    });
  };

  const validateForm = (): boolean => {
    const nextErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = "Email atau ID Petugas wajib diisi.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = "Masukkan alamat email institusi yang valid.";
    }

    if (!password) {
      nextErrors.password = "Kata sandi wajib diisi.";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatusState({
        type: "error",
        message: "Mohon periksa kembali kolom email dan kata sandi Anda.",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsValidationSimulated(false);

    if (!validateForm()) return;

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const response = await loginHospital({
        email: email.trim(),
        password,
      });

      const { access_token, user, simulation_mode } = response.data;
      setAccessToken(access_token, rememberMe);
      setStoredSession(user, simulation_mode, rememberMe);

      setStatusState({
        type: "success",
        message: "Autentikasi berhasil — Mengarahkan ke Hospital Dashboard...",
      });

      toast({
        variant: "success",
        title: "Berhasil Masuk",
        description: `Selamat datang kembali, ${user.full_name}.`,
      });

      router.push("/dashboard");
    } catch (error) {
      if (error instanceof ApiClientError) {
        const mapped = error.fieldErrors;
        if (mapped.email || mapped.password) {
          setFieldErrors({
            email: mapped.email,
            password: mapped.password,
          });
        }
        setStatusState({
          type: "error",
          message:
            error.status === 401
              ? "Email atau kata sandi yang dimasukkan salah."
              : error.message,
        });
      } else {
        setStatusState({
          type: "error",
          message:
            "Tidak dapat terhubung ke Hospital Service (:8081). Pastikan backend aktif.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeModalContent = infoModal ? TOP_NAV_INFO[infoModal] : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F8FE] text-[#0B3A5B]">
      {/* Header (56px, 3 area, nav tepat di tengah) */}
      <header className="relative flex h-[56px] w-full shrink-0 items-center justify-between border-b border-[#E3EAF5] bg-white px-[24px]">
        {/* Kiri: Logo + Badge */}
        <div className="flex items-center gap-[10px]">
          <div className="flex items-center gap-[9px]">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[#0B3A5B] text-white">
              <Wallet className="h-[16px] w-[16px]" strokeWidth={1.8} />
            </div>
            <span className="text-[17px] font-extrabold leading-none tracking-[-0.01em] text-[#0B3A5B]">
              KAPJ Flow
            </span>
          </div>

          <span className="hidden items-center gap-[6px] rounded-full bg-[#EAF0FB] px-[10px] py-[4px] text-[11px] font-semibold leading-none text-[#0B3A5B] sm:inline-flex">
            <span
              className="h-[5px] w-[5px] rounded-full bg-[#0B3A5B]"
              aria-hidden="true"
            />
            Healthcare Settlement Infrastructure
          </span>
        </div>

        {/* Tengah: Nav benar-benar terpusat */}
        <nav
          aria-label="Navigasi infrastruktur"
          className="pointer-events-auto absolute left-1/2 hidden -translate-x-1/2 items-center gap-[24px] lg:flex"
        >
          <span className="text-[16px] font-semibold leading-none text-[#0B3A5B]">
            Sign In
          </span>
          <button
            type="button"
            onClick={() => setInfoModal("sso")}
            className="text-[14px] font-medium leading-none text-[#5B6B7B] transition-colors hover:text-[#0B3A5B] cursor-pointer"
          >
            Institutional SSO
          </button>
          <button
            type="button"
            onClick={() => setInfoModal("security")}
            className="text-[14px] font-medium leading-none text-[#5B6B7B] transition-colors hover:text-[#0B3A5B] cursor-pointer"
          >
            Security Verification
          </button>
          <button
            type="button"
            onClick={() => setInfoModal("audit")}
            className="text-[14px] font-medium leading-none text-[#5B6B7B] transition-colors hover:text-[#0B3A5B] cursor-pointer"
          >
            Audit Status
          </button>
        </nav>

        {/* Kanan: Badge TLS + Avatar */}
        <div className="flex items-center gap-[10px]">
          <span className="hidden items-center gap-[6px] rounded-full bg-[#EAF0FB] px-[10px] py-[4px] text-[11px] font-semibold leading-none text-[#0B3A5B] sm:inline-flex">
            <ShieldCheck
              className="h-[14px] w-[14px] text-[#0B3A5B]"
              strokeWidth={1.8}
            />
            TLS 1.3 | ISO 27001
          </span>

          <button
            type="button"
            onClick={() => setInfoModal("help")}
            aria-label="Informasi portal petugas"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#0B3A5B] text-white transition-colors hover:bg-[#154B6B] cursor-pointer"
          >
            <User className="h-[15px] w-[15px]" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* Main Content — dipusatkan vertikal dengan ruang kosong atas & bawah */}
      <main className="flex flex-1 items-center justify-center px-[24px] py-12">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-between gap-12 lg:flex-row lg:gap-[160px]">
          {/* Kolom Kiri (Hero) — lebar ±565px */}
          <section
            aria-labelledby="welcome-heading"
            className="w-full max-w-[565px] shrink-0 text-left"
          >
            {/* a. Baris badge */}
            <div className="flex flex-wrap items-center gap-[8px]">
              <span className="inline-flex items-center rounded-full bg-[#0B3A5B] px-[11px] py-[4px] text-[11px] font-bold uppercase leading-none tracking-[0.04em] text-white">
                HOSPITAL WORKSPACE
              </span>
              <span className="inline-flex items-center gap-[6px] rounded-full bg-[#EAF0FB] px-[11px] py-[4px] text-[11px] font-semibold leading-none text-[#0B3A5B]">
                <span
                  className="h-[6px] w-[6px] rounded-full bg-[#D0214F]"
                  aria-hidden="true"
                />
                Node Faskes v2.4
              </span>
            </div>

            {/* b. H1 */}
            <h1
              id="welcome-heading"
              className="mt-[15px] text-[30px] font-extrabold leading-[1.2] tracking-[-0.01em] text-[#0B3A5B]"
            >
              Selamat Datang Kembali
            </h1>

            {/* c. Paragraf */}
            <p className="mt-[8px] max-w-[560px] text-[16px] font-normal leading-[1.5] text-[#5B6B7B]">
              Masuk ke Hospital Workspace untuk mengelola data pasien, kasus
              perawatan, koordinasi klaim, dan pembayaran dalam satu platform
              terpadu.
            </p>

            {/* d. Kartu putih "MODUL OPERASIONAL AKTIF" */}
            <div className="mt-[22px] rounded-[15px] border border-[#E3EAF5] bg-white p-[16px] shadow-[0_8px_30px_rgba(11,58,91,0.08)]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#0B3A5B]">
                  MODUL OPERASIONAL AKTIF
                </h2>
                <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold text-[#5B6B7B]">
                  <Activity
                    className="h-[14px] w-[14px] text-[#0B3A5B]"
                    strokeWidth={1.8}
                  />
                  SLA Realtime
                </span>
              </div>

              <div className="mt-[12px] flex flex-col gap-[8px]">
                {OPERATIONAL_MODULES.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <div
                      key={mod.title}
                      className="flex items-start gap-[13px] rounded-[8px] bg-[#EAF0FB] px-[13px] py-[10px]"
                    >
                      <div className="mt-[1px] flex h-[33px] w-[33px] shrink-0 items-center justify-center rounded-[8px] bg-[#0B3A5B] text-white">
                        <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-bold leading-[1.3] text-[#0B3A5B]">
                          {mod.title}
                        </h3>
                        <p className="mt-[3px] text-[12.5px] font-normal leading-[1.45] text-[#5B6B7B]">
                          {mod.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* e. Kotak tint Jaringan Rumah Sakit Mitra Pengujian */}
            <div className="mt-[22px] rounded-[10px] bg-[#EAF0FB] px-[13px] py-[10px]">
              <div className="flex items-center gap-[6px] text-[12.5px] font-bold leading-[1.4] text-[#0B3A5B]">
                <Building2
                  className="h-[15px] w-[15px] shrink-0 text-[#0B3A5B]"
                  strokeWidth={1.8}
                />
                <span>Jaringan Rumah Sakit Mitra Pengujian:</span>
              </div>
              <p className="mt-[3px] text-[12.5px] font-normal leading-[1.45] text-[#5B6B7B]">
                Terhubung ke simulasi{" "}
                <strong className="font-bold text-[#0B3A5B]">
                  RS Jantung Nusantara
                </strong>
                ,{" "}
                <strong className="font-bold text-[#0B3A5B]">
                  RS Sentra Medika
                </strong>
                , dan{" "}
                <strong className="font-bold text-[#0B3A5B]">
                  RS Siloam Kebon Jeruk
                </strong>
                .
              </p>
            </div>
          </section>

          {/* Kolom Kanan (Kartu Login) — lebar ±435px */}
          <section
            aria-labelledby="login-card-heading"
            className="w-full max-w-[435px] shrink-0 rounded-[15px] border border-[#E3EAF5] bg-white p-[22px] shadow-[0_8px_30px_rgba(11,58,91,0.08)]"
          >
            {/* a. Pill tint */}
            <span className="inline-flex items-center gap-[6px] rounded-full bg-[#EAF0FB] px-[10px] py-[4px] text-[11px] font-semibold leading-none text-[#0B3A5B]">
              <SquarePlus
                className="h-[14px] w-[14px] text-[#0B3A5B]"
                strokeWidth={1.8}
              />
              Akses Petugas Rumah Sakit
            </span>

            {/* b. H2 */}
            <h2
              id="login-card-heading"
              className="mt-[12px] text-[22px] font-extrabold leading-[1.25] tracking-[-0.01em] text-[#0B3A5B]"
            >
              Masuk ke Akun Anda
            </h2>

            {/* c. Subteks */}
            <p className="mt-[4px] text-[12.5px] font-normal leading-[1.45] text-[#5B6B7B]">
              Gunakan akun rumah sakit yang telah terdaftar dalam ekosistem
              SIMRS.
            </p>

            {/* d. Kotak akun tersimpan */}
            <div className="mt-[13px] flex items-center justify-between gap-[10px] rounded-[8px] bg-[#EAF0FB] px-[13px] py-[10px]">
              <div className="flex min-w-0 items-center gap-[10px]">
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#0B3A5B] text-white">
                  <IdCard className="h-[15px] w-[15px]" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-bold leading-[1.3] text-[#0B3A5B]">
                    {DEMO_ACCOUNT.fullName}
                  </p>
                  <p className="truncate text-[11px] font-normal leading-[1.3] text-[#5B6B7B]">
                    {DEMO_ACCOUNT.roleTitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyDemo}
                className="shrink-0 rounded-full border border-[#E3EAF5] bg-white px-[13px] py-[4px] text-[11px] font-semibold text-[#0B3A5B] transition-colors hover:bg-[#F6F8FE] cursor-pointer"
              >
                Terapkan
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              noValidate
              className="mt-[15px] flex flex-col gap-[13px]"
            >
              {/* e. Email atau ID Petugas */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-[13.5px] font-bold leading-[1.3] text-[#0B3A5B]"
                >
                  Email atau ID Petugas
                </label>
                <div className="relative mt-[6px] flex items-center">
                  <AtSign
                    className="pointer-events-none absolute left-[12px] h-[16px] w-[16px] text-[#5B6B7B]"
                    strokeWidth={1.75}
                  />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          email: undefined,
                        }));
                      }
                      if (statusState.type === "error") {
                        setStatusState({
                          type: "ready",
                          message: "Siap diarahkan ke Hospital Dashboard",
                        });
                      }
                    }}
                    placeholder="siti.rahmawati@rs-jantung.co.id"
                    aria-invalid={Boolean(fieldErrors.email)}
                    className={cn(
                      "h-[42px] w-full rounded-[8px] border bg-white pl-[36px] pr-[12px] text-[13.5px] font-medium text-[#0B3A5B] placeholder:text-[#5B6B7B]/60 transition-colors focus:outline-none",
                      fieldErrors.email
                        ? "border-[#D0214F] focus:border-[#D0214F]"
                        : "border-[#E3EAF5] focus:border-[#154B6B]"
                    )}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-[4px] text-[11px] font-medium text-[#D0214F]">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* f. Kata Sandi */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-[13.5px] font-bold leading-[1.3] text-[#0B3A5B]"
                >
                  Kata Sandi
                </label>
                <div className="relative mt-[6px] flex items-center">
                  <Lock
                    className="pointer-events-none absolute left-[12px] h-[16px] w-[16px] text-[#5B6B7B]"
                    strokeWidth={1.75}
                  />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          password: undefined,
                        }));
                      }
                      if (statusState.type === "error") {
                        setStatusState({
                          type: "ready",
                          message: "Siap diarahkan ke Hospital Dashboard",
                        });
                      }
                    }}
                    placeholder="Masukkan kata sandi"
                    aria-invalid={Boolean(fieldErrors.password)}
                    className={cn(
                      "h-[42px] w-full rounded-[8px] border bg-white pl-[36px] pr-[36px] text-[13.5px] font-medium text-[#0B3A5B] placeholder:text-[#5B6B7B]/60 transition-colors focus:outline-none",
                      fieldErrors.password
                        ? "border-[#D0214F] focus:border-[#D0214F]"
                        : "border-[#E3EAF5] focus:border-[#154B6B]"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                    }
                    className="absolute right-[10px] flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-[#5B6B7B] transition-colors hover:text-[#0B3A5B] cursor-pointer"
                  >
                    {showPassword ? (
                      <Eye className="h-[16px] w-[16px]" strokeWidth={1.75} />
                    ) : (
                      <EyeOff
                        className="h-[16px] w-[16px]"
                        strokeWidth={1.75}
                      />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-[4px] text-[11px] font-medium text-[#D0214F]">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* g. Remember me + Lupa password? */}
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-[8px] cursor-pointer select-none">
                  <span className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="flex h-[17px] w-[17px] items-center justify-center rounded-[4px] border border-[#E3EAF5] bg-white transition-colors peer-checked:border-[#0B3A5B] peer-checked:bg-[#0B3A5B]">
                      {rememberMe && (
                        <Check
                          className="h-[12px] w-[12px] text-white"
                          strokeWidth={3}
                        />
                      )}
                    </span>
                  </span>
                  <span className="text-[12.5px] font-medium text-[#5B6B7B]">
                    Ingat saya
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setInfoModal("help")}
                  className="text-[12.5px] font-bold text-[#0B3A5B] hover:underline cursor-pointer"
                >
                  Lupa password?
                </button>
              </div>

              {/* h. Kotak info */}
              <div
                role="status"
                className={cn(
                  "flex items-center gap-[8px] rounded-[8px] px-[12px] py-[9px] text-[12.5px] font-semibold transition-colors",
                  statusState.type === "ready" &&
                    "bg-[#EAF0FB] text-[#0B3A5B]",
                  statusState.type === "error" &&
                    "border border-[#D0214F]/25 bg-[#D0214F]/8 text-[#D0214F]",
                  statusState.type === "success" &&
                    "border border-emerald-200 bg-emerald-50 text-emerald-700"
                )}
              >
                {statusState.type === "error" ? (
                  <AlertCircle
                    className="h-[16px] w-[16px] shrink-0 text-[#D0214F]"
                    strokeWidth={1.8}
                  />
                ) : (
                  <CheckCircle2
                    className={cn(
                      "h-[16px] w-[16px] shrink-0",
                      statusState.type === "success"
                        ? "text-emerald-600"
                        : "text-[#0B3A5B]"
                    )}
                    strokeWidth={1.8}
                  />
                )}
                <span className="leading-[1.35]">{statusState.message}</span>
              </div>

              {/* i. Simulasi Respon Auth */}
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-medium text-[#5B6B7B]">
                  Simulasi Respon Auth:
                </span>
                <button
                  type="button"
                  onClick={handleToggleValidationSim}
                  className="text-[11.5px] font-bold text-[#D0214F] hover:underline cursor-pointer"
                >
                  {isValidationSimulated
                    ? "Reset Status Normal"
                    : "Uji Respons Validasi"}
                </button>
              </div>

              {/* j. Tombol utama */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-[42px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-[#154B6B] px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-[#0F3C57] active:bg-[#0B3A5B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#154B6B] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-[16px] w-[16px] animate-spin" />
                    <span>Memverifikasi Akses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Hospital Workspace</span>
                    <ArrowRight
                      className="h-[16px] w-[16px]"
                      strokeWidth={2}
                    />
                  </>
                )}
              </button>
            </form>

            {/* k. Teks tengah */}
            <p className="mt-[15px] text-center text-[12.5px] font-normal text-[#5B6B7B]">
              Belum memiliki akses?{" "}
              <button
                type="button"
                onClick={() => setInfoModal("help")}
                className="font-bold text-[#0B3A5B] hover:underline cursor-pointer"
              >
                Hubungi administrator SIMRS.
              </button>
            </p>

            {/* l. Kotak tint kecil */}
            <div className="mt-[12px] rounded-[6px] bg-[#EAF0FB] px-[10px] py-[8px] text-center text-[10px] font-medium leading-[1.4] text-[#5B6B7B]">
              KAPJ Flow — Simulator Koordinasi Antar Penyelenggara Jaminan (CoB)
              &bull; Versi 2.4.0 Sandbox
            </div>
          </section>
        </div>
      </main>

      {/* Footer (44px, latar tint) */}
      <footer className="flex min-h-[44px] w-full shrink-0 flex-col items-center justify-between gap-1 bg-[#EAF0FB] px-[24px] py-2.5 text-[11px] font-semibold text-[#5B6B7B] sm:flex-row sm:py-0">
        <p>
          &copy; 2025 KAPJ Flow Financial Adjudication Systems. All rights
          reserved.
        </p>
        <div className="flex items-center gap-[24px]">
          <span>Protected Healthcare Network</span>
          <span>BPJS Interoperable Node</span>
        </div>
      </footer>

      {/* Modal info untuk kontrol sekunder */}
      <Modal
        open={infoModal !== null}
        onClose={() => setInfoModal(null)}
        title={activeModalContent?.title}
        description={activeModalContent?.description}
        size="sm"
        footer={
          <Button size="sm" onClick={() => setInfoModal(null)}>
            Mengerti
          </Button>
        }
      >
        <p className="text-xs leading-relaxed text-[#5B6B7B]">
          {activeModalContent?.body}
        </p>
      </Modal>
    </div>
  );
}
