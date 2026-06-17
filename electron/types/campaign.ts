export const CAMPAIGN_TYPES = [
  'Ürün bazlı',
  'Ana grup bazlı',
  'Alt grup bazlı',
  'Marka bazlı',
  'Model bazlı',
  'Sepet toplamı bazlı',
  'Müşteri kategorisi bazlı',
  'Manuel indirim kuponu',
] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_STATUSES = ['Taslak', 'Aktif', 'Süresi Doldu', 'Pasif', 'İptal'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const DISCOUNT_TYPES = ['Yüzde indirim', 'Sabit tutar indirimi', 'Birim fiyat sabitleme'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const TARGET_TYPES = [
  'PRODUCT',
  'PRODUCT_GROUP',
  'PRODUCT_SUBGROUP',
  'BRAND',
  'MODEL',
  'CUSTOMER_CATEGORY',
] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export interface CampaignTargetInput {
  target_type: TargetType;
  target_id?: number | null;
  target_value?: string | null;
}

export interface CampaignInput {
  name: string;
  code?: string | null;
  description?: string | null;
  campaign_type: CampaignType;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_sale_amount?: number | null;
  min_quantity?: number | null;
  start_date: string;
  end_date: string;
  priority?: number;
  usage_limit?: number | null;
  per_customer_limit?: number | null;
  status?: CampaignStatus;
  targets?: CampaignTargetInput[];
}

export interface SaleLineForCampaign {
  productId: number;
  quantity: number;
  unitPrice?: number;
}

export interface ManualDiscountInput {
  type: 'percent' | 'amount';
  value: number;
  description?: string;
}

export interface CalculateSaleInput {
  items: SaleLineForCampaign[];
  customerId?: number | null;
  campaignCode?: string | null;
  manualDiscount?: ManualDiscountInput | null;
}

export interface CalculatedSaleLine {
  productId: number;
  quantity: number;
  originalUnitPrice: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  campaignId: number | null;
  campaignName: string | null;
}

export interface CalculateSaleResult {
  items: CalculatedSaleLine[];
  subtotal: number;
  campaignDiscountTotal: number;
  manualDiscountAmount: number;
  netTotal: number;
  appliedCampaignIds: number[];
  warnings: string[];
}

export interface CampaignReportFilter {
  date_from?: string;
  date_to?: string;
  campaign_id?: number;
  group_id?: number;
  brand_id?: number;
  customer_id?: number;
}
