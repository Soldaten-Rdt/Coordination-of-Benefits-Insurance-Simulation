"use client";

import * as React from "react";
import {
  Calculator,
  CheckCircle2,
  Info,
  LockKeyhole,
  SlidersHorizontal,
  TableProperties,
} from "lucide-react";
import { Button, useToast } from "@/components/ui";
import {
  applySplitBill,
  calculateSplitBill,
  getSplitBill,
} from "@/lib/api/cases";
import { ApiClientError } from "@/lib/api/client";
import type { CaseDetail, SplitBillInput, SplitBillResult } from "@/types/case";
import {
  formatRupiah,
  StatusBadge,
  subclaimStatusLabel,
} from "./case-ui";

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
    caseData.split_bill?.preset_name ??
      (isNonCob ? "BPJS_70_PATIENT_30" : "ARBITRARY_COB_30_58_12")
  );
  const [percent, setPercent] = React.useState({
    bpjs: caseData.split_bill?.bpjs_percent ?? (isNonCob ? 70 : 30),
    insurer: isNonCob ? 0 : (caseData.split_bill?.insurer_percent ?? 58),
    patient: caseData.split_bill?.patient_percent ?? (isNonCob ? 30 : 12),
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
    let saved = false;
    try {
      const response = await calculateSplitBill(caseData.id, body);
      setResult(response.data);
      saved = true;
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
      const description = saved
        ? `Simulasi tersimpan, tetapi detail kasus gagal diperbarui: ${message}`
        : message;
      setError(description);
      toast({
        title: saved ? "Simulasi tersimpan" : "Split bill gagal dihitung",
        description,
        variant: "error",
      });
    } finally {
      setCalculating(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setError("");
    let applied = false;
    try {
      await applySplitBill(caseData.id);
      applied = true;
      setResult((current) =>
        current ? { ...current, is_applied: true } : current
      );
      await onRefresh();
      toast({
        title: "Split bill diterapkan",
        description: "Alokasi tersimpan dan subklaim draft diperbarui.",
        variant: "success",
      });
    } catch (cause: unknown) {
      const failure =
        cause instanceof Error ? cause.message : "Alokasi gagal diterapkan.";
      const message = applied
        ? `Alokasi tersimpan, tetapi detail kasus gagal diperbarui: ${failure}`
        : failure;
      setError(message);
      toast({
        title: applied ? "Alokasi tersimpan" : "Gagal menerapkan alokasi",
        description: message,
        variant: "error",
      });
    } finally {
      setApplying(false);
    }
  };

  const bpjsClaim = caseData.subclaims.find(
    (claim) => claim.payer_type === "BPJS"
  );
  const insurerClaim = caseData.subclaims.find(
    (claim) => claim.payer_type === "PRIVATE_INSURANCE"
  );
  const allocationTotal = result
    ? result.bpjs_estimated +
      result.insurer_estimated +
      result.patient_estimated
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <section className="overflow-hidden rounded-xl border border-[#E3EAF5] bg-white shadow-[0_4px_18px_rgba(11,58,91,0.04)]">
          <header className="flex items-center gap-2 border-b border-[#E3EAF5] px-4 py-3.5">
            <SlidersHorizontal className="h-4 w-4 text-[#315D7A]" />
            <h2 className="text-xs font-extrabold text-[#0B3A5B]">
              Parameter Tagihan &amp; Skenario Simulasi
            </h2>
          </header>
          <form
            id="split-bill-calculation-form"
            onSubmit={handleCalculate}
            className="space-y-3.5 p-4"
          >
            <div>
              <label className="mb-1.5 block text-[10px] font-bold text-[#34566E]">
                Skenario Regulasi Aktif
              </label>
              <select
                value={method === "PERCENTAGE" ? preset : "CUSTOM_NOMINAL"}
                onChange={(event) => {
                  if (event.target.value === "CUSTOM_NOMINAL") {
                    setMethod("NOMINAL");
                  } else {
                    setMethod("PERCENTAGE");
                    setPresetValues(event.target.value);
                  }
                }}
                className="h-9 w-full rounded-lg border border-[#DCE5F0] bg-[#F8FAFD] px-3 text-[10px] text-[#34566E]"
              >
                <option value="ARBITRARY_COB_30_58_12">
                  Preset COB 30% / 58% / 12%
                </option>
                <option value="BPJS_70_PATIENT_30">BPJS 70% · Pasien 30%</option>
                {!isNonCob && <option value="EQUAL_COB">CoB 50% · 30% · 20%</option>}
                <option value="CUSTOM">Persentase kustom</option>
                <option value="CUSTOM_NOMINAL">Nominal manual</option>
              </select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <ReadOnlyAmount
                label="Total Tagihan RS (Real Bill)"
                value={formatRupiah(total)}
                accent
              />
              <ReadOnlyAmount
                label="Tarif JKN / INA-CBGs Referensi"
                value={formatRupiah(caseData.ina_cbg_tariff)}
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-[#DDE8FA] bg-[#EAF1FE] px-3 py-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#315D7A]" />
              <div className="text-[9px] leading-4 text-[#49667B]">
                <span className="font-bold text-[#234B66]">
                  Batas maksimum total alokasi: {formatRupiah(total)}.
                </span>{" "}
                Porsi penjamin tidak dapat melebihi tagihan; sisa menjadi
                tanggungan pasien.
              </div>
            </div>

            {method === "PERCENTAGE" ? (
              <div className="grid gap-2 sm:grid-cols-3">
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
              <div className="grid gap-2 sm:grid-cols-2">
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
              </div>
            )}

            {isNonCob && (
              <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[9px] leading-4 text-blue-900">
                <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
                Mode NON_COB mengunci alokasi asuransi swasta menjadi Rp 0.
              </div>
            )}
            {loadError && (
              <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-800">
                {loadError}
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-800">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E7EDF4] pt-3">
              <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Data tagihan tersinkron dari kasus
              </div>
              <Button
                type="submit"
                size="sm"
                isLoading={calculating}
                leftIcon={<Calculator className="h-3.5 w-3.5" />}
              >
                Hitung ulang alokasi
              </Button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#E3EAF5] bg-white shadow-[0_4px_18px_rgba(11,58,91,0.04)]">
          <header className="flex items-center gap-2 border-b border-[#E3EAF5] px-4 py-3.5">
            <LockKeyhole className="h-4 w-4 text-[#315D7A]" />
            <h2 className="text-xs font-extrabold text-[#0B3A5B]">
              Aturan Formula Skenario Diterapkan
            </h2>
          </header>
          <div className="space-y-2 p-4">
            <FormulaRule
              number="1"
              title="Formula BPJS Kesehatan"
              value={
                result
                  ? formatRupiah(result.bpjs_estimated)
                  : "Mengikuti alokasi"
              }
              detail={
                method === "PERCENTAGE"
                  ? `Porsi ${percent.bpjs}% × total tagihan ${formatRupiah(total)}.`
                  : "Nominal mengikuti nilai yang dimasukkan; backend memvalidasi batas tagihan."
              }
              tone="blue"
            />
            <FormulaRule
              number="2"
              title="Porsi Asuransi Swasta"
              value={
                isNonCob
                  ? "Rp 0"
                  : result
                    ? formatRupiah(result.insurer_estimated)
                    : "Mengikuti alokasi"
              }
              detail={
                isNonCob
                  ? "Dikunci Rp 0 pada mode NON_COB."
                  : "Dihitung sesuai alokasi dan tidak boleh membuat total melebihi tagihan."
              }
              tone="rose"
            />
            <FormulaRule
              number="3"
              title="Tanggungan Pasien"
              value={
                result
                  ? formatRupiah(result.patient_estimated)
                  : "Sisa tagihan"
              }
              detail="Sisa setelah alokasi BPJS dan asuransi swasta diperhitungkan."
              tone="amber"
            />
            <div className="flex gap-2 rounded-lg border border-[#DDE8FA] bg-[#EAF1FE] px-3 py-2.5 text-[9px] leading-4 text-[#49667B]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#315D7A]" />
              <p>
                Tarif INA-CBG ditampilkan sebagai referensi. Nilai alokasi
                final dihitung dan divalidasi oleh layanan backend sesuai
                skenario yang dipilih.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-[#E3EAF5] bg-white shadow-[0_4px_18px_rgba(11,58,91,0.04)]">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <h2 className="text-xs font-extrabold text-[#0B3A5B]">
            Visualisasi Proporsi Alokasi Tagihan
          </h2>
          {result?.is_applied && (
            <StatusBadge status="APPROVED">Alokasi diterapkan</StatusBadge>
          )}
        </header>
        <div className="px-4 pb-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {result ? (
                <>
                  <Legend
                    color="bg-[#0B3A5B]"
                    label={`BPJS Kesehatan (${result.bpjs_percent.toFixed(0)}%)`}
                  />
                  {!isNonCob && (
                    <Legend
                      color="bg-[#C51F53]"
                      label={`Asuransi Swasta (${result.insurer_percent.toFixed(0)}%)`}
                    />
                  )}
                  <Legend
                    color="bg-[#E18C26]"
                    label={`Pasien / Co-Pay (${result.patient_percent.toFixed(0)}%)`}
                  />
                </>
              ) : (
                <span className="text-[9px] text-[#8293A2]">
                  Hitung simulasi untuk melihat proporsi.
                </span>
              )}
            </div>
            <span className="text-[9px] font-bold text-[#60798D]">
              Total: {formatRupiah(result?.total_bill ?? total)}
            </span>
          </div>
          <div
            className="flex h-7 overflow-hidden rounded-md bg-[#EEF2F8]"
            aria-label={
              result
                ? `Alokasi BPJS ${result.bpjs_percent}%, asuransi ${result.insurer_percent}%, pasien ${result.patient_percent}%`
                : "Proporsi alokasi belum dihitung"
            }
          >
            {result &&
              [
                {
                  label: "BPJS",
                  percent: result.bpjs_percent,
                  amount: result.bpjs_estimated,
                  color: "bg-[#0B3A5B]",
                },
                {
                  label: "Asuransi",
                  percent: result.insurer_percent,
                  amount: result.insurer_estimated,
                  color: "bg-[#C51F53]",
                },
                {
                  label: "Pasien",
                  percent: result.patient_percent,
                  amount: result.patient_estimated,
                  color: "bg-[#E18C26]",
                },
              ]
                .filter((item) => item.percent > 0)
                .map((item) => (
                  <div
                    key={item.label}
                    className={`flex min-w-0 items-center justify-center truncate px-1 text-[8px] font-extrabold text-white ${item.color}`}
                    style={{ width: `${item.percent}%` }}
                    title={`${item.label}: ${formatRupiah(item.amount)}`}
                  >
                    {item.percent >= 10
                      ? `${item.percent.toFixed(0)}% (${formatRupiah(item.amount)})`
                      : ""}
                  </div>
                ))}
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <PayerAllocationCard
              label="Penjamin Primer"
              payer="BPJS Kesehatan"
              amount={result ? formatRupiah(result.bpjs_estimated) : "Belum dihitung"}
              status={
                bpjsClaim
                  ? subclaimStatusLabel(bpjsClaim.status)
                  : result?.is_applied
                    ? "Draft"
                    : "Menunggu simulasi"
              }
              tone="blue"
            />
            {!isNonCob && (
              <PayerAllocationCard
                label="Penjamin Sekunder"
                payer={insurerClaim?.payer_name ?? "Asuransi Swasta"}
                amount={
                  result
                    ? formatRupiah(result.insurer_estimated)
                    : "Belum dihitung"
                }
                status={
                  insurerClaim
                    ? subclaimStatusLabel(insurerClaim.status)
                    : result?.is_applied
                      ? "Draft"
                      : "Menunggu simulasi"
                }
                tone="rose"
              />
            )}
            <PayerAllocationCard
              label="Tanggungan Pribadi"
              payer="Tanggungan Pasien (Co-Pay)"
              amount={
                result
                  ? formatRupiah(result.patient_estimated)
                  : "Belum dihitung"
              }
              status={result ? "Terhitung" : "Menunggu simulasi"}
              tone="amber"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#EAF1FE] px-3 py-2 text-[9px]">
            <span className="font-bold text-[#34566E]">
              Total akumulasi pembagian biaya
            </span>
            <span className="font-extrabold text-[#0B3A5B]">
              {result ? formatRupiah(allocationTotal) : "Belum dihitung"}
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#E3EAF5] bg-white shadow-[0_4px_18px_rgba(11,58,91,0.04)]">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E3EAF5] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <TableProperties className="h-4 w-4 text-[#315D7A]" />
            <h2 className="text-xs font-extrabold text-[#0B3A5B]">
              Tabel Rincian Alokasi Komponen Biaya
            </h2>
          </div>
          <span className="text-[9px] text-[#71869A]">Mata uang: IDR (Rupiah)</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-[9px]">
            <thead className="bg-[#F7F9FC] text-[8px] font-extrabold uppercase tracking-wide text-[#71869A]">
              <tr>
                <th className="px-3 py-2.5">No</th>
                <th className="px-3 py-2.5">Komponen Tindakan &amp; Layanan Medis</th>
                <th className="px-3 py-2.5 text-right">Total Biaya RS</th>
                <th className="px-3 py-2.5 text-right text-[#154B6B]">Porsi BPJS</th>
                {!isNonCob && (
                  <th className="px-3 py-2.5 text-right text-[#C51F53]">
                    Porsi Asuransi
                  </th>
                )}
                <th className="px-3 py-2.5 text-right text-[#B45E10]">
                  Tanggungan Pasien
                </th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {caseData.bill_items.map((item, index) => (
                <tr key={item.id ?? `${item.category}-${item.description}`}>
                  <td className="px-3 py-3 text-[#71869A]">
                    {String(index + 1).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-[#34566E]">
                      {item.description}
                    </div>
                    <div className="mt-0.5 text-[8px] text-[#8293A2]">
                      {item.unit_info || item.category.replaceAll("_", " ")}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-[#34566E]">
                    {formatRupiah(item.subtotal)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-[#154B6B]">
                    {item.bpjs_portion === undefined
                      ? "—"
                      : formatRupiah(item.bpjs_portion)}
                  </td>
                  {!isNonCob && (
                    <td className="px-3 py-3 text-right font-bold text-[#C51F53]">
                      {item.insurer_portion === undefined
                        ? "—"
                        : formatRupiah(item.insurer_portion)}
                    </td>
                  )}
                  <td className="px-3 py-3 text-right font-bold text-[#B45E10]">
                    {item.patient_portion === undefined
                      ? "—"
                      : formatRupiah(item.patient_portion)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <StatusBadge
                      status={result?.is_applied ? "APPROVED" : "DRAFT"}
                    >
                      {result?.is_applied
                        ? "Diterapkan"
                        : result
                          ? "Menunggu penerapan"
                          : "Belum dihitung"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#EAF1FE] font-extrabold text-[#0B3A5B]">
              <tr>
                <td colSpan={2} className="px-3 py-3 text-[8px] uppercase">
                  Total akumulasi pembagian biaya
                </td>
                <td className="px-3 py-3 text-right">
                  {formatRupiah(total)}
                </td>
                <td className="px-3 py-3 text-right">
                  {result ? formatRupiah(result.bpjs_estimated) : "—"}
                </td>
                {!isNonCob && (
                  <td className="px-3 py-3 text-right">
                    {result ? formatRupiah(result.insurer_estimated) : "—"}
                  </td>
                )}
                <td className="px-3 py-3 text-right">
                  {result ? formatRupiah(result.patient_estimated) : "—"}
                </td>
                <td className="px-3 py-3 text-center">
                  {result
                    ? allocationTotal === result.total_bill
                      ? "Seimbang"
                      : "Periksa"
                    : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#E3EAF5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-[9px] leading-4 text-[#71869A]">
            Hasil simulasi adalah estimasi. Terapkan alokasi untuk memperbarui
            rincian invoice dan membuat subklaim draft melalui backend.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={!result || result.is_applied}
            isLoading={applying}
            onClick={() => void handleApply()}
          >
            Perbarui rincian invoice kasus
          </Button>
        </div>
      </section>
    </div>
  );
}
function ReadOnlyAmount({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#E3EAF5] bg-[#F8FAFD] px-3 py-2.5">
      <div className="text-[8px] font-bold uppercase tracking-wide text-[#8293A2]">
        {label}
      </div>
      <div
        className={`mt-1 text-[11px] font-extrabold ${
          accent ? "text-[#C51F53]" : "text-[#154B6B]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function FormulaRule({
  number,
  title,
  value,
  detail,
  tone,
}: {
  number: string;
  title: string;
  value: string;
  detail: string;
  tone: "blue" | "rose" | "amber";
}) {
  const tones = {
    blue: "bg-[#EAF1FE] text-[#154B6B] border-[#DDE8FA]",
    rose: "bg-[#FCEAF0] text-[#B91D4A] border-[#F6D6E0]",
    amber: "bg-[#FFF3DB] text-[#A65A0A] border-[#F7E5BC]",
  };
  return (
    <div className={`flex gap-2 rounded-lg border p-2.5 ${tones[tone]}`}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-current/10 text-[9px] font-extrabold">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <h3 className="text-[9px] font-extrabold">{title}</h3>
          <span className="text-[9px] font-extrabold">{value}</span>
        </div>
        <p className="mt-1 text-[8px] leading-3.5 opacity-80">{detail}</p>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#60798D]">
      <span className={`h-2 w-2 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function PayerAllocationCard({
  label,
  payer,
  amount,
  status,
  tone,
}: {
  label: string;
  payer: string;
  amount: string;
  status: string;
  tone: "blue" | "rose" | "amber";
}) {
  const tones = {
    blue: "border-t-[#154B6B]",
    rose: "border-t-[#C51F53]",
    amber: "border-t-[#E18C26]",
  };
  return (
    <div className={`rounded-lg border border-[#E3EAF5] border-t-[3px] bg-[#F8FAFD] p-3 ${tones[tone]}`}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="text-[8px] font-extrabold uppercase tracking-wide text-[#8293A2]">
          {label}
        </div>
        <StatusBadge status={status}>{status}</StatusBadge>
      </div>
      <div className="mt-1.5 text-[10px] font-bold text-[#34566E]">{payer}</div>
      <div className="mt-2 text-[11px] font-extrabold text-[#0B3A5B]">
        {amount}
      </div>
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
