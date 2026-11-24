import { apiClient, apiRequest } from "./client";
import type {
  ApiActionResponse,
  ApiListResponse,
  ApiSuccessResponse,
} from "@/types/api";
import type {
  BankReconciliationRow,
  CaseDetail,
  CaseDocumentsResponse,
  CaseListItem,
  InvoiceData,
  PaymentCase,
  PaymentSummary,
  PatientOption,
  PatientProfile,
  SplitBillInput,
  SplitBillResult,
} from "@/types/case";

export interface CreateCasePayload {
  patient_id: number;
  care_type: "RAWAT_INAP" | "RAWAT_JALAN";
  room_name: string;
  entitled_class: string;
  dpjp_name: string;
  admission_date: string;
  discharge_date: string;
  diagnosis_icd10: string;
  diagnosis_desc: string;
  procedure_icd9: string;
  procedure_desc: string;
  ina_cbg_code: string;
  ina_cbg_tariff: number;
  simulation_mode: "COB" | "NON_COB";
  bill_items: Array<{
    category: "AKOMODASI" | "TINDAKAN" | "FARMASI" | "LABORATORIUM";
    description: string;
    unit_info: string;
    unit_price: number;
    quantity: number;
  }>;
}

export interface UploadedDocument {
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
}

export interface NotificationItem {
  id: number;
  case_id: number | null;
  subclaim_code: string;
  source_payer: string;
  category: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export async function listCases(query: {
  page?: number;
  limit?: number;
  tab?: string;
  status?: string;
  q?: string;
} = {}): Promise<ApiListResponse<CaseListItem>> {
  return apiClient.get<ApiListResponse<CaseListItem>>("/api/cases", {
    query,
  });
}

export async function listPatients(
  query: { page?: number; limit?: number; q?: string } = {}
): Promise<ApiListResponse<PatientOption>> {
  return apiClient.get<ApiListResponse<PatientOption>>("/api/patients", {
    query,
  });
}

export async function getPatient(
  patientId: number
): Promise<ApiSuccessResponse<PatientProfile>> {
  return apiClient.get<ApiSuccessResponse<PatientProfile>>(
    `/api/patients/${patientId}`
  );
}

export async function createCase(
  input: CreateCasePayload
): Promise<
  ApiSuccessResponse<{ id: number; case_number: string; workflow_step: number }>
> {
  return apiClient.post<
    ApiSuccessResponse<{ id: number; case_number: string; workflow_step: number }>
  >("/api/cases", input);
}

export async function getCase(
  caseId: number
): Promise<ApiSuccessResponse<CaseDetail>> {
  return apiClient.get<ApiSuccessResponse<CaseDetail>>(`/api/cases/${caseId}`);
}

export async function updateCase(
  caseId: number,
  input: {
    room_name?: string;
    entitled_class?: string;
    dpjp_name?: string;
    discharge_date?: string;
    diagnosis_desc?: string;
    procedure_desc?: string;
  }
): Promise<ApiActionResponse> {
  return apiClient.patch<ApiActionResponse>(`/api/cases/${caseId}`, input);
}

export async function updateDischargeChecklist(
  caseId: number,
  complete: boolean
): Promise<ApiSuccessResponse<{ complete: boolean }>> {
  return apiClient.patch<ApiSuccessResponse<{ complete: boolean }>>(
    `/api/cases/${caseId}/discharge-checklist`,
    { complete }
  );
}

export async function listCaseDocuments(
  caseId: number
): Promise<ApiSuccessResponse<CaseDocumentsResponse>> {
  return apiClient.get<ApiSuccessResponse<CaseDocumentsResponse>>(
    `/api/cases/${caseId}/documents`
  );
}

export async function uploadDocument(
  file: File
): Promise<ApiSuccessResponse<UploadedDocument>> {
  const body = new FormData();
  body.append("file", file);
  return apiRequest<ApiSuccessResponse<UploadedDocument>>(
    "/api/documents/upload",
    { method: "POST", body }
  );
}

export async function attachCaseDocument(
  caseId: number,
  document: {
    doc_type: string;
    target_payer: "BPJS" | "PRIVATE_INSURANCE" | "GENERAL";
    file_name: string;
    file_url: string;
    file_size: number;
    mime_type: string;
    is_mandatory: boolean;
    is_critical_discharge: boolean;
  }
): Promise<ApiActionResponse> {
  return apiClient.post(`/api/cases/${caseId}/documents`, {
    documents: [document],
  });
}

export async function deleteCaseDocument(
  caseId: number,
  documentId: number
): Promise<ApiActionResponse> {
  return apiClient.delete(`/api/cases/${caseId}/documents/${documentId}`);
}

export async function calculateSplitBill(
  caseId: number,
  input: SplitBillInput
): Promise<ApiSuccessResponse<SplitBillResult>> {
  return apiClient.post<ApiSuccessResponse<SplitBillResult>>(
    `/api/cases/${caseId}/split-bill/calculate`,
    input
  );
}

export async function getSplitBill(
  caseId: number
): Promise<
  ApiSuccessResponse<{
    simulation: SplitBillResult;
    bill_items: CaseDetail["bill_items"];
  }>
> {
  return apiClient.get<
    ApiSuccessResponse<{
      simulation: SplitBillResult;
      bill_items: CaseDetail["bill_items"];
    }>
  >(`/api/cases/${caseId}/split-bill`);
}

export async function applySplitBill(caseId: number): Promise<ApiActionResponse> {
  return apiClient.post(`/api/cases/${caseId}/split-bill/apply`);
}

export async function submitSubclaims(
  caseId: number
): Promise<
  ApiSuccessResponse<{
    case_id: number;
    case_number: string;
    submitted_subclaims: string[];
    workflow_step: number;
    coordination_status: string;
    message: string;
  }>
> {
  return apiClient.post<
    ApiSuccessResponse<{
      case_id: number;
      case_number: string;
      submitted_subclaims: string[];
      workflow_step: number;
      coordination_status: string;
      message: string;
    }>
  >(`/api/cases/${caseId}/subclaims/submit`);
}

export async function resubmitSubclaim(
  caseId: number,
  subclaimId: number,
  notes = ""
): Promise<ApiActionResponse> {
  return apiClient.post(
    `/api/cases/${caseId}/subclaims/${subclaimId}/resubmit`,
    { notes }
  );
}

export async function sendCaseMessage(
  caseId: number,
  subclaimId: number | null,
  message: string
): Promise<ApiSuccessResponse<{ id: number; created_at: string }>> {
  return apiClient.post<ApiSuccessResponse<{ id: number; created_at: string }>>(
    `/api/cases/${caseId}/messages`,
    { subclaim_id: subclaimId, message }
  );
}

export async function listNotifications(): Promise<
  ApiSuccessResponse<{ unread_count: number; notifications: NotificationItem[] }>
> {
  return apiClient.get<
    ApiSuccessResponse<{ unread_count: number; notifications: NotificationItem[] }>
  >("/api/notifications");
}

export async function markNotificationRead(
  notificationId: number
): Promise<ApiActionResponse> {
  return apiClient.patch(`/api/notifications/${notificationId}/read`);
}

export async function getInvoice(
  caseId: number
): Promise<ApiSuccessResponse<InvoiceData>> {
  return apiClient.get<ApiSuccessResponse<InvoiceData>>(
    `/api/cases/${caseId}/invoice`
  );
}

export async function sendPatientInvoice(
  caseId: number
): Promise<ApiActionResponse> {
  return apiClient.post(`/api/cases/${caseId}/invoice/send-patient`);
}

export async function recordPayment(
  caseId: number,
  input: {
    payer_source: "BPJS" | "PRIVATE_INSURANCE" | "PATIENT";
    paid_at?: string;
    payment_method: string;
    amount: number;
    bank_reference: string;
    subclaim_id?: number;
  }
): Promise<ApiSuccessResponse<{ id: number; transaction_code: string }>> {
  return apiClient.post<
    ApiSuccessResponse<{ id: number; transaction_code: string }>
  >(`/api/cases/${caseId}/payments`, input);
}

export async function listPayments(query: {
  page?: number;
  limit?: number;
  status?: string;
  payer?: string;
  q?: string;
} = {}): Promise<ApiListResponse<PaymentCase>> {
  return apiClient.get<ApiListResponse<PaymentCase>>("/api/payments", {
    query,
  });
}

export async function getPaymentSummary(): Promise<
  ApiSuccessResponse<PaymentSummary>
> {
  return apiClient.get<ApiSuccessResponse<PaymentSummary>>(
    "/api/payments/summary"
  );
}

export async function getBankReconciliation(query: {
  page?: number;
  limit?: number;
} = {}): Promise<ApiListResponse<BankReconciliationRow>> {
  return apiClient.get<ApiListResponse<BankReconciliationRow>>(
    "/api/payments/bank-reconciliation",
    { query }
  );
}
