export interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ElectronAPI {
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<IpcResult<T>>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface LicenseInfo {
  id: number;
  license_key: string;
  is_active: number;
  activated_at: string;
  expires_at: string | null;
  company_name: string | null;
}

export interface Company {
  id: number;
  name: string;
  tax_number: string | null;
  tax_office: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

export const PRODUCT_TYPES = [
  'Çerçeve', 'Güneş Gözlüğü', 'Optik Cam', 'Cam', 'Kontakt Lens', 'Lens', 'Lens Solüsyonu', 'Aksesuar', 'Hizmet', 'Diğer',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const GENDER_OPTIONS = ['Kadın', 'Erkek', 'Unisex', 'Çocuk'] as const;

export interface FrameExtra {
  color?: string;
  size?: string;
  bridge_size?: string;
  temple_length?: string;
  gender?: string;
  material?: string;
}

export interface GlassExtra {
  sph?: string;
  cyl?: string;
  ax?: string;
  add?: string;
  diameter?: string;
  index?: string;
  coating?: string;
}

export interface LensExtra {
  sph?: string;
  cyl?: string;
  ax?: string;
  bc?: string;
  dia?: string;
  add?: string;
  color?: string;
  expiry_date?: string;
  lot_no?: string;
}

export type ProductExtraFields = FrameExtra | GlassExtra | LensExtra | Record<string, string>;

export interface ProductOpticalFields {
  group_id?: number | null;
  subgroup_id?: number | null;
  brand_id?: number | null;
  model_id?: number | null;
  color_id?: number | null;
  frame_type_id?: number | null;
  frame_material_id?: number | null;
  lens_type_id?: number | null;
  lens_material_id?: number | null;
  lens_coating_id?: number | null;
  contact_lens_type_id?: number | null;
  gender?: string;
  frame_color?: string;
  lens_color?: string;
  frame_shape?: string;
  eye_size?: string;
  bridge_size?: string;
  temple_length?: string;
  sph?: string;
  cyl?: string;
  axis?: string;
  addition?: string;
  diameter?: string;
  base_curve?: string;
  lens_index?: string;
  usage_period?: string;
  package_quantity?: string;
  season?: string;
  collection_name?: string;
  accessory_type?: string;
  material?: string;
  compatible_product?: string;
  label_name?: string;
  last_purchase_price?: number | null;
  average_cost?: number | null;
  is_polarized?: boolean;
  has_uv_protection?: boolean;
  has_blue_light_filter?: boolean;
  is_photochromic?: boolean;
  is_progressive?: boolean;
  group_name?: string;
  subgroup_name?: string;
  brand_lookup_name?: string;
  model_lookup_name?: string;
  color_name?: string;
  lens_type_name?: string;
  contact_lens_type_name?: string;
  lens_material_name?: string;
  lens_coating_name?: string;
}

export interface ProductInput extends ProductOpticalFields {
  barcode?: string;
  stock_code?: string;
  name: string;
  product_type: ProductType;
  brand?: string;
  model?: string;
  category?: string;
  purchase_price: number;
  sale_price: number;
  vat_rate?: number;
  stock_quantity: number;
  min_stock?: number;
  shelf_location?: string;
  description?: string;
  status?: string;
  extra_fields?: ProductExtraFields;
  ubb_code?: string;
  uts_product_no?: string;
  uts_barcode?: string;
  serial_no?: string;
  lot_no?: string;
  uts_expiry_date?: string;
  medical_device_class?: string;
  uts_tracking_required?: boolean;
  uts_status?: string;
  uts_note?: string;
}

export interface Product extends ProductInput {
  id: number;
  min_stock: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductListFilters {
  search?: string;
  product_type?: string;
  status?: string;
  group_id?: number;
  subgroup_id?: number;
  brand_id?: number;
  model_id?: number;
  color_id?: number;
  shelf_location?: string;
  critical_only?: boolean;
  uts_tracking_required?: boolean;
  no_barcode?: boolean;
}

export interface Customer {
  id: number;
  full_name: string;
  tc_no: string | null;
  phone: string | null;
  email: string | null;
  balance: number;
  last_sale_date: string | null;
  status?: string;
  birth_date?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  notes?: string | null;
  kvkk_consent?: boolean;
  sms_permission?: boolean;
  email_permission?: boolean;
  is_active?: number;
  customer_category?: string | null;
  photo_path?: string | null;
  second_phone?: string | null;
  whatsapp_phone?: string | null;
  institution_name?: string | null;
  institution_no?: string | null;
  occupation?: string | null;
  reference_source?: string | null;
  referred_by_customer_id?: number | null;
  referred_by_name?: string;
  last_visit_date?: string | null;
  next_control_date?: string | null;
  whatsapp_permission?: boolean;
  marketing_permission?: boolean;
  important_note?: string | null;
  risk_note?: string | null;
  is_vip?: boolean;
  last_prescription_no?: string;
  last_prescription_date?: string;
  next_appointment?: {
    id: number;
    appointment_date: string;
    appointment_time?: string;
    appointment_type: string;
  };
}

// Re-export from customer types
export type {
  CustomerInput,
  CustomerListFilters,
  CustomerQuickInput,
  PrescriptionInput,
  Prescription,
  PrescriptionListFilters,
  PrescriptionStatus,
  UsageType,
  CustomerSale,
  AccountMovement,
} from './customer';
export { PRESCRIPTION_STATUSES, USAGE_TYPES, PRESCRIPTION_TYPES, MEDULA_STATUSES, UTS_STATUSES } from './customer';

export interface CashMovement {
  id: number;
  movement_type: string;
  description: string | null;
  payment_type: string | null;
  amount: number;
  movement_date: string;
}

export interface DashboardStats {
  todaySales: number;
  todayCollection: number;
  openAccountTotal: number;
  cashTotal: number;
  criticalStock: number;
  activePrescriptions: number;
  todayReturns: number;
  cancelledToday: number;
  medulaPending: number;
  medulaMissingInfo?: number;
  sgkInvoiceReady?: number;
  institutionReceivableTotal?: number;
  institutionReceivableCount?: number;
  utsIncomplete: number;
  titubbPending?: number;
  pendingPurchaseCount?: number;
  pendingPurchaseTotal?: number;
  supplierDebtTotal?: number;
  bankBalanceTotal?: number;
  posPendingTotal?: number;
  todayExpense?: number;
  customerOpenTotal?: number;
  todayNetProfit?: number;
  activeCampaignCount?: number;
  todayCampaignDiscount?: number;
  todayAppointments?: number;
  upcomingControls?: number;
  debtorsCount?: number;
  lensRenewalSoon?: number;
  utsPendingReceive?: number;
  utsPendingGive?: number;
  utsErrorCount?: number;
  utsTitubbPending?: number;
  recentSales: unknown[];
  recentCashMovements: Array<{
    id: number;
    movement_type: string;
    amount: number;
    payment_type: string;
    customer_name?: string;
    sale_no?: string;
    movement_date: string;
  }>;
}

export interface CompleteSaleOptions {
  customerId?: number | null;
  prescriptionId?: number | null;
  paymentMode: PaymentType;
  paymentType?: CashPaymentType;
  paidAmount?: number;
  posAccountId?: number | null;
  campaignCode?: string | null;
  manualDiscount?: import('@/types/campaign').ManualDiscountInput | null;
  institutionPayment?: {
    patient_amount: number;
    institution_amount: number;
    contribution_amount?: number;
    difference_fee?: number;
    collected_patient_amount?: number;
    notes?: string;
  } | null;
}

export const PAYMENT_TYPES = ['Nakit', 'Kredi Kartı', 'Havale/EFT', 'Açık Hesap', 'Parçalı Ödeme'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const CASH_PAYMENT_TYPES = ['Nakit', 'Kredi Kartı', 'Havale/EFT'] as const;
export type CashPaymentType = (typeof CASH_PAYMENT_TYPES)[number];

export type {
  SaleListFilters,
  SaleListItem,
  SaleDetail,
  AddPaymentInput,
  CashSummary,
  CashMovementRow,
  CustomerAccountMovement,
} from './sales';
export { PAYMENT_STATUSES, SALE_STATUSES } from './sales';

export interface SaleLineItem {
  lineId: string;
  productId: number;
  name: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number;
  discountAmount?: number;
  campaignId?: number | null;
  campaignName?: string | null;
  total: number;
  stockQuantity: number;
  note?: string;
  serialNo?: string;
  lotNo?: string;
  expiryDate?: string;
}

export interface BackupRecord {
  id: number;
  file_path: string;
  file_size: number;
  backup_type: string;
  created_at: string;
}
