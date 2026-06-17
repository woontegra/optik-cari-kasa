export const COUNT_TYPES = ['Tam sayım', 'Kategori sayımı', 'Raf / konum sayımı', 'Ürün tipi sayımı'] as const;
export type CountType = (typeof COUNT_TYPES)[number];

export const COUNT_STATUSES = ['Devam Ediyor', 'Tamamlandı', 'Farklar İşlendi', 'İptal Edildi'] as const;
export type CountStatus = (typeof COUNT_STATUSES)[number];

export const ITEM_STATUSES = ['Eşit', 'Eksik', 'Fazla', 'Sayılmadı', 'Kapsam dışı', 'Bilinmeyen barkod'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export interface CreateCountInput {
  name: string;
  count_date: string;
  count_type: CountType;
  product_type_filter?: string;
  category_filter?: string;
  brand_filter?: string;
  location_filter?: string;
  notes?: string;
}

export interface CountListFilters {
  date_from?: string;
  date_to?: string;
  status?: string;
  search?: string;
}

export interface UpdateItemQuantityInput {
  item_id: number;
  counted_quantity: number;
  note?: string;
}

export interface ResolveUnknownInput {
  unknown_id: number;
  action: 'link' | 'remove';
  product_id?: number;
}

export interface ScanCodeResult {
  success: boolean;
  message?: string;
  warning?: string;
  item?: Record<string, unknown>;
  unknown?: Record<string, unknown>;
  parsed?: Record<string, unknown>;
  summary?: Record<string, unknown>;
}
