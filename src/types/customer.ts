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
  customer_category?: string;
  second_phone?: string;
  whatsapp_phone?: string;
  institution_name?: string;
  institution_no?: string;
  occupation?: string;
  reference_source?: string;
  referred_by_customer_id?: number | null;
  last_visit_date?: string;
  next_control_date?: string;
  whatsapp_permission?: boolean;
  marketing_permission?: boolean;
  important_note?: string;
  risk_note?: string;
  is_vip?: boolean;
}

export interface Customer extends CustomerInput {
  id: number;
  balance: number;
  last_sale_date: string | null;
  status?: string;
  photo_path?: string | null;
  created_at?: string;
  updated_at?: string;
  referred_by_name?: string;
  last_prescription_no?: string;
  last_prescription_date?: string;
  next_appointment?: {
    id: number;
    appointment_date: string;
    appointment_time?: string;
    appointment_type: string;
  };
}

export interface CustomerListFilters {
  search?: string;
  status?: string;
  customer_category?: string;
  birthday_this_month?: boolean;
  upcoming_control?: boolean;
  lens_renewal_soon?: boolean;
  has_debt?: boolean;
  inactive_6_months?: boolean;
  marketing_permission?: boolean;
  whatsapp_permission?: boolean;
  sms_permission?: boolean;
  email_permission?: boolean;
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
  prescription_type?: 'Özel' | 'SGK' | 'Kurum' | 'Tamamlayıcı';
  e_report_no?: string;
  provision_no?: string;
  sgk_tracking_no?: string;
  institution_code?: string;
  doctor_registration_no?: string;
  doctor_branch?: string;
  patient_tc?: string;
  patient_card_no?: string;
  beneficiary_note?: string;
  examination_date?: string;
  rx_delivery_date?: string;
  medula_approval_status?: string;
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

export const PRESCRIPTION_TYPES = ['Özel', 'SGK', 'Kurum', 'Tamamlayıcı'] as const;
export const MEDULA_STATUSES = [
  'Hazırlanmadı',
  'Hazır',
  'Medula\'ya İşlendi',
  'Eksik Bilgi',
  'Hatalı',
  'İptal',
  'Faturaya Hazır',
  'Faturalandı',
  'Dışa Aktarıldı',
  'Manuel Yüklendi',
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
