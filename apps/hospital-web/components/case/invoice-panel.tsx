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
          title="Alokasi per penjamin"
          description="Nilai persetujuan, pembayaran masuk, dan saldo sesuai catatan backend."
        >
          <div className="space-y-3">
            {allocations.map((allocation) => (
              <article
                key={allocation.payer_source}
                className="rounded-lg border border-[#E6ECF3] p-3.5"
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
              <label className={labelClass} htmlFor="payment-amount">
                Nominal diterima (Rp)
              </label>
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

      <Panel title="Komponen tagihan invoice">
        <div className="divide-y divide-[#EEF2F6]">
          {invoice.bill_items.map((item, index) => (
            <div
              key={item.id ?? `${item.description}-${index}`}
              className="flex flex-wrap justify-between gap-2 py-2.5 text-[10px]"
            >
              <span className="font-semibold text-[#45657A]">
                {item.description}{" "}
                <span className="font-normal text-[#8293A2]">
                  × {item.quantity}
                </span>
              </span>
              <span className="font-bold text-[#234B66]">
                {formatRupiah(item.subtotal)}
              </span>
            </div>
          ))}
          <div className="flex justify-between pt-3 text-xs font-extrabold text-[#0B3A5B]">
            <span>Total tagihan</span>
            <span>{formatRupiah(invoice.summary.total_hospital_bill)}</span>
          </div>
        </div>
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
