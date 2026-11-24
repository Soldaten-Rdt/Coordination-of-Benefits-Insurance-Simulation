import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileWarning,
  LoaderCircle,
} from "lucide-react";
import type { PaymentStatus, SubclaimStatus } from "@/types/api";

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return {
    UNPAID: "Belum dibayar",
    PARTIAL: "Pembayaran sebagian",
    PAID: "Lunas",
  }[status];
}

export function subclaimStatusLabel(status: SubclaimStatus): string {
  return {
    DRAFT: "Draft",
    SUBMITTED: "Diajukan",
    IN_REVIEW: "Sedang ditinjau",
    REVISION_REQUIRED: "Perlu revisi",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
  }[status];
}

export function StatusBadge({
  status,
  children,
}: {
  status: PaymentStatus | SubclaimStatus | string;
  children?: React.ReactNode;
}) {
  const tone =
    status === "PAID" || status === "APPROVED" || status === "VALID"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
      : status === "REVISION_REQUIRED" ||
          status === "REJECTED" ||
          status === "MISSING"
        ? "bg-rose-50 text-rose-700 ring-rose-600/15"
        : status === "UNPAID" || status === "DRAFT" || status === "PARTIAL"
          ? "bg-amber-50 text-amber-800 ring-amber-600/15"
          : "bg-blue-50 text-blue-700 ring-blue-600/15";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${tone}`}
    >
      {children ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[#E3EAF5] bg-white shadow-[0_4px_18px_rgba(11,58,91,0.04)] ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E3EAF5] px-5 py-4">
        <div>
          <h2 className="text-sm font-extrabold text-[#0B3A5B]">{title}</h2>
          {description && (
            <p className="mt-1 text-xs leading-5 text-[#5B6B7B]">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function LoadingState({ label = "Memuat data..." }: { label?: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[#5B6B7B]">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = "file",
}: {
  title: string;
  description: string;
  icon?: "file" | "clock" | "check";
}) {
  const Icon =
    icon === "check" ? CheckCircle2 : icon === "clock" ? Clock3 : FileWarning;
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
      <Icon className="h-8 w-8 text-[#8AA0B4]" strokeWidth={1.6} />
      <h3 className="mt-3 text-sm font-bold text-[#0B3A5B]">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-5 text-[#5B6B7B]">
        {description}
      </p>
    </div>
  );
}

export function ErrorState({
  title = "Data tidak dapat dimuat",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
      <AlertCircle className="h-8 w-8 text-[#D0214F]" strokeWidth={1.7} />
      <h3 className="mt-3 text-sm font-bold text-[#0B3A5B]">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-5 text-[#5B6B7B]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-[#E3EAF5] px-3 py-2 text-xs font-bold text-[#154B6B] hover:bg-[#F6F8FE]"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-[11px] font-medium text-rose-700">{children}</p>;
}

export const inputClass =
  "h-10 w-full rounded-lg border border-[#DCE5F0] bg-white px-3 text-xs text-[#0B3A5B] outline-none transition focus:border-[#3B789F] focus:ring-2 focus:ring-[#3B789F]/15 disabled:bg-slate-50";

export const labelClass = "mb-1.5 block text-[11px] font-bold text-[#34566E]";
