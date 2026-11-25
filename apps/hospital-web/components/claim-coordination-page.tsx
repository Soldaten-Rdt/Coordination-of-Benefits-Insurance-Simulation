"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { peekApiCache } from "@/lib/api";
import { getCase, listCases } from "@/lib/api/cases";
import { getAccessToken } from "@/lib/auth/token";
import { useWorkspace } from "@/components/layout";
import type { ApiListResponse, ApiSuccessResponse } from "@/types/api";
import type { CaseDetail, CaseListItem } from "@/types/case";
import { SplitBillPanel } from "./case/split-bill-panel";
import { EmptyState, ErrorState, LoadingState } from "./case/case-ui";

export function ClaimCoordinationPage() {
  const { searchQuery } = useWorkspace();
  const initialCasesCache = peekApiCache<ApiListResponse<CaseListItem>>(
    "/api/cases",
    { page: 1, limit: 50, tab: "ALL", q: searchQuery }
  );
  const initialFirstId = initialCasesCache?.data?.[0]?.id ?? null;
  const initialDetailCache =
    initialFirstId !== null
      ? peekApiCache<ApiSuccessResponse<CaseDetail>>(
          `/api/cases/${initialFirstId}`
        )
      : undefined;

  const [cases, setCases] = React.useState<CaseListItem[]>(
    () => initialCasesCache?.data ?? []
  );
  const [selectedCaseId, setSelectedCaseId] = React.useState<number | null>(
    initialFirstId
  );
  const [caseData, setCaseData] = React.useState<CaseDetail | null>(
    () => initialDetailCache?.data ?? null
  );
  const [loadingCases, setLoadingCases] = React.useState(
    () => Boolean(getAccessToken()) && !initialCasesCache
  );
  const [loadingCase, setLoadingCase] = React.useState(false);
  const [casesError, setCasesError] = React.useState("");
  const [caseError, setCaseError] = React.useState("");
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!getAccessToken()) {
      setCasesError("Silakan masuk ke Hospital Workspace untuk melihat klaim.");
      setLoadingCases(false);
      return;
    }

    let active = true;
    const cached = peekApiCache<ApiListResponse<CaseListItem>>("/api/cases", {
      page: 1,
      limit: 50,
      tab: "ALL",
      q: searchQuery,
    });
    if (cached) {
      const availableCases = cached.data ?? [];
      setCases(availableCases);
      setSelectedCaseId((current) =>
        current && availableCases.some((item) => item.id === current)
          ? current
          : (availableCases[0]?.id ?? null)
      );
      setLoadingCases(false);
    } else {
      setLoadingCases(true);
    }
    setCasesError("");
    listCases({ page: 1, limit: 50, tab: "ALL", q: searchQuery })
      .then((response) => {
        if (!active) return;
        const availableCases = response.data ?? [];
        setCases(availableCases);
        setSelectedCaseId((current) =>
          current && availableCases.some((item) => item.id === current)
            ? current
            : (availableCases[0]?.id ?? null)
        );
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setCasesError(
          cause instanceof Error ? cause.message : "Daftar kasus gagal dimuat."
        );
      })
      .finally(() => {
        if (active) setLoadingCases(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey, searchQuery]);

  const refreshCase = React.useCallback(async () => {
    if (selectedCaseId === null) return;
    const response = await getCase(selectedCaseId);
    setCaseData(response.data);
    setCaseError("");
  }, [selectedCaseId]);

  React.useEffect(() => {
    if (selectedCaseId === null) {
      setCaseData(null);
      setLoadingCase(false);
      return;
    }
    if (!getAccessToken()) return;

    let active = true;
    const cachedDetail = peekApiCache<ApiSuccessResponse<CaseDetail>>(
      `/api/cases/${selectedCaseId}`
    );
    if (cachedDetail?.data) {
      setCaseData(cachedDetail.data);
      setLoadingCase(false);
    } else {
      setCaseData(null);
      setLoadingCase(true);
    }
    setCaseError("");
    getCase(selectedCaseId)
      .then((response) => {
        if (active) setCaseData(response.data);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setCaseError(
          cause instanceof Error ? cause.message : "Detail kasus gagal dimuat."
        );
      })
      .finally(() => {
        if (active) setLoadingCase(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCaseId]);

  if (loadingCases) return <LoadingState label="Memuat kasus untuk koordinasi..." />;
  if (casesError) {
    return (
      <ErrorState
        message={casesError}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }
  if (cases.length === 0) {
    return (
      <div className="rounded-xl border border-[#E3EAF5] bg-white">
        <EmptyState
          title="Belum ada kasus untuk dikoordinasikan"
          description="Buat kasus perawatan terlebih dahulu, lalu pilih kasus di sini untuk menghitung pembagian biaya."
        />
        <div className="pb-6 text-center">
          <Link
            href="/cases/new"
            className="text-xs font-bold text-[#154B6B] hover:underline"
          >
            Buat kasus perawatan
          </Link>
        </div>
      </div>
    );
  }

  const selectedCase = cases.find((item) => item.id === selectedCaseId);

  return (
    <div className="space-y-4">
      <header className="flex flex-col justify-between gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#668098]">
            Hospital Ops / Koordinasi Klaim
          </div>
          <h1 className="mt-1 text-[22px] font-extrabold tracking-tight text-[#0B3A5B]">
            Simulasi Pembagian Biaya (Split Bill Calculator)
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#5B6B7B]">
            Hitung dan tinjau estimasi pembagian biaya antara BPJS Kesehatan,
            asuransi swasta, dan pasien sesuai skenario CoB/KAPJ.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Printer className="h-3.5 w-3.5" />}
            onClick={() => window.print()}
          >
            Export rekap biaya (PDF)
          </Button>
          <Button
            type="submit"
            form="split-bill-calculation-form"
            size="sm"
          >
            Simpan simulasi
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border border-[#E3EAF5] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[9px] font-extrabold uppercase tracking-wide text-[#71869A]">
            Kasus aktif
          </div>
          <div className="mt-1 truncate text-xs font-extrabold text-[#154B6B]">
            {selectedCase?.case_number ?? "Pilih kasus"}
            {caseData
              ? ` · ${caseData.care_type === "RAWAT_JALAN" ? "Rawat Jalan" : "Rawat Inap"} · ${caseData.patient.full_name}`
              : selectedCase
                ? ` · ${selectedCase.patient_name}`
                : ""}
          </div>
        </div>
        <label className="w-full sm:max-w-[360px]">
          <span className="sr-only">Pilih kasus untuk koordinasi klaim</span>
          <select
            aria-label="Pilih kasus untuk koordinasi klaim"
            value={selectedCaseId ?? ""}
            onChange={(event) => setSelectedCaseId(Number(event.target.value))}
            className="h-9 w-full rounded-lg border border-[#DCE5F0] bg-white px-3 text-[11px] font-semibold text-[#34566E] outline-none focus:border-[#3B789F] focus:ring-2 focus:ring-[#3B789F]/15"
          >
            {cases.map((item) => (
              <option key={item.id} value={item.id}>
                {item.case_number} · {item.patient_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadingCase ? (
        <LoadingState label="Memuat detail tagihan kasus..." />
      ) : caseError ? (
        <div className="rounded-xl border border-[#E3EAF5] bg-white">
          <ErrorState message={caseError} onRetry={() => void refreshCase()} />
        </div>
      ) : caseData ? (
        <SplitBillPanel
          key={caseData.id}
          caseData={caseData}
          onRefresh={refreshCase}
        />
      ) : null}
    </div>
  );
}
