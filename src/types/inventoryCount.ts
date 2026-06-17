export const COUNT_TYPES = ['Tam sayım', 'Kategori sayımı', 'Raf / konum sayımı', 'Ürün tipi sayımı'] as const;
export type CountType = (typeof COUNT_TYPES)[number];

export const COUNT_STATUSES = ['Devam Ediyor', 'Tamamlandı', 'Farklar İşlendi', 'İptal Edildi'] as const;
export type CountStatus = (typeof COUNT_STATUSES)[number];

export interface CreateCountInput {
  name: string;
  count_date: string;
  count_type: CountType;
  product_type_filter?: string;
  category_filter?: string;
  brand_filter?: string;
  location_filter?: string;
  notes?: string;
}

export interface CountSummary {
  totalKinds: number;
  totalExpected: number;
  totalCounted: number;
  missingKinds: number;
  excessKinds: number;
  unscannedKinds: number;
  unknownCount: number;
  lastScannedCode: string;
}

export interface CountItemRow {
  id: number;
  count_id: number;
  product_id: number;
  barcode?: string;
  product_name: string;
  product_type: string;
  brand?: string;
  model?: string;
  shelf_location?: string;
  expected_quantity: number;
  counted_quantity: number;
  difference_quantity: number;
  status: string;
  last_scanned_at?: string;
  notes?: string;
}

export interface UnknownScanRow {
  id: number;
  count_id: number;
  raw_code: string;
  normalized_code: string;
  barcode_type?: string;
  gtin?: string;
  serial_no?: string;
  lot_no?: string;
  expiry_date?: string;
  notes?: string;
  status: string;
  scanned_at: string;
  resolved_product_id?: number;
}

export interface CountDetail {
  id: number;
  count_no: string;
  name: string;
  count_date: string;
  count_type: string;
  product_type_filter?: string;
  category_filter?: string;
  brand_filter?: string;
  location_filter?: string;
  notes?: string;
  status: CountStatus;
  created_by_name?: string;
  scope_label?: string;
  completed_at?: string;
  adjusted_at?: string;
  items: CountItemRow[];
  unknowns: UnknownScanRow[];
  scans?: Record<string, unknown>[];
  summary: CountSummary;
}

export interface CountListRow {
  id: number;
  count_no: string;
  name: string;
  count_date: string;
  count_type: string;
  scope_label?: string;
  status: CountStatus;
  created_by_name?: string;
  total_kinds: number;
  missing_kinds: number;
  excess_kinds: number;
  unscanned_kinds: number;
}

export interface ScanCodeResult {
  success: boolean;
  message?: string;
  warning?: string;
  item?: CountItemRow;
  parsed?: Record<string, unknown>;
  summary?: CountSummary;
}

export function itemRowClass(status: string): string {
  switch (status) {
    case 'Eksik':
      return 'count-row-missing';
    case 'Fazla':
      return 'count-row-excess';
    case 'Eşit':
      return 'count-row-equal';
    case 'Sayılmadı':
      return 'count-row-unscanned';
    default:
      return '';
  }
}
