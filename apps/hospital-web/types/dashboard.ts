import type {
  CoordinationStatus,
  PaymentStatus,
  SimulationMode,
} from "./api";

export type DashboardCaseTab =
  | "ALL"
  | "NEEDS_DOCUMENTS"
  | "IN_REVIEW"
  | "READY_RECONCILE";

export interface DashboardKpi {
  total_active_cases: number;
  needs_documents: number;
  claims_in_review: number;
  pending_payments: number;
}

export interface DashboardCostAllocation {
  total_billed: number;
  bpjs_portion: number;
  insurer_portion: number;
  patient_portion: number;
}

export interface DashboardRecentCase {
  id: number;
  case_number: string;
  patient_name: string;
  patient_code: string;
  care_type: string;
  room_name: string;
  total_hospital_bill: number;
  workflow_step: number;
  coordination_status: CoordinationStatus;
  payment_status: PaymentStatus;
  simulation_mode: SimulationMode;
  created_at: string;
}

export interface DashboardSummaryResponse {
  kpi: DashboardKpi;
  cost_allocation: DashboardCostAllocation;
  tab: string;
  recent_cases: DashboardRecentCase[];
}

export interface DashboardActionRequiredItem {
  type: "REVISION_REQUIRED" | "MISSING_DOCUMENTS" | "READY_RECONCILE";
  badge: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  case_id: number;
  case_number: string;
  patient_name: string;
  title: string;
  description: string;
  subclaim_id?: number;
  subclaim_code?: string;
  payer_name?: string;
  timestamp?: string;
  count?: number;
  approved_amount?: number;
  total_bill?: number;
}

export interface DashboardActivityItem {
  id: number;
  case_id?: number | null;
  patient_id?: number | null;
  case_number: string;
  patient_name: string;
  actor_name: string;
  actor_role: string;
  event_type: string;
  title: string;
  description: string;
  created_at: string;
}
