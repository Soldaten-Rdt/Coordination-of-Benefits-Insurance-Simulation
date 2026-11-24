"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Banknote, Search, Wallet } from "lucide-react";
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

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#668098]">
          Hospital Ops / Keuangan
        </div>
        <h1 className="mt-1 text-[22px] font-extrabold tracking-tight text-[#0B3A5B]">
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

      <Panel
        title={view === "payments" ? "Daftar pembayaran per kasus" : "Rekonsiliasi bank"}
        description={
          view === "payments"
            ? "Buka invoice untuk melihat alokasi dan mencatat transaksi."
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
