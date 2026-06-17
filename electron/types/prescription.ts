export const PRESCRIPTION_STATUSES = ['Aktif', 'Tamamlandı', 'İptal'] as const;
export const USAGE_TYPES = ['Uzak', 'Yakın', 'Progresif', 'Lens', 'Diğer'] as const;

export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];
export type UsageType = (typeof USAGE_TYPES)[number];

export const PRESCRIPTION_TYPES = ['Özel', 'SGK'] as const;
export const MEDULA_STATUSES = [
  'Hazırlanmadı',
  'Hazır',
  'Dışa Aktarıldı',
  'Manuel Yüklendi',
  'Hatalı',
] as const;

export type PrescriptionType = (typeof PRESCRIPTION_TYPES)[number];
export type MedulaStatus = (typeof MEDULA_STATUSES)[number];

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
  prescription_type?: PrescriptionType;
  e_report_no?: string;
  provision_no?: string;
  sgk_tracking_no?: string;
  institution_code?: string;
  doctor_registration_no?: string;
  patient_tc?: string;
  beneficiary_note?: string;
  medula_status?: MedulaStatus;
  medula_note?: string;
}

export interface PrescriptionListFilters {
  search?: string;
  customer_id?: number;
  date_from?: string;
  date_to?: string;
  status?: string;
}
