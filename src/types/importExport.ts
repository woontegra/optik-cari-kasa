export const IMPORT_FIELD_LABELS: Record<string, string> = {
  barcode: 'Barkod',
  stock_code: 'Stok kodu',
  name: 'Ürün adı',
  product_type: 'Ürün tipi',
  brand: 'Marka',
  model: 'Model',
  category: 'Kategori',
  purchase_price: 'Alış fiyatı',
  sale_price: 'Satış fiyatı',
  vat_rate: 'KDV oranı',
  stock_quantity: 'Stok miktarı',
  min_stock: 'Kritik stok miktarı',
  shelf_location: 'Raf / konum',
  description: 'Açıklama',
  color: 'Renk',
  size: 'Ekartman',
  sph: 'SPH',
  cyl: 'CYL',
  ax: 'AX',
  add: 'ADD',
  diameter: 'Çap',
  index: 'İndeks',
  coating: 'Kaplama',
  bc: 'BC',
  dia: 'DIA',
  lot_no: 'Lot no',
  expiry_date: 'Son kullanma tarihi',
};

export const IMPORT_FIELD_OPTIONS = Object.entries(IMPORT_FIELD_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export type ImportField = keyof typeof IMPORT_FIELD_LABELS;

export type DuplicateBarcodeAction = 'update' | 'skip';

export interface ColumnMapping {
  [excelColumn: string]: ImportField | '';
}

export interface ParsedImportFile {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  suggestedMapping: ColumnMapping;
}

export interface ImportRowPreview {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  isValid: boolean;
  existingProductId?: number;
}

export interface ImportPreviewResult {
  rows: ImportRowPreview[];
  duplicateBarcodesInFile: string[];
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: Array<{ rowIndex: number; message: string }>;
  warnings: Array<{ rowIndex: number; message: string }>;
}

export type LabelTemplate = 'small' | 'standard' | 'shelf';

export const LABEL_TEMPLATE_LABELS: Record<LabelTemplate, string> = {
  small: 'Küçük gözlük etiketi',
  standard: 'Standart ürün etiketi',
  shelf: 'Raf etiketi',
};

export interface LabelSettings {
  defaultTemplate: LabelTemplate;
  showPrice: boolean;
  showBarcode: boolean;
  showCompany: boolean;
  previewBeforePrint: boolean;
}

export interface LabelItemInput {
  productId: number;
  quantity: number;
}

export interface PrintDocument {
  html: string;
  title: string;
}
