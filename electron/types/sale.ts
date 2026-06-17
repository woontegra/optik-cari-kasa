export const PAYMENT_TYPES = ['Nakit', 'Kredi Kartı', 'Havale/EFT', 'Açık Hesap', 'Parçalı Ödeme'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const CASH_PAYMENT_TYPES = ['Nakit', 'Kredi Kartı', 'Havale/EFT'] as const;
export type CashPaymentType = (typeof CASH_PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = ['Ödendi', 'Kısmi ödendi', 'Açık hesap', 'İptal'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SALE_STATUSES = ['Tamamlandı', 'İptal edildi'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const ACCOUNT_MOVEMENT_TYPES = ['Borç', 'Tahsilat', 'Satış', 'Düzeltme', 'İade'] as const;
export type AccountMovementType = (typeof ACCOUNT_MOVEMENT_TYPES)[number];

export interface SaleListFilters {
  date_from?: string;
  date_to?: string;
  customer_search?: string;
  payment_status?: string;
  payment_type?: string;
  status?: string;
}

export interface AddPaymentInput {
  saleId: number;
  amount: number;
  paymentType: CashPaymentType;
  description?: string;
  paymentDate?: string;
}

export interface AddCashIncomeInput {
  amount: number;
  paymentType: CashPaymentType;
  description?: string;
  customerId?: number;
}

export interface AddCashExpenseInput {
  amount: number;
  paymentType: CashPaymentType;
  description: string;
  category?: string;
}

export interface CancelSaleInput {
  saleId: number;
  reason: string;
  note?: string;
}
