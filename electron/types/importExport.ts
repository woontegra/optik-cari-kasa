export const IMPORT_FIELDS = [
  'barcode',
  'stock_code',
  'name',
  'product_type',
  'main_group',
  'sub_group',
  'brand',
  'model',
  'color',
  'category',
  'purchase_price',
  'sale_price',
  'vat_rate',
  'stock_quantity',
  'min_stock',
  'shelf_location',
  'description',
  'color',
  'frame_type',
  'frame_material',
  'frame_color',
  'lens_color',
  'eye_size',
  'bridge_size',
  'temple_length',
  'lens_type',
  'lens_material',
  'lens_index',
  'coating',
  'sph',
  'cyl',
  'ax',
  'add',
  'diameter',
  'base_curve',
  'contact_lens_type',
  'usage_period',
  'ubb_code',
  'uts_product_no',
  'color_legacy',
  'size',
  'index',
  'bc',
  'dia',
  'lot_no',
  'expiry_date',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export type DuplicateBarcodeAction = 'update' | 'skip';

export interface ColumnMapping {
  [excelColumn: string]: ImportField | '';
}

export interface ParsedImportFile {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
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
  suggestedMapping: ColumnMapping;
}

export interface ImportExecuteInput {
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  duplicateAction: DuplicateBarcodeAction;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: Array<{ rowIndex: number; message: string }>;
  warnings: Array<{ rowIndex: number; message: string }>;
}
