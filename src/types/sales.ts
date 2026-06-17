import type { SaleReturnHistory } from './returns';

export const PAYMENT_STATUSES = ['Ödendi', 'Kısmi ödendi', 'Açık hesap', 'İptal'] as const;
export const SALE_STATUSES = ['Tamamlandı', 'İptal edildi'] as const;
export const CASH_PAYMENT_TYPES = ['Nakit', 'Kredi Kartı', 'Havale/EFT'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type SaleStatus = (typeof SALE_STATUSES)[number];
export type CashPaymentType = (typeof CASH_PAYMENT_TYPES)[number];

export interface SaleListFilters {
  date_from?: string;
  date_to?: string;
  customer_search?: string;
  payment_status?: string;
  payment_type?: string;
  status?: string;
}

export interface SaleListItem {
  id: number;
  sale_no: string;
  sale_date: string;
  customer_name?: string;
  prescription_no?: string;
  e_prescription_no?: string;
  item_count: number;
  net_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  status: string;
}

export interface SaleItem {
  id: number;
  product_id?: number;
  barcode: string;
  product_name: string;
  product_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  returned_quantity?: number;
}

export interface SalePayment {
  id: number;
  amount: number;
  payment_type: string;
  description?: string;
  payment_date: string;
}

export interface SaleDetail {
  id: number;
  sale_no: string;
  sale_date: string;
  customer_id?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_tc?: string;
  prescription_no?: string;
  e_prescription_no?: string;
  doctor?: string;
  institution?: string;
  net_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  status: string;
  cancel_reason?: string;
  cancel_note?: string;
  cancelled_at?: string;
  items: SaleItem[];
  payments: SalePayment[];
  returns?: SaleReturnHistory[];
}

export interface AddPaymentInput {
  saleId: number;
  amount: number;
  paymentType: CashPaymentType;
  description?: string;
  paymentDate?: string;
}

export interface CashSummary {
  todayCash: number;
  todayCard: number;
  todayTransfer: number;
  todayCollection: number;
  totalCash: number;
}

export interface CashMovementRow {
  id: number;
  movement_date: string;
  movement_type: string;
  payment_type: string;
  customer_name?: string;
  description?: string;
  amount: number;
  sale_no?: string;
  category?: string;
}

export interface CustomerAccountMovement {
  id: number;
  movement_type: string;
  debit_amount: number;
  credit_amount: number;
  balance_after: number;
  description?: string;
  created_at: string;
  sale_no?: string;
}

export type { CancelSaleInput } from './returns';
export type { PrintDocument } from './returns';
