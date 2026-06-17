export interface SgkPrescriptionListFilters {
  date_from?: string;
  date_to?: string;
  prescription_type?: string;
  medula_status?: string;
  institution?: string;
  customer_search?: string;
  prescription_no?: string;
  provision_no?: string;
  invoice_ready?: boolean;
  has_missing_fields?: boolean;
}

export interface SgkPrescriptionRow {
  sale_id: number;
  sale_no: string;
  prescription_id: number;
  prescription_date?: string;
  customer_name?: string;
  customer_tc?: string;
  e_prescription_no?: string;
  provision_no?: string;
  institution?: string;
  prescription_type?: string;
  net_amount: number;
  patient_amount: number;
  institution_amount: number;
  contribution_amount: number;
  medula_status: string;
  missing_fields: string;
  missing_count: number;
  institution_receivable_id?: number;
  receivable_status?: string;
}

export interface MedulaEnterInfoInput {
  sale_id: number;
  provision_no?: string;
  sgk_tracking_no?: string;
  approval_status?: string;
  institution_amount?: number;
  patient_amount?: number;
  contribution_amount?: number;
  difference_fee?: number;
  medula_note?: string;
  operation_date?: string;
}

export const MEDULA_V2_DISCLAIMER =
  'Bu ekran Medula işlemleri için hazırlık ve takip amaçlıdır. Resmi işlemler kullanıcı tarafından ilgili sistemde yapılır.';
