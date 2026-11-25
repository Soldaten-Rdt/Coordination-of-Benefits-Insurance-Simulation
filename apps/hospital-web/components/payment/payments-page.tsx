"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Building2,
  CircleCheck,
  Info,
  ReceiptText,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { useWorkspace } from "@/components/layout";
import { Button } from "@/components/ui";
import {
  getBankReconciliation,
  getPaymentSummary,
  listPayments,
} from "@/lib/api/cases";
import { getAccessToken } from "@/lib/auth/token";
import type {
  BankReconciliationRow,
  PaymentCase,
  PaymentSummary,
} from "@/types/case";
import {
  EmptyState,
  ErrorState,
  formatDate,
  formatRupiah,
  LoadingState,
  Panel,
  paymentStatusLabel,
  StatusBadge,
} from "@/components/case/case-ui";

type View = "payments" | "reconciliation";

export function PaymentsPage() {
  const { searchQuery } = useWorkspace();
  const [view, setView] = React.useState<View>("payments");
  const [status, setStatus] = React.useState("ALL");
  const [payer, setPayer] = React.useState("ALL");
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<PaymentCase[]>([]);
  const [reconciliationRows, setReconciliationRows] = React.useState<
    BankReconciliationRow[]
  >([]);
  const [reconciliationPreview, setReconciliationPreview] = React.useState<
    BankReconciliationRow[]
  >([]);
  const [reconciliationPreviewError, setReconciliationPreviewError] =
    React.useState("");
  const [reconciliationPreviewLoading, setReconciliationPreviewLoading] =
    React.useState(true);
  const [summary, setSummary] = React.useState<PaymentSummary | null>(null);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [reloadKey, setReloadKey] = React.useState(0);
  const pageSize = 10;

  React.useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      setError("Silakan masuk ke Hospital Workspace untuk melihat pembayaran.");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    const fetchData = async () => {
      try {
        if (view === "payments") {
          const [summaryResponse, response] = await Promise.all([
            getPaymentSummary(),
            listPayments({
                page,
                limit: pageSize,
                status,
                payer,
                q: searchQuery,
              }),
          ]);
          if (!active) return;
          setSummary(summaryResponse.data);
          setRows(response.data);
          setTotal(response.meta.total);
        } else {
          const [summaryResponse, response] = await Promise.all([
            getPaymentSummary(),
            getBankReconciliation({ page, limit: pageSize }),
          ]);
          if (!active) return;
          setSummary(summaryResponse.data);
          setReconciliationRows(response.data);
          setTotal(response.meta.total);
        }
      } catch (cause: unknown) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Data pembayaran gagal dimuat.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchData();
    return () => {
      active = false;
    };
  }, [page, payer, searchQuery, status, view, reloadKey]);

  React.useEffect(() => {
    setPage(1);
  }, [payer, searchQuery, status, view]);

  React.useEffect(() => {
    if (!getAccessToken()) {
      setReconciliationPreviewLoading(false);
      setReconciliationPreviewError(
        "Silakan masuk untuk melihat data rekonsiliasi."
      );
      return;
    }
    let active = true;
    setReconciliationPreviewLoading(true);
    getBankReconciliation({ page: 1, limit: 3 })
      .then((response) => {
        if (active) {
          setReconciliationPreview(response.data);
          setReconciliationPreviewError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setReconciliationPreviewError(
            cause instanceof Error
              ? cause.message
              : "Ringkasan rekonsiliasi gagal dimuat."
          );
        }
      })
      .finally(() => {
        if (active) setReconciliationPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#DCE8F7] bg-white px-4 py-3 shadow-[0_4px_18px_rgba(11,58,91,0.03)] sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF0FB] text-[#154B6B]">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold text-[#234B66]">
              Rekonsiliasi pembayaran
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${
                reconciliationPreviewError
                  ? "bg-rose-50 text-rose-700"
                  : reconciliationPreviewLoading
                    ? "bg-[#EAF0FB] text-[#315D7A]"
                    : reconciliationPreview.length > 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-800"
              }`}>
                <CircleCheck className="h-3 w-3" />
                {reconciliationPreviewError
                  ? "Data gagal dimuat"
                  : reconciliationPreviewLoading
                    ? "Memuat status"
                    : reconciliationPreview.length > 0
                      ? "Transaksi tersedia"
                      : "Belum ada transaksi"}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-[#71869A]">
              Pantau transaksi tercatat dan referensi bank melalui layanan rekonsiliasi.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => setView("reconciliation")}
        >
          Buka rekonsiliasi
        </Button>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#668098]">
          Hospital Ops / Keuangan
        </div>
        <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-[#0B3A5B]">
          Pembayaran & rekonsiliasi
        </h1>
        <p className="mt-1 text-xs text-[#5B6B7B]">
          Pantau penerimaan pembayaran lintas kasus dan cocokkan referensi bank.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Disetujui penjamin"
          value={summary ? formatRupiah(summary.total_approved_payers) : "—"}
          icon={<Banknote className="h-4 w-4" />}
        />
        <SummaryCard
          label="Pembayaran diterima"
          value={summary ? formatRupiah(summary.total_paid_received) : "—"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <SummaryCard
          label="Transfer penjamin menunggu"
          value={summary ? formatRupiah(summary.waiting_payer_transfers) : "—"}
          icon={<Banknote className="h-4 w-4" />}
        />
        <SummaryCard
          label="Sisa ekses pasien"
          value={summary ? formatRupiah(summary.remaining_patient_excess) : "—"}
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(270px,0.75fr)]">
      <Panel
        title={view === "payments" ? "Daftar pembayaran per kasus" : "Rekonsiliasi bank"}
        description={
          view === "payments"
            ? "Buka kasus untuk meninjau invoice, alokasi, dan transaksi pembayaran."
            : "Daftar transaksi dan referensi bank untuk pencocokan."
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-fit gap-1 rounded-lg bg-[#F3F6FB] p-1">
            <button
              type="button"
              onClick={() => setView("payments")}
              className={`rounded-md px-3 py-2 text-[11px] font-bold ${
                view === "payments"
                  ? "bg-white text-[#154B6B] shadow-sm"
                  : "text-[#657A8C]"
              }`}
            >
              Pembayaran
            </button>
            <button
              type="button"
              onClick={() => setView("reconciliation")}
              className={`rounded-md px-3 py-2 text-[11px] font-bold ${
                view === "reconciliation"
                  ? "bg-white text-[#154B6B] shadow-sm"
                  : "text-[#657A8C]"
              }`}
            >
              Rekonsiliasi bank
            </button>
          </div>
          {view === "payments" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-[190px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7990A2]" />
                <input
                  value={searchQuery}
                  readOnly
                  aria-label="Pencarian dari bilah atas"
                  placeholder="Gunakan pencarian di bagian atas"
                  className="h-9 w-full rounded-lg border border-[#E3EAF5] bg-[#F9FBFE] pl-9 pr-3 text-[11px] text-[#5B6B7B]"
                />
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Filter status pembayaran"
                className="h-9 rounded-lg border border-[#E3EAF5] bg-white px-3 text-[11px] font-semibold text-[#34566E]"
              >
                <option value="ALL">Semua status</option>
                <option value="UNPAID">Belum dibayar</option>
                <option value="PARTIAL">Sebagian</option>
                <option value="PAID">Lunas</option>
              </select>
              <select
                value={payer}
                onChange={(event) => setPayer(event.target.value)}
                aria-label="Filter penjamin"
                className="h-9 rounded-lg border border-[#E3EAF5] bg-white px-3 text-[11px] font-semibold text-[#34566E]"
              >
                <option value="ALL">Semua penjamin</option>
                <option value="BPJS">BPJS</option>
                <option value="PRIVATE_INSURANCE">Asuransi swasta</option>
                <option value="PATIENT">Pasien</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-[#E3EAF5]">
          {loading ? (
            <LoadingState label="Memuat data keuangan..." />
          ) : error ? (
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((value) => value + 1)}
            />
          ) : view === "payments" ? (
            rows.length === 0 ? (
              <EmptyState
                title="Belum ada data pembayaran"
                description="Kasus dan transaksi yang sesuai filter akan muncul di sini."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-[10px]">
                    <thead className="bg-[#F7F9FC] text-[9px] uppercase tracking-wide text-[#8293A2]">
                      <tr>
                        <th className="px-4 py-3">Kasus / Pasien</th>
                        <th className="px-3 py-3 text-right">Tagihan</th>
                        <th className="px-3 py-3 text-right">Disetujui</th>
                        <th className="px-3 py-3 text-right">Diterima</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9EEF5]">
                      {rows.map((row) => (
                        <tr key={row.case_id} className="hover:bg-[#F9FBFE]">
                          <td className="px-4 py-3">
                            <Link
                              href={`/cases/${row.case_id}`}
                              className="font-extrabold text-[#315D7A] hover:underline"
                            >
                              {row.case_number}
                            </Link>
                            <div className="mt-1 text-[10px] text-[#6A7E90]">
                              {row.patient_name}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-[#45657A]">
                            {formatRupiah(row.total_hospital_bill)}
                          </td>
                          <td className="px-3 py-3 text-right text-[#45657A]">
                            {formatRupiah(row.total_approved)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-[#234B66]">
                            {formatRupiah(row.total_paid)}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={row.payment_status}>
                              {paymentStatusLabel(row.payment_status)}
                            </StatusBadge>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Link
                              href={`/cases/${row.case_id}`}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#E0E8F0] px-2.5 text-[10px] font-bold text-[#315D7A] hover:bg-[#F0F5FA]"
                            >
                              Invoice <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  pageSize={pageSize}
                  total={total}
                  onPage={setPage}
                />
              </>
            )
          ) : reconciliationRows.length === 0 ? (
            <EmptyState
              title="Belum ada transaksi untuk direkonsiliasi"
              description="Transaksi yang dicatat akan ditampilkan sebagai baris rekonsiliasi."
              icon="check"
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-[10px]">
                  <thead className="bg-[#F7F9FC] text-[9px] uppercase tracking-wide text-[#8293A2]">
                    <tr>
                      <th className="px-4 py-3">Transaksi</th>
                      <th className="px-3 py-3">Kasus / Pasien</th>
                      <th className="px-3 py-3">Penjamin</th>
                      <th className="px-3 py-3">Referensi bank</th>
                      <th className="px-3 py-3">Tanggal</th>
                      <th className="px-3 py-3">Verifikasi</th>
                      <th className="px-3 py-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E9EEF5]">
                    {reconciliationRows.map((row) => (
                      <tr key={row.transaction_code} className="hover:bg-[#F9FBFE]">
                        <td className="px-4 py-3 font-bold text-[#315D7A]">
                          {row.transaction_code}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-[#45657A]">
                            {row.case_number}
                          </div>
                          <div className="mt-1 text-[9px] text-[#8191A0]">
                            {row.patient_name}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[#5E7689]">
                          {row.payer_source.replaceAll("_", " ")}
                        </td>
                        <td className="px-3 py-3 text-[#5E7689]">
                          {row.bank_reference || "—"}
                        </td>
                        <td className="px-3 py-3 text-[#5E7689]">
                          {formatDate(row.paid_at)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={row.verification_status} />
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-[#234B66]">
                          {formatRupiah(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                total={total}
                onPage={setPage}
              />
            </>
          )}
        </div>
      </Panel>
      <aside className="space-y-4">
        <Panel
          title="Penerimaan kasir & payer"
          description="Ringkasan penerimaan pembayaran lintas kasus."
          action={<ReceiptText className="h-4 w-4 text-[#65839A]" />}
        >
          <div className="rounded-lg bg-[#EAF0FB] p-3">
            <div className="text-[9px] font-bold uppercase tracking-wide text-[#71869A]">
              Pembayaran diterima
            </div>
            <div className="mt-1 text-lg font-extrabold text-[#154B6B]">
              {summary ? formatRupiah(summary.total_paid_received) : "—"}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#D9E4F1] pt-2 text-[9px]">
              <span className="text-[#71869A]">Menunggu transfer penjamin</span>
              <span className="font-bold text-[#315D7A]">
                {summary ? formatRupiah(summary.waiting_payer_transfers) : "—"}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-4 text-[#71869A]">
            Pencatatan transaksi dilakukan dari invoice masing-masing kasus agar saldo dan validasi overpayment tetap mengikuti backend.
          </p>
          {rows[0] && (
            <Link
              href={`/cases/${rows[0].case_id}`}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B3A5B] px-3 py-2.5 text-[10px] font-extrabold text-white hover:bg-[#154B6B]"
            >
              Buka kasus pembayaran
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </Panel>

        <Panel
          title="Rekonsiliasi bank"
          description="Transaksi terbaru dari layanan rekonsiliasi."
          action={<RefreshCw className="h-4 w-4 text-[#65839A]" />}
        >
          {reconciliationPreviewError ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-[10px] leading-4 text-rose-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {reconciliationPreviewError}
            </div>
          ) : reconciliationPreview.length === 0 ? (
            <div className="py-4 text-center text-[10px] text-[#71869A]">
              Belum ada transaksi untuk ditampilkan.
            </div>
          ) : (
            <div className="space-y-2">
              {reconciliationPreview.map((row) => (
                <div key={row.transaction_code} className="rounded-lg bg-[#F3F6FB] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-extrabold text-[#315D7A]">{row.transaction_code}</div>
                      <div className="mt-1 text-[9px] text-[#8293A2]">{row.case_number} · {formatDate(row.paid_at)}</div>
                    </div>
                    <StatusBadge status={row.verification_status} />
                  </div>
                  <div className="mt-2 text-right text-[11px] font-extrabold text-[#0B3A5B]">{formatRupiah(row.amount)}</div>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setView("reconciliation")}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#EAF0FB] px-3 py-2 text-[10px] font-bold text-[#315D7A] hover:bg-[#DFE9F8]"
          >
            Lihat semua rekonsiliasi
            <ArrowRight className="h-3 w-3" />
          </button>
        </Panel>

        <div className="rounded-xl border border-[#DCE8F7] bg-[#F0F5FF] p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#315D7A]" />
            <p className="text-[10px] leading-4 text-[#49667B]">
              Status pembayaran dan nilai disetujui berasal dari catatan kasus serta keputusan penjamin. Perubahan saldo akan terlihat setelah data dimuat ulang.
            </p>
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E3EAF5] bg-white p-4 shadow-[0_4px_18px_rgba(11,58,91,0.03)]">
      <div className="flex items-center justify-between text-[#71869A]">
        <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-sm font-extrabold text-[#154B6B]">{value}</div>
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-[#E3EAF5] px-4 py-3 text-[10px] text-[#6A7E90] sm:flex-row sm:items-center sm:justify-between">
      <span>
        Menampilkan {total === 0 ? 0 : (page - 1) * pageSize + 1}–
        {Math.min(page * pageSize, total)} dari {total} transaksi
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Sebelumnya
        </Button>
        <span>
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
