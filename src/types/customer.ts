export interface CustomerInput {
  full_name: string;
  tc_no?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  address?: string;
  city?: string;
  district?: string;
  notes?: string;
  kvkk_consent?: boolean;
  sms_permission?: boolean;
  email_permission?: boolean;
  is_active?: boolean;
}

export interface Customer extends CustomerInput {
  id: number;
  balance: number;
  last_sale_date: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerListFilters {
  search?: string;
  status?: string;
}

export interface CustomerQuickInput {
  full_name: string;
  phone?: string;
}

export const PRESCRIPTION_STATUSES = ['Aktif', 'Tamamlandı', 'İptal'] as const;
export const USAGE_TYPES = ['Uzak', 'Yakın', 'Progresif', 'Lens', 'Diğer'] as const;

export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];
export type UsageType = (typeof USAGE_TYPES)[number];

export interface PrescriptionInput {
  customer_id: number;
  e_prescription_no?: string;
  prescription_date?: string;
  doctor?: string;
  institution?: string;
  right_sph?: string;
  right_cyl?: string;
  right_ax?: string;
  left_sph?: string;
  left_cyl?: string;
  left_ax?: string;
  add_value?: string;
  pd?: string;
  lens_type?: string;
  usage_type?: UsageType;
  notes?: string;
  status?: PrescriptionStatus;
  prescription_type?: 'Özel' | 'SGK';
  e_report_no?: string;
  provision_no?: string;
  sgk_tracking_no?: string;
  institution_code?: string;
  doctor_registration_no?: string;
  patient_tc?: string;
  beneficiary_note?: string;
  medula_status?: string;
  medula_note?: string;
}

export interface Prescription extends PrescriptionInput {
  id: number;
  prescription_no: string | null;
  customer_name?: string;
  right_eye?: string;
  left_eye?: string;
  is_active?: number;
  created_at?: string;
  updated_at?: string;
}

export const PRESCRIPTION_TYPES = ['Özel', 'SGK'] as const;
export const MEDULA_STATUSES = [
  'Hazırlanmadı',
  'Hazır',
  'Dışa Aktarıldı',
  'Manuel Yüklendi',
  'Hatalı',
] as const;
export const UTS_STATUSES = ['Bekliyor', 'Hazır', 'İşlendi', 'Hatalı'] as const;

export interface PrescriptionListFilters {
  search?: string;
  customer_id?: number;
  date_from?: string;
  date_to?: string;
  status?: string;
}

export interface CustomerSale {
  id: number;
  sale_no: string;
  net_amount: number;
  sale_date: string;
  prescription_no?: string;
  e_prescription_no?: string;
}

export interface AccountMovement {
  id: number;
  movement_type: string;
  debit_amount: number;
  credit_amount: number;
  balance_after: number;
  description?: string;
  created_at: string;
  sale_no?: string;
}
