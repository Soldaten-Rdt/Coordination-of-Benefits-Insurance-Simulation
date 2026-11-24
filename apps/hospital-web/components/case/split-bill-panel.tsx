"use client";

import * as React from "react";
import { Calculator, CheckCircle2, LockKeyhole } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import {
  applySplitBill,
  calculateSplitBill,
  getSplitBill,
} from "@/lib/api/cases";
import { ApiClientError } from "@/lib/api/client";
import type { CaseDetail, SplitBillInput, SplitBillResult } from "@/types/case";
import { formatRupiah, Panel, StatusBadge } from "./case-ui";

export function SplitBillPanel({
  caseData,
  onRefresh,
}: {
  caseData: CaseDetail;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const isNonCob = caseData.simulation_mode === "NON_COB";
  const [method, setMethod] = React.useState<"PERCENTAGE" | "NOMINAL">(
    caseData.split_bill?.split_method ?? "PERCENTAGE"
  );
  const [preset, setPreset] = React.useState(
    caseData.split_bill?.preset_name ?? "ARBITRARY_COB_30_58_12"
  );
  const [percent, setPercent] = React.useState({
    bpjs: caseData.split_bill?.bpjs_percent ?? 30,
    insurer: isNonCob ? 0 : (caseData.split_bill?.insurer_percent ?? 58),
    patient: caseData.split_bill?.patient_percent ?? 12,
  });
  const [nominal, setNominal] = React.useState({
    bpjs: caseData.split_bill?.bpjs_estimated ?? 0,
    insurer: isNonCob ? 0 : (caseData.split_bill?.insurer_estimated ?? 0),
  });
  const [result, setResult] = React.useState<SplitBillResult | null>(
    caseData.split_bill
  );
  const [calculating, setCalculating] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loadError, setLoadError] = React.useState("");
  const total = caseData.total_hospital_bill;

  React.useEffect(() => {
    let active = true;
    getSplitBill(caseData.id)
      .then((response) => {
        if (active) setResult(response.data.simulation);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiClientError && cause.status === 404) {
          setResult(null);
          return;
        }
        setLoadError(
          cause instanceof Error ? cause.message : "Split bill gagal dimuat."
        );
      });
    return () => {
      active = false;
    };
  }, [caseData.id]);

  const setPresetValues = (value: string) => {
    setPreset(value);
    if (value === "ARBITRARY_COB_30_58_12") {
      setPercent({ bpjs: 30, insurer: isNonCob ? 0 : 58, patient: 12 });
    } else if (value === "BPJS_70_PATIENT_30") {
      setPercent({ bpjs: 70, insurer: 0, patient: 30 });
    } else if (value === "EQUAL_COB") {
      setPercent({
        bpjs: 50,
        insurer: isNonCob ? 0 : 30,
        patient: isNonCob ? 50 : 20,
      });
    } else {
      setPreset("CUSTOM");
    }
  };

  const handleCalculate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (
      method === "PERCENTAGE" &&
      Math.abs(
        Number(percent.bpjs) +
          Number(isNonCob ? 0 : percent.insurer) +
          Number(percent.patient) -
          100
      ) > 0.000001
    ) {
      setError("Total alokasi persentase harus tepat 100%.");
      return;
    }
    setCalculating(true);
    const body: SplitBillInput =
      method === "PERCENTAGE"
        ? {
            preset_name: preset,
            split_method: method,
            bpjs_percent: Number(percent.bpjs),
            insurer_percent: isNonCob ? 0 : Number(percent.insurer),
            patient_percent: Number(percent.patient),
          }
        : {
            preset_name: "CUSTOM_NOMINAL",
            split_method: method,
            bpjs_percent: 0,
            insurer_percent: 0,
            patient_percent: 0,
            custom_bpjs_amount: Number(nominal.bpjs),
            custom_insurer_amount: isNonCob ? 0 : Number(nominal.insurer),
          };
    try {
      const response = await calculateSplitBill(caseData.id, body);
      setResult(response.data);
      await onRefresh();
      toast({
        title: "Simulasi split bill dihitung",
        description: "Estimasi berikut berasal dari respons backend.",
        variant: "success",
      });
    } catch (cause: unknown) {
      const message =
        cause instanceof ApiClientError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Simulasi gagal dihitung.";
      setError(message);
      toast({ title: "Split bill gagal dihitung", description: message, variant: "error" });
    } finally {
      setCalculating(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setError("");
    try {
      await applySplitBill(caseData.id);
      await onRefresh();
      toast({
        title: "Split bill diterapkan",
        description: "Alokasi tersimpan dan subklaim draft diperbarui.",
        variant: "success",
      });
    } catch (cause: unknown) {
      const message =
        cause instanceof Error ? cause.message : "Alokasi gagal diterapkan.";
      setError(message);
      toast({ title: "Gagal menerapkan alokasi", description: message, variant: "error" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <AmountCard label="Total tagihan RS" value={formatRupiah(total)} />
        <AmountCard
          label="Tarif referensi INA-CBG"
          value={formatRupiah(caseData.ina_cbg_tariff)}
        />
        <div className="flex items-center gap-2 rounded-lg border border-[#E3EAF5] bg-[#F8FAFD] px-4 py-3">
          {isNonCob ? (
            <LockKeyhole className="h-4 w-4 text-[#52758C]" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          )}
          <div>
            <div className="text-[9px] font-bold uppercase text-[#8293A2]">
              Mode penjamin
            </div>
            <div className="mt-1 text-xs font-extrabold text-[#234B66]">
              {isNonCob ? "NON_COB · BPJS saja" : "COB · BPJS + swasta"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <Panel
          title="Kalkulator pembagian biaya"
          description="Hasil perhitungan akan disimpan dan divalidasi oleh backend."
        >
          <form onSubmit={handleCalculate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-[#34566E]">
                  Metode pembagian
                </label>
                <select
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value as typeof method)
                  }
                  className="h-10 w-full rounded-lg border border-[#DCE5F0] bg-white px-3 text-xs text-[#0B3A5B]"
                >
                  <option value="PERCENTAGE">Persentase</option>
                  <option value="NOMINAL">Nominal manual</option>
                </select>
              </div>
              {method === "PERCENTAGE" && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-[#34566E]">
                    Preset pembagian
                  </label>
                  <select
                    value={preset}
                    onChange={(event) => setPresetValues(event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#DCE5F0] bg-white px-3 text-xs text-[#0B3A5B]"
                  >
                    <option value="ARBITRARY_COB_30_58_12">COB 30 / 58 / 12</option>
                    <option value="BPJS_70_PATIENT_30">BPJS 70 / Pasien 30</option>
                    {!isNonCob && (
                      <option value="EQUAL_COB">COB 50 / 30 / 20</option>
                    )}
                    <option value="CUSTOM">Kustom</option>
                  </select>
                </div>
              )}
            </div>

            {method === "PERCENTAGE" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <PercentField
                  label="BPJS (%)"
                  value={percent.bpjs}
                  onChange={(value) => {
                    setPercent((current) => ({ ...current, bpjs: value }));
                    setPreset("CUSTOM");
                  }}
                />
                <PercentField
                  label="Asuransi swasta (%)"
                  value={percent.insurer}
                  disabled={isNonCob}
                  onChange={(value) => {
                    setPercent((current) => ({ ...current, insurer: value }));
                    setPreset("CUSTOM");
                  }}
                />
                <PercentField
                  label="Pasien (%)"
                  value={percent.patient}
                  onChange={(value) => {
                    setPercent((current) => ({ ...current, patient: value }));
                    setPreset("CUSTOM");
                  }}
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <MoneyField
                  label="Alokasi BPJS (Rp)"
                  value={nominal.bpjs}
                  onChange={(value) =>
                    setNominal((current) => ({ ...current, bpjs: value }))
                  }
                />
                <MoneyField
                  label="Alokasi asuransi swasta (Rp)"
                  value={nominal.insurer}
                  disabled={isNonCob}
                  onChange={(value) =>
                    setNominal((current) => ({ ...current, insurer: value }))
                  }
                />
                <p className="text-[10px] leading-4 text-[#708597] sm:col-span-2">
                  Sisa dari total tagihan otomatis menjadi porsi pasien; jumlah
                  penjamin tidak boleh melebihi total.
                </p>
              </div>
            )}

            {isNonCob && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-[10px] leading-4 text-blue-900">
                Mode NON_COB mengunci alokasi asuransi swasta menjadi Rp 0 dan
                tidak membuat subklaim asuransi.
              </div>
            )}
            {loadError && (
              <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
                {loadError}
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
                {error}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                isLoading={calculating}
                leftIcon={<Calculator className="h-3.5 w-3.5" />}
              >
                Hitung simulasi
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!result || result.is_applied}
                isLoading={applying}
                onClick={() => void handleApply()}
              >
                Terapkan alokasi
              </Button>
            </div>
          </form>
        </Panel>

        <Panel
          title="Estimasi alokasi"
          description="Angka ini menjadi resmi setelah kalkulasi backend diterapkan."
          action={
            result?.is_applied ? (
              <StatusBadge status="APPROVED">Sudah diterapkan</StatusBadge>
            ) : null
          }
        >
          {!result ? (
            <div className="py-8 text-center text-xs text-[#71869A]">
              Jalankan kalkulasi untuk melihat pembagian biaya.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <Allocation
                  label="BPJS Kesehatan"
                  amount={result.bpjs_estimated}
                  percent={result.bpjs_percent}
                  color="bg-[#1B6286]"
                />
                <Allocation
                  label="Asuransi swasta"
                  amount={result.insurer_estimated}
                  percent={result.insurer_percent}
                  color="bg-[#3B8A87]"
                  muted={isNonCob}
                />
                <Allocation
                  label="Pasien / keluarga"
                  amount={result.patient_estimated}
                  percent={result.patient_percent}
                  color="bg-[#E8A24D]"
                />
              </div>
              <div className="border-t border-[#E7EDF4] pt-3">
                <div className="flex justify-between text-[10px] text-[#71869A]">
                  <span>Total alokasi</span>
                  <span className="font-extrabold text-[#0B3A5B]">
                    {formatRupiah(
                      result.bpjs_estimated +
                        result.insurer_estimated +
                        result.patient_estimated
                    )}
                  </span>
                </div>
                <div className="mt-1 text-[9px] text-[#8293A2]">
                  Metode: {result.split_method === "NOMINAL" ? "Nominal" : "Persentase"}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {result?.is_applied && caseData.bill_items.some((item) => item.bpjs_portion !== undefined) && (
        <Panel
          title="Distribusi per item tagihan"
          description="Rincian pembagian tiap item setelah alokasi diterapkan."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[10px]">
              <thead className="text-[9px] uppercase tracking-wide text-[#8293A2]">
                <tr>
                  <th className="pb-2 pr-3">Item</th>
                  <th className="px-2 pb-2 text-right">BPJS</th>
                  {!isNonCob && <th className="px-2 pb-2 text-right">Swasta</th>}
                  <th className="pb-2 pl-2 text-right">Pasien</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F6]">
                {caseData.bill_items.map((item) => (
                  <tr key={item.id ?? item.description}>
                    <td className="py-2.5 pr-3 font-semibold text-[#34566E]">
                      {item.description}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {formatRupiah(item.bpjs_portion ?? 0)}
                    </td>
                    {!isNonCob && (
                      <td className="px-2 py-2.5 text-right">
                        {formatRupiah(item.insurer_portion ?? 0)}
                      </td>
                    )}
                    <td className="py-2.5 pl-2 text-right">
                      {formatRupiah(item.patient_portion ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function AmountCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E3EAF5] bg-white px-4 py-3">
      <div className="text-[9px] font-bold uppercase tracking-wide text-[#8293A2]">
        {label}
      </div>
      <div className="mt-1 text-sm font-extrabold text-[#154B6B]">{value}</div>
    </div>
  );
}

function PercentField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-[#34566E]">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-10 w-full rounded-lg border border-[#DCE5F0] bg-white px-3 pr-8 text-xs text-[#0B3A5B] disabled:bg-slate-100"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8193A3]">
          %
        </span>
      </div>
    </label>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-[#34566E]">
        {label}
      </span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full rounded-lg border border-[#DCE5F0] bg-white px-3 text-xs text-[#0B3A5B] disabled:bg-slate-100"
      />
    </label>
  );
}

function Allocation({
  label,
  amount,
  percent,
  color,
  muted = false,
}: {
  label: string;
  amount: number;
  percent: number;
  color: string;
  muted?: boolean;
}) {
  return (
    <div className={muted ? "opacity-55" : ""}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#4D687C]">{label}</span>
        <span className="text-[10px] font-extrabold text-[#0B3A5B]">
          {formatRupiah(amount)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ECF1F6]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[9px] text-[#8293A2]">
        {percent.toFixed(2)}%
      </div>
    </div>
  );
}
