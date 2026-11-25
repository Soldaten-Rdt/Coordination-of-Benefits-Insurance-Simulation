"use client";

import * as React from "react";
import {
  Mail,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { Button, useToast } from "@/components/ui";
import {
  getInvoice,
  recordPayment,
  sendPatientInvoice,
} from "@/lib/api/cases";
import { ApiClientError } from "@/lib/api/client";
import type { CaseDetail, InvoiceData } from "@/types/case";
import {
  EmptyState,
  ErrorState,
  formatDate,
  formatRupiah,
  inputClass,
  labelClass,
  LoadingState,
  Panel,
  StatusBadge,
} from "./case-ui";

export function InvoicePanel({
  caseData,
  onRefresh,
}: {
  caseData: CaseDetail;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [invoice, setInvoice] = React.useState<InvoiceData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [payer, setPayer] = React.useState<
    "BPJS" | "PRIVATE_INSURANCE" | "PATIENT"
  >("BPJS");
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState("BANK_TRANSFER");
  const [reference, setReference] = React.useState("");
  const [paymentError, setPaymentError] = React.useState("");
  const [amountError, setAmountError] = React.useState("");
  const [savingPayment, setSavingPayment] = React.useState(false);
  const [sendingInvoice, setSendingInvoice] = React.useState(false);

  const loadInvoice = React.useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await getInvoice(caseData.id);
      setInvoice(response.data);
      const defaultPayer =
        response.data.allocations.find(
          (allocation) =>
            allocation.remaining_amount > 0 &&
            (caseData.simulation_mode === "COB" ||
              allocation.payer_source !== "PRIVATE_INSURANCE")
        )?.payer_source ?? "BPJS";
      setPayer(defaultPayer);
    } catch (cause: unknown) {
      setLoadError(
        cause instanceof Error ? cause.message : "Invoice gagal dimuat."
      );
    } finally {
      setLoading(false);
    }
  }, [caseData.id, caseData.simulation_mode]);

  React.useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  const allocations =
    invoice?.allocations.filter(
      (allocation) =>
        caseData.simulation_mode === "COB" ||
        allocation.payer_source !== "PRIVATE_INSURANCE"
    ) ?? [];
  const selectedAllocation = allocations.find(
    (allocation) => allocation.payer_source === payer
  );

  const handleRecordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPaymentError("");
    setAmountError("");
    setSavingPayment(true);
    try {
      await recordPayment(caseData.id, {
        payer_source: payer,
        amount: Number(amount),
        payment_method: method,
        bank_reference: reference.trim(),
      });
      setAmount("");
      setReference("");
      await Promise.all([loadInvoice(), onRefresh()]);
      toast({
        title: "Transaksi pembayaran dicatat",
        description: "Saldo dan status kasus diperbarui dari backend.",
        variant: "success",
      });
    } catch (cause: unknown) {
      if (cause instanceof ApiClientError) {
        const fieldMessage = cause.fieldErrors.amount;
        setAmountError(fieldMessage ?? "");
        setPaymentError(cause.message);
      } else {
        setPaymentError(
          cause instanceof Error ? cause.message : "Pembayaran gagal dicatat."
        );
      }
      toast({
        title: "Pembayaran gagal dicatat",
        description:
          cause instanceof Error ? cause.message : "Periksa kembali data pembayaran.",
        variant: "error",
      });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSendInvoice = async () => {
    setSendingInvoice(true);
    try {
      await sendPatientInvoice(caseData.id);
      await onRefresh();
      toast({
        title: "Invoice ditandai terkirim",
        description: "Aktivitas pengiriman telah dicatat.",
        variant: "success",
      });
    } catch (cause: unknown) {
      toast({
        title: "Invoice gagal dikirim",
        description: cause instanceof Error ? cause.message : "Terjadi kesalahan.",
        variant: "error",
      });
    } finally {
      setSendingInvoice(false);
    }
  };

  if (loading) return <LoadingState label="Memuat invoice..." />;
  if (loadError || !invoice) {
    return (
      <ErrorState
        message={loadError || "Invoice tidak tersedia."}
        onRetry={() => void loadInvoice()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-xl bg-[#0B3A5B] p-5 text-white sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">
            <ReceiptText className="h-3.5 w-3.5" />
            Invoice simulasi CoB
          </div>
          <div className="mt-1 text-lg font-extrabold">{invoice.invoice_number}</div>
          <div className="mt-1 text-[10px] text-white/70">
            {invoice.patient.full_name} · {invoice.patient.patient_code}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleSendInvoice()}
          isLoading={sendingInvoice}
          leftIcon={<Mail className="h-3.5 w-3.5" />}
        >
          Kirim ke pasien
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total tagihan"
          value={formatRupiah(invoice.summary.total_hospital_bill)}
        />
        <SummaryCard
          label="Disetujui penjamin"
          value={formatRupiah(invoice.summary.total_approved_payers)}
        />
        <SummaryCard
          label="Pembayaran masuk"
          value={formatRupiah(invoice.summary.total_paid_received)}
        />
        <SummaryCard
          label="Sisa tagihan"
          value={formatRupiah(invoice.summary.remaining_open_balance)}
          highlight={invoice.summary.remaining_open_balance > 0}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(310px,0.9fr)]">
        <Panel
          title="Invoice simulasi / rekap pembagian biaya"
          description="Rincian tagihan dan alokasi multi-penjamin mengikuti respons backend."
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-[#E6ECF3] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="inline-flex rounded-full bg-[#EAF0FB] px-2 py-1 text-[9px] font-bold text-[#315D7A]">
                    Dokumen simulasi · {invoice.invoice_number}
                  </span>
                  <h3 className="mt-2 text-sm font-extrabold text-[#0B3A5B]">
                    Komponen tagihan rumah sakit
                  </h3>
                  <p className="mt-1 text-[10px] text-[#71869A]">
                    {invoice.patient.full_name} · {invoice.patient.room_info}
                  </p>
                </div>
                <span className="text-[9px] font-semibold text-[#8293A2]">
                  {invoice.bill_items.length} item
                </span>
              </div>
              {invoice.bill_items.length === 0 ? (
                <div className="py-5 text-center text-[10px] text-[#71869A]">
                  Tidak ada item tagihan pada invoice ini.
                </div>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[440px] text-left text-[10px]">
                    <thead className="bg-[#EAF0FB] text-[9px] uppercase tracking-wide text-[#71869A]">
                      <tr>
                        <th className="px-2.5 py-2">Uraian layanan</th>
                        <th className="px-2.5 py-2 text-right">Unit / durasi</th>
                        <th className="px-2.5 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF2F6]">
                      {invoice.bill_items.map((item, index) => (
                        <tr key={item.id ?? `${item.description}-${index}`}>
                          <td className="px-2.5 py-2.5 font-semibold text-[#34566E]">{item.description}</td>
                          <td className="px-2.5 py-2.5 text-right text-[#71869A]">{item.unit_info || item.quantity}</td>
                          <td className="px-2.5 py-2.5 text-right font-bold text-[#234B66]">{formatRupiah(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#EAF0FB]">
                        <td colSpan={2} className="px-2.5 py-2.5 text-right font-bold text-[#34566E]">Total nilai tagihan</td>
                        <td className="px-2.5 py-2.5 text-right font-extrabold text-[#0B3A5B]">{formatRupiah(invoice.summary.total_hospital_bill)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-[#F3F6FB] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#71869A]">
                  Rasio pembagian alokasi
                </span>
                <span className="text-[9px] font-bold text-[#315D7A]">
                  Total alokasi {formatRupiah(allocations.reduce((total, item) => total + item.amount, 0))}
                </span>
              </div>
              <div className="mt-2 flex h-4 overflow-hidden rounded-md">
                {allocations.map((allocation) => (
                  <div
                    key={allocation.payer_source}
                    className={`h-full ${
                      allocation.payer_source === "BPJS"
                        ? "bg-[#0B3A5B]"
                        : allocation.payer_source === "PRIVATE_INSURANCE"
                          ? "bg-[#456D8B]"
                          : "bg-[#E55B83]"
                    }`}
                    style={{ width: `${Math.min(Math.max(allocation.ratio_percent, 0), 100)}%` }}
                    title={`${allocation.label}: ${allocation.ratio_percent.toFixed(2)}%`}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {allocations.map((allocation) => (
                  <span key={allocation.payer_source} className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#60798D]">
                    <span className={`h-2 w-2 rounded-sm ${
                      allocation.payer_source === "BPJS"
                        ? "bg-[#0B3A5B]"
                        : allocation.payer_source === "PRIVATE_INSURANCE"
                          ? "bg-[#456D8B]"
                          : "bg-[#E55B83]"
                    }`} />
                    {allocation.label} ({allocation.ratio_percent.toFixed(0)}%)
                  </span>
                ))}
              </div>
            </div>

            {allocations.map((allocation) => (
              <article
                key={allocation.payer_source}
                className={`rounded-lg border border-[#E6ECF3] border-l-[3px] p-3.5 ${
                  allocation.payer_source === "BPJS"
                    ? "border-l-[#0B3A5B]"
                    : allocation.payer_source === "PRIVATE_INSURANCE"
                      ? "border-l-[#456D8B]"
                      : "border-l-[#E55B83]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-extrabold text-[#234B66]">
                      {allocation.label}
                    </div>
                    <div className="mt-1 text-[9px] text-[#8293A2]">
                      {allocation.ratio_percent.toFixed(2)}% dari tagihan
                    </div>
                  </div>
                  <StatusBadge status={allocation.status} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Amount label="Alokasi" value={formatRupiah(allocation.amount)} />
                  <Amount label="Dibayar" value={formatRupiah(allocation.paid_amount)} />
                  <Amount
                    label="Sisa"
                    value={formatRupiah(allocation.remaining_amount)}
                  />
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel
          title="Catat transaksi pembayaran"
          description="Validasi overpayment dilakukan backend terhadap sisa alokasi penjamin."
        >
          <form onSubmit={handleRecordPayment} className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="payment-payer">
                Sumber pembayaran
              </label>
              <select
                id="payment-payer"
                value={payer}
                onChange={(event) =>
                  setPayer(
                    event.target.value as
                      | "BPJS"
                      | "PRIVATE_INSURANCE"
                      | "PATIENT"
                  )
                }
                className={inputClass}
              >
                {allocations.map((allocation) => (
                  <option
                    key={allocation.payer_source}
                    value={allocation.payer_source}
                  >
                    {allocation.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className={`${labelClass} flex items-center justify-between gap-2`}>
                <label htmlFor="payment-amount">Nominal diterima (Rp)</label>
                {selectedAllocation && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(selectedAllocation.remaining_amount))}
                    className="text-[9px] font-bold text-[#315D7A] hover:underline"
                  >
                    Bayar penuh sisa
                  </button>
                )}
              </div>
              <input
                id="payment-amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setAmountError("");
                }}
                className={inputClass}
                required
              />
              {selectedAllocation && (
                <p className="mt-1 text-[10px] text-[#71869A]">
                  Sisa alokasi {formatRupiah(selectedAllocation.remaining_amount)}
                </p>
              )}
              {amountError && (
                <p className="mt-1 text-[10px] font-semibold text-rose-700">
                  {amountError}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="payment-method">
                Metode pembayaran
              </label>
              <select
                id="payment-method"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className={inputClass}
              >
                <option value="BANK_TRANSFER">Transfer bank</option>
                <option value="VIRTUAL_ACCOUNT">Virtual account</option>
                <option value="CASH">Tunai</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="payment-reference">
                Referensi bank / transaksi
              </label>
              <input
                id="payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className={inputClass}
                placeholder="Opsional"
                maxLength={100}
              />
            </div>
            {paymentError && (
              <div role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">
                {paymentError}
              </div>
            )}
            <Button
              type="submit"
              isLoading={savingPayment}
              disabled={!payer || Number(amount) <= 0}
              leftIcon={<WalletCards className="h-3.5 w-3.5" />}
            >
              Catat pembayaran
            </Button>
          </form>
        </Panel>
      </div>

      <Panel
        title="Riwayat transaksi"
        description="Riwayat transaksi pada invoice ini."
      >
        {invoice.transactions.length === 0 ? (
          <EmptyState
            title="Belum ada transaksi pembayaran"
            description="Transaksi yang dicatat akan muncul di sini."
            icon="clock"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[690px] text-left text-[10px]">
              <thead className="text-[9px] uppercase tracking-wide text-[#8293A2]">
                <tr>
                  <th className="pb-2 pr-3">Kode transaksi</th>
                  <th className="px-2 pb-2">Sumber</th>
                  <th className="px-2 pb-2">Metode</th>
                  <th className="px-2 pb-2">Tanggal</th>
                  <th className="px-2 pb-2">Referensi</th>
                  <th className="pb-2 pl-2 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F6]">
                {invoice.transactions.map((transaction) => (
                  <tr key={transaction.id ?? transaction.transaction_code}>
                    <td className="py-3 pr-3 font-bold text-[#315D7A]">
                      {transaction.transaction_code}
                    </td>
                    <td className="px-2 py-3 text-[#5E7689]">
                      {transaction.payer_label ?? transaction.payer_source}
                    </td>
                    <td className="px-2 py-3 text-[#5E7689]">
                      {transaction.payment_method}
                    </td>
                    <td className="px-2 py-3 text-[#5E7689]">
                      {formatDate(transaction.paid_at)}
                    </td>
                    <td className="px-2 py-3 text-[#8293A2]">
                      {transaction.bank_reference || "—"}
                    </td>
                    <td className="py-3 pl-2 text-right font-extrabold text-[#0B3A5B]">
                      {formatRupiah(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        highlight
          ? "border-amber-100 bg-amber-50/60"
          : "border-[#E3EAF5] bg-white"
      }`}
    >
      <div className="text-[9px] font-bold uppercase tracking-wide text-[#8293A2]">
        {label}
      </div>
      <div
        className={`mt-1 text-sm font-extrabold ${
          highlight ? "text-amber-900" : "text-[#154B6B]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Amount({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#F7F9FC] px-2.5 py-2">
      <div className="text-[8px] font-bold uppercase text-[#8293A2]">{label}</div>
      <div className="mt-1 truncate text-[10px] font-extrabold text-[#34566E]">
        {value}
      </div>
    </div>
  );
}
