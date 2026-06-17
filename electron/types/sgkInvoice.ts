export const SGK_INVOICE_BATCH_STATUSES = [
  'Taslak',
  'Hazırlandı',
  'Faturalandı',
  'Tahsil Edildi',
  'İptal',
] as const;

export type SgkInvoiceBatchStatus = (typeof SGK_INVOICE_BATCH_STATUSES)[number];

export interface SgkInvoiceListFilters {
  date_from?: string;
  date_to?: string;
  institution?: string;
  status?: string;
  invoiced?: boolean;
}

export interface SgkCreateBatchInput {
  date_from: string;
  date_to: string;
  institution?: string;
  sale_ids?: number[];
  notes?: string;
}

export interface SgkInvoiceReadyFilters {
  date_from?: string;
  date_to?: string;
  institution?: string;
  medula_status?: string;
  invoice_ready?: boolean;
  invoiced?: boolean;
}
