export const UTS_OPERATION_TYPES = [
  'ALMA_BILDIRIMI',
  'VERME_BILDIRIMI',
  'IADE_BILDIRIMI',
  'RED_BILDIRIMI',
  'TITUBB_BILDIRIMI',
  'MANUEL_DUZELTME',
] as const;

export const UTS_OPERATION_STATUSES = [
  'Bekliyor',
  'Hazırlandı',
  'Dışa Aktarıldı',
  'ÜTS\'de İşlendi',
  'Hatalı',
  'İşlem Dışı',
  'İptal',
] as const;

export const UTS_IGNORE_REASONS = [
  'ÜTS kapsamı dışında',
  'Hatalı kayıt',
  'Manuel işlendi',
  'Seri no hatalı',
  'Ürün bilgisi eksik',
  'Diğer',
] as const;

export const UTS_RETURN_SUBTYPES = [
  'Müşteriden iade',
  'Tedarikçiye iade',
  'Alma kabul red',
  'Satış iptal',
  'Manuel düzeltme',
] as const;

export type UtsOperationType = (typeof UTS_OPERATION_TYPES)[number];
export type UtsOperationStatus = (typeof UTS_OPERATION_STATUSES)[number];

export interface UtsPendingRow {
  row_key: string;
  source_type: string;
  source_id: number;
  product_id: number;
  product_name: string;
  product_type?: string;
  barcode?: string;
  gtin?: string;
  ubb_code?: string;
  uts_product_no?: string;
  serial_no?: string;
  lot_no?: string;
  expiry_date?: string;
  quantity: number;
  supplier_id?: number;
  supplier_name?: string;
  customer_id?: number;
  customer_name?: string;
  customer_tc?: string;
  sale_id?: number;
  sale_no?: string;
  sale_date?: string;
  return_id?: number;
  prescription_no?: string;
  stock_entry_batch_id?: number;
  batch_no?: string;
  document_no?: string;
  entry_date?: string;
  operation_date?: string;
  return_subtype?: string;
  uts_status: string;
  missing_fields: string[];
  has_warnings: boolean;
  warning_message?: string;
  sale_cancelled?: boolean;
}

export interface UtsOperationListFilters {
  date_from?: string;
  date_to?: string;
  supplier_id?: number;
  customer_id?: number;
  stock_entry_batch_id?: number;
  sale_id?: number;
  product_type?: string;
  brand?: string;
  ubb_code?: string;
  uts_product_no?: string;
  serial_no?: string;
  lot_no?: string;
  status?: string;
  search?: string;
  return_subtype?: string;
  missing_only?: boolean;
}

export interface UtsCreateOperationInput {
  operation_type: UtsOperationType;
  row_keys: string[];
  notes?: string;
  force_with_warnings?: boolean;
}

export interface UtsMarkIgnoredInput {
  row_keys?: string[];
  operation_ids?: number[];
  reason: string;
  notes?: string;
}

export interface UtsOperationHistoryFilters {
  date_from?: string;
  date_to?: string;
  operation_type?: string;
  status?: string;
  search?: string;
  serial_no?: string;
  lot_no?: string;
}

export interface UtsImportRow {
  product_name?: string;
  barcode?: string;
  gtin?: string;
  ubb_code?: string;
  uts_product_no?: string;
  serial_no?: string;
  lot_no?: string;
  expiry_date?: string;
  quantity: number;
  matched_product_id?: number;
  matched_product_name?: string;
  match_status: 'matched' | 'unmatched' | 'ambiguous';
}

export interface UtsReportFilters {
  date_from?: string;
  date_to?: string;
  operation_type?: string;
  status?: string;
  product_type?: string;
  supplier_id?: number;
  customer_id?: number;
}
