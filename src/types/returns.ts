export const RETURN_TYPES = ['Para iadesi', 'Değişim', 'Cari hesaba alacak'] as const;
export const REFUND_METHODS = ['Nakit', 'Kredi Kartı', 'Havale/EFT', 'Cari'] as const;

export type ReturnType = (typeof RETURN_TYPES)[number];
export type RefundMethod = (typeof REFUND_METHODS)[number];

export interface ReturnItemInput {
  saleItemId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface ExchangeItemInput {
  productId: number;
  barcode?: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateReturnInput {
  saleId: number;
  items: ReturnItemInput[];
  returnType: ReturnType;
  refundMethod?: RefundMethod;
  reason: string;
  notes?: string;
  exchangeItems?: ExchangeItemInput[];
}

export interface ReturnListFilters {
  date_from?: string;
  date_to?: string;
  customer_search?: string;
  return_type?: string;
  sale_no?: string;
}

export interface ReturnListItem {
  id: number;
  return_no: string;
  sale_no?: string;
  customer_name?: string;
  return_type: string;
  total_amount: number;
  reason?: string;
  status: string;
  created_at: string;
}

export interface ReturnDetail {
  id: number;
  return_no: string;
  sale_no?: string;
  customer_name?: string;
  customer_phone?: string;
  return_type: string;
  refund_method?: string;
  total_amount: number;
  exchange_diff?: number;
  reason?: string;
  notes?: string;
  status: string;
  created_at: string;
  items: Array<{
    id: number;
    product_name: string;
    product_type?: string;
    barcode?: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
  }>;
  exchangeItems?: Array<{
    id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
  }>;
}

export interface SaleReturnHistory {
  id: number;
  return_no: string;
  return_type: string;
  total_amount: number;
  reason?: string;
  status: string;
  created_at: string;
  product_name?: string;
  quantity?: number;
  item_total?: number;
}

export interface SaleSearchResult {
  id: number;
  sale_no: string;
  sale_date: string;
  customer_name?: string;
  customer_phone?: string;
  net_amount: number;
  status: string;
}

export interface PrintDocument {
  html: string;
  title: string;
}

export interface CancelSaleInput {
  saleId: number;
  reason: string;
  note?: string;
}
