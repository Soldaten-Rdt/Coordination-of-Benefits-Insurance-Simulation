"use client";

import * as React from "react";
import {
  CheckCircle2,
  Download,
  FileUp,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { API_BASE_URL, ApiClientError } from "@/lib/api/client";
import {
  attachCaseDocument,
  deleteCaseDocument,
  getPatient,
  updateDischargeChecklist,
  uploadDocument,
} from "@/lib/api/cases";
import type { CaseDetail, CaseDocumentsResponse } from "@/types/case";
import { Panel, StatusBadge } from "./case-ui";

type Props = {
  caseData: CaseDetail;
  documentsData: CaseDocumentsResponse;
  onRefresh: () => Promise<void>;
};

const REQUIRED_DOCS = [
  { value: "SEP", label: "SEP", target: "BPJS" },
  { value: "RESUME_MEDIS", label: "Resume medis", target: "BPJS" },
  { value: "BILLING_RINCI", label: "Billing rinci", target: "BPJS" },
  { value: "GL_ASURANSI", label: "Guarantee letter asuransi", target: "PRIVATE_INSURANCE" },
  { value: "RINCIAN_BHP", label: "Rincian BHP", target: "PRIVATE_INSURANCE" },
] as const;

export function CaseDocumentsPanel({
  caseData,
  documentsData,
  onRefresh,
}: Props) {
  const { toast } = useToast();
  const [target, setTarget] = React.useState<"BPJS" | "PRIVATE_INSURANCE" | "GENERAL">("BPJS");
  const [docType, setDocType] = React.useState("SEP");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [privateCoverageAvailable, setPrivateCoverageAvailable] =
    React.useState(false);
  const [coverageLoading, setCoverageLoading] = React.useState(
    caseData.simulation_mode === "COB"
  );
  const [coverageError, setCoverageError] = React.useState("");
  const privateAllowed =
    caseData.simulation_mode === "COB" && privateCoverageAvailable;
  const options = REQUIRED_DOCS.filter(
    (item) =>
      item.target === target &&
      (item.target !== "PRIVATE_INSURANCE" || privateAllowed)
  );
  const isRequired = options.some((item) => item.value === docType);
  const docs = documentsData.documents ?? [];
  const requiredCount = docs.filter((doc) => doc.is_mandatory).length;
  const validRequiredCount = docs.filter(
    (doc) => doc.is_mandatory && doc.validation_status === "VALID"
  ).length;
  const missing = documentsData.missing_documents ?? [];

  React.useEffect(() => {
    if (caseData.simulation_mode !== "COB") return;
    let active = true;
    setCoverageLoading(true);
    getPatient(caseData.patient.id)
      .then((response) => {
        if (!active) return;
        const today = new Date().toISOString().slice(0, 10);
        setPrivateCoverageAvailable(
          response.data.coverages.some(
            (coverage) =>
              coverage.payer_type === "PRIVATE_INSURANCE" &&
              coverage.status === "ACTIVE" &&
              (!coverage.valid_until || coverage.valid_until.slice(0, 10) >= today)
          )
        );
      })
      .catch((cause: unknown) => {
        if (active) {
          setCoverageError(
            cause instanceof Error
              ? cause.message
              : "Kepesertaan asuransi swasta gagal diverifikasi."
          );
        }
      })
      .finally(() => {
        if (active) setCoverageLoading(false);
      });
    return () => {
      active = false;
    };
  }, [caseData.patient.id, caseData.simulation_mode]);

  const onTargetChange = (next: typeof target) => {
    setTarget(next);
    const firstOption = REQUIRED_DOCS.find(
      (item) => item.target === next
    )?.value;
    setDocType(firstOption ?? "LAINNYA");
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Ukuran file melebihi batas",
        description: "Ukuran maksimum dokumen adalah 10 MB.",
        variant: "error",
      });
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "jpg", "jpeg", "png"].includes(extension)) {
      toast({
        title: "Format file tidak didukung",
        description: "Unggah dokumen PDF, JPG, atau PNG.",
        variant: "error",
      });
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadDocument(file);
      await attachCaseDocument(caseData.id, {
        doc_type: docType,
        target_payer: target,
        ...uploaded.data,
        is_mandatory: isRequired,
        is_critical_discharge: docType === "RESUME_MEDIS",
      });
      setFile(null);
      const input = document.getElementById("claim-document-file");
      if (input instanceof HTMLInputElement) input.value = "";
      await onRefresh();
      toast({
        title: "Dokumen tersimpan",
        description: `${uploaded.data.file_name} berhasil dilampirkan ke kasus.`,
        variant: "success",
      });
    } catch (cause: unknown) {
      toast({
        title: "Dokumen gagal diunggah",
        description:
          cause instanceof ApiClientError
            ? cause.message
            : cause instanceof Error
              ? cause.message
              : "Terjadi kesalahan saat menyimpan dokumen.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const removeDocument = async (documentId: number) => {
    setDeletingId(documentId);
    try {
      await deleteCaseDocument(caseData.id, documentId);
      await onRefresh();
      toast({
        title: "Dokumen dihapus",
        variant: "success",
      });
    } catch (cause: unknown) {
      toast({
        title: "Dokumen gagal dihapus",
        description: cause instanceof Error ? cause.message : "Terjadi kesalahan.",
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const setDischargeComplete = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCompleting(true);
    try {
      await updateDischargeChecklist(caseData.id, event.target.checked);
      await onRefresh();
      toast({
        title: "Checklist kepulangan diperbarui",
        variant: "success",
      });
    } catch (cause: unknown) {
      event.target.checked = caseData.discharge_documents_complete;
      toast({
        title: "Checklist belum dapat diselesaikan",
        description: cause instanceof Error ? cause.message : "Periksa dokumen kritis.",
        variant: "error",
      });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="Dokumen wajib valid"
          value={`${validRequiredCount} / ${requiredCount}`}
          tone={missing.length === 0 ? "green" : "amber"}
        />
        <SummaryCard
          label="Dokumen yang masih kurang"
          value={String(missing.length)}
          tone={missing.length === 0 ? "green" : "red"}
        />
        <SummaryCard
          label="Checklist kepulangan"
          value={caseData.discharge_documents_complete ? "Lengkap" : "Belum lengkap"}
          tone={caseData.discharge_documents_complete ? "green" : "amber"}
        />
      </div>

      {missing.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-[11px] font-extrabold text-amber-900">
            Dokumen wajib belum lengkap
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((item, index) => (
              <span
                key={`${item.target_payer}-${item.doc_type}-${index}`}
                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200"
              >
                {item.doc_type.replaceAll("_", " ")} ·{" "}
                {item.target_payer === "PRIVATE_INSURANCE" ? "Asuransi" : item.target_payer}
              </span>
            ))}
          </div>
        </div>
      )}

      <Panel
        title="Unggah dokumen klaim"
        description="Format PDF, JPG, PNG dengan ukuran maksimum 10 MB."
      >
        <form onSubmit={handleUpload} className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-[#34566E]">
              Penjamin
            </label>
            <select
              value={target}
              onChange={(event) =>
                onTargetChange(event.target.value as typeof target)
              }
              className="h-10 w-full rounded-lg border border-[#DCE5F0] bg-white px-3 text-xs text-[#0B3A5B]"
            >
              <option value="BPJS">BPJS</option>
              {privateAllowed && (
                <option value="PRIVATE_INSURANCE">Asuransi swasta</option>
              )}
              <option value="GENERAL">Umum / lainnya</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-[#34566E]">
              Kategori dokumen
            </label>
            <select
              value={docType}
              onChange={(event) => setDocType(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#DCE5F0] bg-white px-3 text-xs text-[#0B3A5B]"
            >
              {options.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} · Wajib
                </option>
              ))}
              <option value="LAINNYA">Dokumen pendukung · Opsional</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="claim-document-file"
              className="mb-1.5 block text-[11px] font-bold text-[#34566E]"
            >
              Pilih berkas
            </label>
            <input
              id="claim-document-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
              className="block h-10 w-full rounded-lg border border-[#DCE5F0] bg-white text-[10px] text-[#34566E] file:mr-2 file:h-full file:border-0 file:bg-[#EEF3F9] file:px-3 file:text-[10px] file:font-bold"
            />
          </div>
          <Button
            type="submit"
            isLoading={busy}
            disabled={!file}
            leftIcon={<UploadCloud className="h-3.5 w-3.5" />}
          >
            Unggah
          </Button>
          <p className="text-[10px] text-[#74889A] lg:col-span-4">
            Dokumen wajib yang sudah ada tidak dihapus saat berkas baru diunggah.
            Hapus hanya tersedia untuk dokumen opsional.
          </p>
          {coverageLoading && (
            <p className="text-[10px] text-[#74889A] lg:col-span-4">
              Memeriksa kepesertaan asuransi swasta…
            </p>
          )}
          {coverageError && (
            <p role="alert" className="text-[10px] text-rose-700 lg:col-span-4">
              {coverageError} Opsi unggah ke asuransi swasta disembunyikan.
            </p>
          )}
        </form>
      </Panel>

      <Panel
        title="Daftar dokumen"
        description="Status validasi dan target penjamin mengikuti catatan backend."
        action={
          <span className="rounded-full bg-[#EAF0FB] px-2.5 py-1 text-[10px] font-bold text-[#315D7A]">
            {docs.length} berkas
          </span>
        }
      >
        {docs.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#71869A]">
            Belum ada dokumen pada kasus ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[690px] text-left text-[11px]">
              <thead className="text-[9px] uppercase tracking-wide text-[#8293A2]">
                <tr>
                  <th className="pb-2 pr-3">Nama dokumen</th>
                  <th className="px-2 pb-2">Kategori</th>
                  <th className="px-2 pb-2">Penjamin</th>
                  <th className="px-2 pb-2">Status</th>
                  <th className="px-2 pb-2 text-right">Ukuran</th>
                  <th className="pb-2 pl-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F6]">
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td className="py-3 pr-3">
                      <div className="max-w-[260px] truncate font-bold text-[#234B66]">
                        {doc.file_name || "Belum diunggah"}
                      </div>
                      <div className="mt-1 text-[9px] text-[#8293A2]">
                        {doc.is_mandatory ? "Wajib" : "Opsional"}
                        {doc.is_critical_discharge ? " · Kritis kepulangan" : ""}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-[#71869A]">
                      {doc.doc_type.replaceAll("_", " ")}
                    </td>
                    <td className="px-2 py-3 text-[#71869A]">
                      {doc.target_payer === "PRIVATE_INSURANCE"
                        ? "Asuransi swasta"
                        : doc.target_payer}
                    </td>
                    <td className="px-2 py-3">
                      <StatusBadge status={doc.validation_status}>
                        {doc.validation_status === "VALID"
                          ? "Valid"
                          : doc.validation_status === "MISSING"
                            ? "Belum ada"
                            : doc.validation_status}
                      </StatusBadge>
                    </td>
                    <td className="px-2 py-3 text-right text-[#71869A]">
                      {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—"}
                    </td>
                    <td className="py-3 pl-2 text-right">
                      <div className="flex justify-end gap-1">
                        {doc.file_url && (
                          <a
                            href={`${API_BASE_URL}${doc.file_url}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Pratinjau ${doc.file_name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#2B6385] hover:bg-[#EAF0FB]"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {!doc.is_mandatory && (
                          <button
                            type="button"
                            onClick={() => void removeDocument(doc.id)}
                            disabled={deletingId === doc.id}
                            aria-label={`Hapus ${doc.file_name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#A95665] hover:bg-rose-50 disabled:opacity-50"
                          >
                            {deletingId === doc.id ? (
                              <FileUp className="h-3.5 w-3.5 animate-pulse" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#E3EAF5] bg-[#F9FBFE] p-4 sm:flex-row sm:items-center">
        <div>
          <div className="text-xs font-extrabold text-[#234B66]">
            Checklist dokumen kritis sebelum pasien pulang
          </div>
          <div className="mt-1 text-[10px] text-[#71869A]">
            Resume medis dan berkas kritis harus valid sebelum checklist dinyatakan lengkap.
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-bold text-[#34566E]">
          <input
            type="checkbox"
            checked={caseData.discharge_documents_complete}
            disabled={completing}
            onChange={(event) => void setDischargeComplete(event)}
            className="h-4 w-4 accent-[#154B6B]"
          />
          <CheckCircle2 className="h-4 w-4 text-[#2D7890]" />
          Tandai lengkap
        </label>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red";
}) {
  const classes =
    tone === "green"
      ? "border-emerald-100 bg-emerald-50/70 text-emerald-800"
      : tone === "red"
        ? "border-rose-100 bg-rose-50/70 text-rose-800"
        : "border-amber-100 bg-amber-50/70 text-amber-900";
  return (
    <div className={`rounded-lg border px-4 py-3 ${classes}`}>
      <div className="text-[9px] font-bold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-1 text-sm font-extrabold">{value}</div>
    </div>
  );
}
