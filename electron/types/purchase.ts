export const PURCHASE_DOCUMENT_TYPES = [
  'Alış Faturası',
  'Alış İrsaliyesi',
  'Fatura + İrsaliye',
  'Devir / Açılış Stok Girişi',
] as const;

export type PurchaseDocumentType = (typeof PURCHASE_DOCUMENT_TYPES)[number];

export const PURCHASE_PAYMENT_STATUSES = [
  'Ödendi',
  'Kısmi ödendi',
  'Ödeme bekliyor',
  'İptal',
] as const;

export type PurchasePaymentStatus = (typeof PURCHASE_PAYMENT_STATUSES)[number];

export const SUPPLIER_PAYMENT_TYPES = [
  'Nakit',
  'Kredi Kartı',
  'Havale/EFT',
  'Çek',
  'Senet',
] as const;

export type SupplierPaymentType = (typeof SUPPLIER_PAYMENT_TYPES)[number];

export interface PurchaseLineInput {
  product_id: number;
  barcode?: string;
  quantity: number;
  purchase_price: number;
  vat_rate?: number;
  sale_price?: number;
  shelf_location?: string;
}

export interface CreatePurchaseInput {
  document_no?: string;
  document_type: PurchaseDocumentType;
  supplier_id: number;
  document_date: string;
  due_date?: string;
  notes?: string;
  source_type?: 'direct' | 'stock_entry';
  stock_entry_batch_id?: number | null;
  items: PurchaseLineInput[];
  initial_payment?: {
    amount: number;
    payment_type: SupplierPaymentType;
    description?: string;
  };
}

export interface PurchaseListFilters {
  date_from?: string;
  date_to?: string;
  supplier_id?: number;
  document_type?: string;
  payment_status?: string;
  status?: string;
  search?: string;
}

export interface SupplierPaymentInput {
  supplier_id: number;
  amount: number;
  payment_type: SupplierPaymentType;
  payment_date: string;
  description?: string;
  purchase_document_id?: number | null;
  bank_account_id?: number | null;
}

export interface CancelPurchaseInput {
  cancel_reason: string;
}
