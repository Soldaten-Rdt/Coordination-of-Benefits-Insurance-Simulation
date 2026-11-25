import { apiClient } from "./client";
import type { ApiListResponse, ApiSuccessResponse } from "@/types/api";
import type {
  PatientDirectoryItem,
  PatientListQuery,
  PatientSummaryResponse,
} from "@/types/patient";

export async function getPatientSummary(): Promise<
  ApiSuccessResponse<PatientSummaryResponse>
> {
  return apiClient.get<ApiSuccessResponse<PatientSummaryResponse>>(
    "/api/patients/summary"
  );
}

export async function getPatients(
  params: PatientListQuery = {}
): Promise<ApiListResponse<PatientDirectoryItem>> {
  return apiClient.get<ApiListResponse<PatientDirectoryItem>>("/api/patients", {
    query: {
      q: params.q || undefined,
      payer:
        params.payer && params.payer !== "ALL" ? params.payer : undefined,
      tab: params.tab && params.tab !== "ALL" ? params.tab : undefined,
      page: params.page ?? 1,
      limit: params.limit ?? 5,
    },
  });
}
