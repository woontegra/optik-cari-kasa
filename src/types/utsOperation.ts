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
  supplier_name?: string;
  customer_name?: string;
  customer_tc?: string;
  sale_no?: string;
  sale_date?: string;
  batch_no?: string;
  document_no?: string;
  return_subtype?: string;
  uts_status: string;
  missing_fields: string[];
  has_warnings: boolean;
  warning_message?: string;
}

export interface UtsOperationListFilters {
  date_from?: string;
  date_to?: string;
  supplier_id?: number;
  customer_id?: number;
  stock_entry_batch_id?: number;
  sale_id?: number;
  serial_no?: string;
  lot_no?: string;
  ubb_code?: string;
  uts_product_no?: string;
  status?: string;
  search?: string;
  return_subtype?: string;
  missing_only?: boolean;
}

export interface UtsOperationHistoryFilters {
  date_from?: string;
  date_to?: string;
  operation_type?: string;
  status?: string;
  search?: string;
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

export const UTS_DISCLAIMER =
  'ÜTS işlemleri için hazırlık dosyası oluşturulur. Resmi ÜTS sistemine kullanıcı tarafından yüklenir. Bu sürümde otomatik resmi entegrasyon yoktur.';

export const UTS_AUTO_IMPORT_DISCLAIMER =
  'ÜTS Otomatik Giriş Hazırlığı: ÜTS\'den alınan Excel/CSV dosyası okunur ve mal kabul fişi taslağı oluşturulur. Gerçek otomatik ÜTS bağlantısı yapılmaz.';
