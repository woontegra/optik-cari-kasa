export const PRESCRIPTION_TYPES = ['Özel', 'SGK'] as const;
export const MEDULA_STATUSES = [
  'Hazırlanmadı',
  'Hazır',
  'Dışa Aktarıldı',
  'Manuel Yüklendi',
  'Hatalı',
] as const;
export const UTS_STATUSES = ['Bekliyor', 'Hazır', 'İşlendi', 'Hatalı'] as const;

export type PrescriptionType = (typeof PRESCRIPTION_TYPES)[number];
export type MedulaStatus = (typeof MEDULA_STATUSES)[number];
export type UtsStatus = (typeof UTS_STATUSES)[number];

export interface MedulaListFilters {
  date_from?: string;
  date_to?: string;
  customer_search?: string;
  prescription_no?: string;
  medula_status?: string;
  has_missing_fields?: boolean;
  prescription_type?: string;
}

export interface MedulaRecordListItem {
  sale_id: number;
  sale_no: string;
  sale_date: string;
  customer_name?: string;
  customer_tc?: string;
  prescription_id: number;
  prescription_no?: string;
  e_prescription_no?: string;
  prescription_type?: string;
  right_eye?: string;
  left_eye?: string;
  item_count: number;
  missing_fields?: string;
  missing_count: number;
  medula_status: string;
}

export interface MedulaValidationResult {
  saleId: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface UtsListFilters {
  search?: string;
  ubb_code?: string;
  uts_product_no?: string;
  serial_no?: string;
  lot_no?: string;
  uts_status?: string;
  date_from?: string;
  date_to?: string;
}

export interface UtsRecord {
  product_id: number;
  product_name: string;
  product_type: string;
  barcode?: string;
  ubb_code?: string;
  uts_product_no?: string;
  serial_no?: string;
  lot_no?: string;
  uts_expiry_date?: string;
  stock_quantity: number;
  uts_status: string;
  uts_note?: string;
  last_sale_date?: string;
  sale_no?: string;
  customer_name?: string;
  customer_tc?: string;
  prescription_no?: string;
}
