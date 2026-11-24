import type {
  ApiListResponse,
  ApiSuccessResponse,
  PaymentStatus,
  SimulationMode,
  SubclaimStatus,
} from "./api";

export interface PatientOption {
  id: number;
  patient_code: string;
  full_name: string;
  nik: string;
  coverages: Array<{
    payer_type: "BPJS" | "PRIVATE_INSURANCE";
    insurer_name: string;
  }>;
}

export interface PatientProfile {
  id: number;
  coverages: Array<{
    payer_type: "BPJS" | "PRIVATE_INSURANCE";
    insurer_name: string;
    status: string;
    valid_until: string | null;
  }>;
}

export interface CaseListItem {
  id: number;
  case_number: string;
  patient_id: number;
  patient_name: string;
  patient_code: string;
  care_type: string;
  room_name: string;
  diagnosis_icd10: string;
  total_hospital_bill: number;
  workflow_step: number;
  coordination_status: string;
  payment_status: PaymentStatus;
  simulation_mode: SimulationMode;
  created_at: string;
}

export interface CaseBillItem {
  id?: number;
  category: "AKOMODASI" | "TINDAKAN" | "FARMASI" | "LABORATORIUM";
  description: string;
  unit_info: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  bpjs_portion?: number;
  insurer_portion?: number;
  patient_portion?: number;
}

export interface CaseDocument {
  id: number;
  target_payer: "BPJS" | "PRIVATE_INSURANCE" | "GENERAL";
  doc_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  is_mandatory: boolean;
  is_critical_discharge: boolean;
  validation_status: string;
}

export interface CaseSubclaim {
  id: number;
  subclaim_code: string;
  payer_type: "BPJS" | "PRIVATE_INSURANCE";
  payer_name: string;
  requested_amount: number;
  approved_amount: number;
  status: SubclaimStatus;
}

export interface CaseCommunication {
  id: number;
  subclaim_id: number | null;
  sender_role: string;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface CaseActivity {
  id: number;
  title: string;
  description: string;
  created_at: string;
}

export interface CaseDetail {
  id: number;
  case_number: string;
  patient: {
    id: number;
    patient_code: string;
    full_name: string;
    nik: string;
  };
  care_type: string;
  room_name: string;
  entitled_class: string;
  dpjp_name: string;
  admission_date: string;
  discharge_date: string | null;
  diagnosis_icd10: string;
  diagnosis_desc: string;
  procedure_icd9: string;
  procedure_desc: string;
  ina_cbg_code: string;
  ina_cbg_tariff: number;
  total_hospital_bill: number;
  simulation_mode: SimulationMode;
  workflow_step: number;
  coordination_status: string;
  payment_status: PaymentStatus;
  discharge_documents_complete: boolean;
  bill_items: CaseBillItem[];
  subclaims: CaseSubclaim[];
  documents: CaseDocument[];
  split_bill: SplitBillResult | null;
  communications: CaseCommunication[];
  activities: CaseActivity[];
}

export interface SplitBillInput {
  preset_name: string;
  split_method: "PERCENTAGE" | "NOMINAL";
  bpjs_percent: number;
  insurer_percent: number;
  patient_percent: number;
  custom_bpjs_amount?: number;
  custom_insurer_amount?: number;
  custom_patient_amount?: number;
}

export interface SplitBillResult {
  preset_name: string;
  split_method: "PERCENTAGE" | "NOMINAL";
  bpjs_percent: number;
  insurer_percent: number;
  patient_percent: number;
  total_bill: number;
  reference_tariff: number;
  bpjs_estimated: number;
  insurer_estimated: number;
  patient_estimated: number;
  is_applied?: boolean;
}

export interface CaseDocumentsResponse {
  documents: CaseDocument[];
  missing_documents: Array<{ target_payer: string; doc_type: string }>;
  completeness: Record<string, { required: number; valid: number }>;
}

export interface InvoiceData {
  invoice_number: string;
  case_number: string;
  patient: {
    full_name: string;
    patient_code: string;
    room_info: string;
    admission_date: string;
  };
  summary: {
    total_hospital_bill: number;
    total_approved_payers: number;
    total_paid_received: number;
    remaining_open_balance: number;
  };
  bill_items: CaseBillItem[];
  allocations: Array<{
    payer_source: "BPJS" | "PRIVATE_INSURANCE" | "PATIENT";
    label: string;
    ratio_percent: number;
    amount: number;
    paid_amount: number;
    remaining_amount: number;
    status: string;
  }>;
  transactions: PaymentTransaction[];
}

export interface PaymentTransaction {
  id?: number;
  transaction_code: string;
  payer_source: "BPJS" | "PRIVATE_INSURANCE" | "PATIENT";
  payer_label?: string;
  payment_method: string;
  amount: number;
  bank_reference: string;
  paid_at: string;
  verification_status?: string;
}

export interface PaymentCase {
  case_id: number;
  case_number: string;
  patient_name: string;
  total_hospital_bill: number;
  payment_status: PaymentStatus;
  total_approved: number;
  total_paid: number;
  transactions: PaymentTransaction[];
}

export interface PaymentSummary {
  total_approved_payers: number;
  total_paid_received: number;
  waiting_payer_transfers: number;
  remaining_patient_excess: number;
}

export interface BankReconciliationRow extends PaymentTransaction {
  case_number: string;
  patient_name: string;
  verification_status: string;
}

export type CasesResponse = ApiListResponse<CaseListItem>;
export type PatientsResponse = ApiListResponse<PatientOption>;
export type CaseResponse = ApiSuccessResponse<CaseDetail>;
export type CaseDocumentsApiResponse = ApiSuccessResponse<CaseDocumentsResponse>;
export type InvoiceResponse = ApiSuccessResponse<InvoiceData>;
