import { apiClient } from "./client";
import type { ApiListResponse, ApiSuccessResponse } from "@/types/api";
import type {
  CreatePatientRequest,
  CreatePatientResponse,
  PatientDetailResponse,
  PatientDirectoryItem,
  PatientListQuery,
  PatientSummaryResponse,
  UpdatePatientCoveragesRequest,
  UpdatePatientRequest,
  VerifyBpjsResponse,
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

export async function verifyBpjsNumber(
  bpjsNumber: string
): Promise<ApiSuccessResponse<VerifyBpjsResponse>> {
  return apiClient.post<ApiSuccessResponse<VerifyBpjsResponse>>(
    "/api/patients/verify-bpjs",
    { bpjs_number: bpjsNumber }
  );
}

export async function createPatient(
  payload: CreatePatientRequest
): Promise<ApiSuccessResponse<CreatePatientResponse>> {
  return apiClient.post<ApiSuccessResponse<CreatePatientResponse>>(
    "/api/patients",
    payload
  );
}

export async function getPatientDetail(
  id: string | number
): Promise<ApiSuccessResponse<PatientDetailResponse>> {
  return apiClient.get<ApiSuccessResponse<PatientDetailResponse>>(
    `/api/patients/${id}`
  );
}

export async function updatePatientProfile(
  id: string | number,
  payload: UpdatePatientRequest
): Promise<ApiSuccessResponse<{ message?: string }> & { message?: string }> {
  return apiClient.patch<
    ApiSuccessResponse<{ message?: string }> & { message?: string }
  >(`/api/patients/${id}`, payload);
}

export async function updatePatientCoverages(
  id: string | number,
  payload: UpdatePatientCoveragesRequest
): Promise<ApiSuccessResponse<{ message?: string }> & { message?: string }> {
  return apiClient.patch<
    ApiSuccessResponse<{ message?: string }> & { message?: string }
  >(`/api/patients/${id}/coverages`, payload);
}
