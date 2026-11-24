import type { ClaimStatus } from "@/types";

export const rupiah = (value: unknown) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);

export const dateTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const statusNames: Record<string, string> = {
  SUBMITTED: "Masuk", IN_REVIEW: "Sedang ditinjau", REVISION_REQUIRED: "Perlu revisi", APPROVED: "Disetujui", REJECTED: "Ditolak",
};

export const statusLabel = (status: ClaimStatus) => statusNames[status] || status.replaceAll("_", " ");
