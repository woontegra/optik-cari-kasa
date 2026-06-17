export const RETURN_TYPES = ['Para iadesi', 'Değişim', 'Cari hesaba alacak'] as const;
export type ReturnType = (typeof RETURN_TYPES)[number];

export const REFUND_METHODS = ['Nakit', 'Kredi Kartı', 'Havale/EFT', 'Cari'] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];

export const RETURN_STATUSES = ['Tamamlandı', 'İptal edildi'] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

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
