export type ReportType =
  | 'dayEnd'
  | 'sales'
  | 'cash'
  | 'stock'
  | 'customerAccount'
  | 'prescriptionMedula'
  | 'returnCancel'
  | 'purchase'
  | 'supplierAccount';

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

export interface PurchaseReportFilter extends DateRangeFilter {
  supplier_id?: number;
  document_type?: string;
  payment_status?: string;
  product_type?: string;
  brand?: string;
}

export interface SupplierAccountReportFilter {
  supplier_id?: number;
  search?: string;
}

export interface ExportExcelPayload {
  reportType: ReportType;
  filters?: Record<string, unknown>;
  sheetName?: string;
  rows: Record<string, unknown>[];
  fileName: string;
}

export interface PrintReportPayload {
  reportType: ReportType;
  title: string;
  dateRange?: string;
  summary: Array<{ label: string; value: string }>;
  columns: string[];
  rows: Record<string, unknown>[];
}
