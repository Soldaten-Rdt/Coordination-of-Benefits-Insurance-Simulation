export interface ApiEnvelope<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiList<T> {
  success: true;
  data: T[];
  meta: { page: number; limit: number; total: number; total_pages?: number };
}

export interface ApiFailure {
  success: false;
  error?: { code?: string; message?: string; details?: { field: string; message: string }[] };
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface PayerUser {
  id: number;
  email: string;
  full_name: string;
  role_title: string;
  role: string;
  branch_name?: string;
  organization?: string;
}

export interface ClaimRow {
  subclaim_code: string;
  case_number: string;
  hospital_name: string;
  patient_name: string;
  patient_nik?: string;
  care_class?: string;
  diagnosis_icd10?: string;
  procedure_icd9?: string;
  requested_amount: number;
  approved_amount?: number;
  status: ClaimStatus;
  sla_deadline?: string;
  sla_remaining_hours?: number;
  created_at?: string;
}

export type ClaimStatus = "SUBMITTED" | "IN_REVIEW" | "REVISION_REQUIRED" | "APPROVED" | "REJECTED" | string;

export interface ClaimDetail extends Record<string, unknown> {
  subclaim_code: string;
  case_number: string;
  hospital_name: string;
  patient?: Record<string, unknown>;
  coverage?: Record<string, unknown>;
  clinical?: Record<string, unknown>;
  financial?: Record<string, unknown>;
  documents?: unknown;
  status: ClaimStatus;
  requested_amount: number;
  approved_amount?: number;
  reviewer_notes?: string;
  compliance_checks?: Record<string, boolean>;
  logs?: ActivityLog[];
  sla_deadline?: string;
}

export interface ActivityLog {
  subclaim_code?: string;
  case_number?: string;
  actor_name?: string;
  action?: string;
  notes?: string;
  created_at?: string;
}

export interface DashboardSummary {
  kpi: Record<string, number | string>;
  decision_distribution?: Record<string, number>;
  priority_claims?: ClaimRow[];
  recent_claims?: ClaimRow[];
  recent_activity?: ActivityLog[];
  faskes_mitra?: { hospital_name: string; total_claims: number; approved_total: number }[];
}
