export const EXPENSE_CATEGORIES = [
  'Kira',
  'Elektrik',
  'Su',
  'İnternet',
  'Personel',
  'Reklam',
  'Kargo',
  'Bakım / Onarım',
  'Vergi / Harç',
  'Ofis gideri',
  'Diğer',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PERSONNEL_EXPENSE_TYPES = ['Maaş', 'Prim', 'Avans', 'Yemek', 'Yol', 'Diğer'] as const;
export type PersonnelExpenseType = (typeof PERSONNEL_EXPENSE_TYPES)[number];

export const EXPENSE_PAYMENT_METHODS = ['Nakit', 'Banka', 'POS / Kart', 'Açık'] as const;
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

export const BANK_MOVEMENT_TYPES = [
  'Para girişi',
  'Para çıkışı',
  'Kasadan bankaya aktarım',
  'Bankadan kasaya aktarım',
  'Tedarikçi ödemesi',
  'Müşteri tahsilatı',
  'Gider ödemesi',
  'Düzeltme',
] as const;

export type BankMovementType = (typeof BANK_MOVEMENT_TYPES)[number];

export interface BankAccountInput {
  account_name: string;
  bank_name: string;
  iban?: string;
  branch_name?: string;
  account_no?: string;
  opening_balance?: number;
  is_active?: boolean;
  notes?: string;
}

export interface PosAccountInput {
  name: string;
  bank_account_id?: number | null;
  commission_rate?: number;
  block_days?: number;
  is_active?: boolean;
  notes?: string;
}

export interface BankMovementInput {
  bank_account_id: number;
  movement_type: BankMovementType;
  amount: number;
  direction: 'in' | 'out';
  description?: string;
  movement_date?: string;
  related_customer_id?: number;
  related_supplier_id?: number;
  related_expense_id?: number;
}

export interface ExpenseInput {
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  vat_rate?: number;
  payment_method: ExpensePaymentMethod;
  bank_account_id?: number | null;
  document_no?: string;
  notes?: string;
}

export interface PersonnelExpenseInput {
  personnel_name: string;
  expense_type: string;
  expense_date: string;
  amount: number;
  payment_method: ExpensePaymentMethod;
  bank_account_id?: number | null;
  description?: string;
}

export interface StatementFilter {
  date_from?: string;
  date_to?: string;
  movement_type?: string;
}

export interface ProfitLossFilter {
  date_from?: string;
  date_to?: string;
  group_id?: number;
  brand_id?: number;
  period?: 'daily' | 'weekly' | 'monthly' | 'custom';
}
