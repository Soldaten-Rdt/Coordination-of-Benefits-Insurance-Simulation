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

export interface VerifyBpjsResponse {
  bpjs_number: string;
  is_active: boolean;
  participant_type: string;
  care_class: string;
  primary_faskes: string;
  valid_until: string;
  simulation: boolean;
}

export interface CreatePatientPrivateCoverageInput {
  payer_tier?: "SECONDARY" | "TERTIARY";
  insurer_name: string;
  policy_number: string;
  plan_name: string;
  annual_limit: number;
  room_daily_limit: number;
  valid_until: string;
}

export interface CreatePatientRequest {
  full_name: string;
  nik: string;
  birth_date: string;
  gender: "L" | "P";
  phone: string;
  email?: string;
  address: string;
  bpjs_number?: string;
  care_class?: string;
  primary_faskes?: string;
  private_coverages?: CreatePatientPrivateCoverageInput[];
}

export interface CreatePatientResponse {
  id: number;
  patient_code: string;
  full_name: string;
}

export interface PatientDetailCoverage {
  id: number;
  payer_tier: "PRIMARY" | "SECONDARY" | "TERTIARY" | string;
  payer_type: Exclude<PayerType, "PATIENT">;
  insurer_name: string;
  card_or_policy_number: string;
  care_class?: string;
  primary_faskes?: string;
  plan_name?: string;
  annual_limit?: number;
  remaining_limit?: number;
  room_daily_limit?: number;
  status?: "ACTIVE" | "INACTIVE" | "EXPIRED" | string;
  valid_until?: string;
}

export interface PatientDetailCase {
  id: number;
  case_number: string;
  care_type: "RAWAT_INAP" | "RAWAT_JALAN" | string;
  total_hospital_bill: number;
  workflow_step: number;
  payment_status: PaymentStatus;
  created_at: string;
}

export interface PatientDetailActivity {
  event_type: string;
  title: string;
  description: string;
  created_at: string;
}

export interface PatientDetailResponse {
  id: number;
  patient_code: string;
  nik: string;
  full_name: string;
  birth_date: string;
  gender: "L" | "P" | string;
  phone: string;
  email: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  coverages: PatientDetailCoverage[];
  cases: PatientDetailCase[];
  lifetime_claimed: number;
  activities: PatientDetailActivity[];
}

export interface UpdatePatientRequest {
  phone?: string;
  email?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface UpdatePatientCoverageItem {
  id: number;
  annual_limit: number;
  remaining_limit: number;
  room_daily_limit: number;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | string;
  valid_until?: string;
}

export interface UpdatePatientCoveragesRequest {
  coverages: UpdatePatientCoverageItem[];
}
