export type ReportTab =
  | 'dayEnd'
  | 'sales'
  | 'cash'
  | 'stock'
  | 'customerAccount'
  | 'prescriptionMedula'
  | 'returnCancel'
  | 'purchase'
  | 'supplierAccount'
  | 'utsOperations'
  | 'edonusum';

export type StockReportType =
  | 'current'
  | 'critical'
  | 'movements'
  | 'topSelling'
  | 'inactive'
  | 'countDifferences'
  | 'opticalDistribution'
  | 'lensExpiry'
  | 'opticalValues'
  | 'brandStock';

export interface DateRangeFilter {
  date_from?: string;
  date_to?: string;
}

export interface DayEndFilter {
  date?: string;
}

export interface SalesReportFilter extends DateRangeFilter {
  customer_search?: string;
  product_type?: string;
  product_search?: string;
  payment_type?: string;
  payment_status?: string;
  status?: string;
}

export interface CashReportFilter extends DateRangeFilter {
  payment_type?: string;
  movement_type?: string;
  customer_search?: string;
  description?: string;
}

export interface StockReportFilter {
  report_type?: StockReportType;
  product_type?: string;
  brand?: string;
  category?: string;
  critical_only?: boolean;
  status?: string;
  shelf_location?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  group_id?: number;
  subgroup_id?: number;
  brand_id?: number;
  model_id?: number;
  color_id?: number;
  lens_type_id?: number;
  lens_material_id?: number;
  lens_coating_id?: number;
  lot_no?: string;
  expiry_days_max?: number;
  sph_from?: string;
  sph_to?: string;
  cyl_from?: string;
  cyl_to?: string;
  axis_from?: string;
  axis_to?: string;
  add_from?: string;
  add_to?: string;
  diameter?: string;
  base_curve?: string;
}

export interface CustomerAccountReportFilter extends DateRangeFilter {
  customer_search?: string;
  balance_status?: 'debt' | 'credit' | 'zero' | 'all';
}

export interface PrescriptionMedulaReportFilter extends DateRangeFilter {
  prescription_type?: string;
  medula_status?: string;
  customer_search?: string;
  has_missing_fields?: boolean;
}

export interface ReturnCancelReportFilter extends DateRangeFilter {
  operation_type?: string;
  customer_search?: string;
  product_search?: string;
  reason?: string;
}

export interface PrintReportPayload {
  reportType: string;
  title: string;
  dateRange?: string;
  summary: Array<{ label: string; value: string }>;
  columns: string[];
  rows: Record<string, unknown>[];
}

export const REPORT_TAB_LABELS: Record<ReportTab, string> = {
  dayEnd: 'Gün Sonu',
  sales: 'Satış Raporu',
  cash: 'Kasa Raporu',
  stock: 'Stok Raporu',
  customerAccount: 'Müşteri Cari Raporu',
  prescriptionMedula: 'Reçete / Medula Raporu',
  returnCancel: 'İade / İptal Raporu',
  purchase: 'Alış Raporu',
  supplierAccount: 'Tedarikçi Cari Raporu',
  utsOperations: 'ÜTS Operasyon Raporu',
  edonusum: 'E-Dönüşüm Raporu',
};

export const STOCK_REPORT_TYPES: Array<{ value: StockReportType; label: string }> = [
  { value: 'current', label: 'Mevcut Stok' },
  { value: 'critical', label: 'Kritik Stok' },
  { value: 'movements', label: 'Stok Hareketleri' },
  { value: 'countDifferences', label: 'Sayım Farkları' },
  { value: 'topSelling', label: 'En Çok Satan' },
  { value: 'inactive', label: 'Hareketsiz Ürünler' },
  { value: 'opticalDistribution', label: 'Optik Ürün Dağılımı' },
  { value: 'lensExpiry', label: 'Lens SKT Yaklaşan' },
  { value: 'opticalValues', label: 'Cam Değerlerine Göre Stok' },
  { value: 'brandStock', label: 'Marka Bazlı Stok' },
];

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultRange30(): { date_from: string; date_to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) };
}

export function reportFileName(prefix: string): string {
  return `${prefix}-${todayIso()}.xlsx`;
}
