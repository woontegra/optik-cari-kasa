export const INSTITUTION_RECEIVABLE_STATUSES = [
  'Bekliyor',
  'Faturaya Hazır',
  'Faturalandı',
  'Tahsil Edildi',
  'Eksik Bilgi',
  'İptal',
] as const;

export type InstitutionReceivableStatus = (typeof INSTITUTION_RECEIVABLE_STATUSES)[number];

export interface InstitutionReceivableListFilters {
  date_from?: string;
  date_to?: string;
  institution?: string;
  status?: string;
  customer_search?: string;
  sale_no?: string;
}

export interface InstitutionPaymentInput {
  patient_amount: number;
  institution_amount: number;
  contribution_amount?: number;
  difference_fee?: number;
  collected_patient_amount?: number;
  notes?: string;
}
