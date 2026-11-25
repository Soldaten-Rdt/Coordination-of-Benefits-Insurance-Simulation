import type { CoordinationStatus, PayerType, PaymentStatus } from "./api";

export type PatientDirectoryTab =
  | "ALL"
  | "ACTIVE_CASE"
  | "ACTION_REQUIRED"
  | "UNPAID";

export type PatientPayerFilter = "ALL" | "BPJS" | "PRIVATE_INSURANCE";

export interface PatientCoverageItem {
  id: number;
  payer_tier: "PRIMARY" | "SECONDARY" | string;
  payer_type: Exclude<PayerType, "PATIENT">;
  insurer_name: string;
  card_or_policy_number: string;
  care_class?: string;
  annual_limit?: number;
  remaining_limit?: number;
}

export interface PatientLatestCase {
  id: number;
  case_number: string;
  care_type_label: string;
  coordination_status: CoordinationStatus;
  payment_status: PaymentStatus;
}

export interface PatientDirectoryItem {
  id: number;
  patient_code: string;
  full_name: string;
  nik: string;
  age: number;
  gender: "L" | "P" | string;
  coverages: PatientCoverageItem[];
  cob_scheme_label: string;
  total_cases: number;
  latest_case?: PatientLatestCase | null;
}

export interface PatientSummaryResponse {
  total_patients: number;
  active_cases: number;
  cob_action_required: number;
  waiting_payment: number;
}

export interface PatientListQuery {
  q?: string;
  payer?: PatientPayerFilter;
  tab?: PatientDirectoryTab;
  page?: number;
  limit?: number;
}
