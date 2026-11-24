export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages?: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiListResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface ApiActionResponse {
  success: true;
  message: string;
  data?: unknown;
}

export interface ApiValidationDetail {
  field: string;
  message: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiValidationDetail[];
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

export type SimulationMode = "COB" | "NON_COB";

export type CoordinationStatus =
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "ACTION_REQUIRED"
  | "APPROVED"
  | "SETTLED";

export type SubclaimStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED"
  | "REJECTED";

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export type PayerType = "BPJS" | "PRIVATE_INSURANCE" | "PATIENT";
