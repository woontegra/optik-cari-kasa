export const TITUBB_STATUSES = [
  'Bildirim Bekliyor',
  'Excel Hazırlandı',
  'ÜTS\'ye Yüklendi',
  'Hatalı',
  'İşlem Dışı',
] as const;

export type TitubbStatus = (typeof TITUBB_STATUSES)[number];

export interface TitubbListFilters {
  date_from?: string;
  date_to?: string;
  product_type?: string;
  supplier_id?: number;
  stock_entry_batch_id?: number;
  batch_no?: string;
  ubb_code?: string;
  uts_product_no?: string;
  barcode?: string;
  serial_no?: string;
  lot_no?: string;
  status?: string;
  missing_only?: boolean;
}

export interface TitubbPendingRow {
  row_key: string;
  product_id: number;
  stock_entry_batch_id?: number;
  stock_entry_item_id?: number;
  product_name: string;
  product_type: string;
  barcode?: string;
  gtin?: string;
  ubb_code?: string;
  uts_product_no?: string;
  serial_no?: string;
  lot_no?: string;
  expiry_date?: string;
  supplier_name?: string;
  batch_no?: string;
  document_no?: string;
  quantity: number;
  entry_date?: string;
  titubb_status: TitubbStatus;
  missing_fields: string[];
  has_warnings: boolean;
  previously_uploaded: boolean;
}

export interface TitubbValidateResult {
  rows: TitubbPendingRow[];
  validCount: number;
  invalidCount: number;
}

export interface TitubbExportInput {
  row_keys: string[];
  allow_incomplete?: boolean;
  notes?: string;
}

export interface TitubbMarkIgnoredInput {
  row_keys: string[];
  notes?: string;
}
