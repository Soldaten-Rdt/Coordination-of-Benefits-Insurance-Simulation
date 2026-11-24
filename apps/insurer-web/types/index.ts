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

export interface ApiErrorBody {
  error?: { message?: string; code?: string };
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
  insurer_entity_name?: string;
  authority_limit?: number;
  organization?: string;
}

export type ClaimStatus = "SUBMITTED" | "IN_REVIEW" | "REVISION_REQUIRED" | "APPROVED" | "REJECTED" | string;

export interface ClaimRow {
  subclaim_code: string;
  case_number: string;
  hospital_name: string;
  patient_name: string;
  plan_name?: string;
  requested_amount: number;
  approved_amount?: number;
  non_cover_deduction?: number;
  status: ClaimStatus;
  created_at?: string;
}

export interface ActivityLog {
  subclaim_code?: string;
  case_number?: string;
  actor_name?: string;
  action?: string;
  notes?: string;
  created_at?: string;
}

export interface ClaimDetail extends Record<string, unknown> {
  subclaim_code: string;
  case_number: string;
  hospital_name: string;
  insurer_entity_name?: string;
  patient?: Record<string, unknown>;
  policy?: Record<string, unknown>;
  clinical?: Record<string, unknown>;
  cost_breakdown?: Record<string, unknown>;
  documents?: unknown;
  status: ClaimStatus;
  requested_amount: number;
  non_cover_deduction?: number;
  deduction_reason?: string;
  approved_amount?: number;
  patient_excess_impact?: number;
  reviewer_notes?: string;
  logs?: ActivityLog[];
}

export interface DashboardSummary {
  kpi: Record<string, number | string>;
  policy_parameters?: Record<string, unknown>;
  decision_distribution?: Record<string, number>;
  recent_claims?: ClaimRow[];
  recent_activity?: ActivityLog[];
}

export interface AdjudicationPreview {
  requested_amount: number;
  non_cover_deduction: number;
  recommended_approved_amount: number;
  initial_patient_excess: number;
  patient_additional_excess: number;
  final_patient_excess: number;
  coverage_percentage_of_total_bill: number;
}
