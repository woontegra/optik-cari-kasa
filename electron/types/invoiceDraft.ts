export const EINVOICE_PROVIDERS = ['Paraşüt', 'BirFatura', 'Logo', 'Uyumsoft', 'QNB', 'Diğer'] as const;
export const EINVOICE_USAGE_MODES = ['Manuel aktarım', 'Excel aktarım', 'XML aktarım', 'API entegrasyonu ileride'] as const;
export const EINVOICE_SCENARIOS = ['Temel', 'Ticari', 'E-Arşiv'] as const;

export const INVOICE_DOCUMENT_TYPES = [
  'E-Arşiv',
  'E-Fatura',
  'Kağıt Fatura Notu',
  'Bilgi Fişi',
  'E-İrsaliye',
  'Alış Faturası',
  'Alış İrsaliyesi',
] as const;

export const INVOICE_DRAFT_STATUSES = [
  'Taslak',
  'Hazır',
  'Eksik Bilgi',
  'Dışa Aktarıldı',
  'Resmi Sisteme Girildi',
  'Gönderildi İşaretlendi',
  'İptal',
  'Hatalı',
] as const;

export const INVOICE_SOURCE_TYPES = ['SALE', 'PURCHASE', 'SGK_BATCH', 'STOCK_ENTRY'] as const;

export type InvoiceDocumentType = (typeof INVOICE_DOCUMENT_TYPES)[number];
export type InvoiceDraftStatus = (typeof INVOICE_DRAFT_STATUSES)[number];
export type InvoiceSourceType = (typeof INVOICE_SOURCE_TYPES)[number];

export interface EinvoiceSettingsInput {
  provider_name?: string;
  usage_mode?: string;
  company_title?: string;
  tax_no?: string;
  tax_office?: string;
  is_einvoice_taxpayer?: boolean;
  default_scenario?: string;
  default_vat_rate?: number;
  default_note?: string;
  api_enabled?: boolean;
  api_base_url?: string;
  api_key_masked?: string;
}

export interface InvoiceDraftListFilters {
  date_from?: string;
  date_to?: string;
  document_type?: string;
  status?: string;
  source_type?: string;
  customer_search?: string;
  supplier_search?: string;
}

export interface CreateFromSaleInput {
  sale_id: number;
  document_type: string;
  force?: boolean;
  notes?: string;
}

export interface CreateFromPurchaseInput {
  purchase_document_id: number;
  document_type: string;
  notes?: string;
}

export interface CreateFromSgkBatchInput {
  sgk_invoice_batch_id: number;
  document_type?: string;
  notes?: string;
}

export interface CreateFromStockEntryInput {
  stock_entry_batch_id: number;
  notes?: string;
}

export interface MarkOfficialInput {
  draft_id: number;
  official_invoice_no?: string;
  official_uuid?: string;
  official_date?: string;
  status?: string;
  status_note?: string;
}

export interface InvoiceDraftValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface InvoiceDraftReportFilters {
  date_from?: string;
  date_to?: string;
  document_type?: string;
  status?: string;
  source_type?: string;
  customer_search?: string;
  supplier_search?: string;
}
