import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import type Database from 'better-sqlite3';
import type { ProductInput, ProductType } from '../types/product';
import { PRODUCT_TYPES } from '../types/product';
import type {
  ColumnMapping,
  DuplicateBarcodeAction,
  ImportExecuteInput,
  ImportField,
  ImportPreviewResult,
  ImportResult,
  ImportRowPreview,
  ParsedImportFile,
} from '../types/importExport';
import { ProductService } from './product.service';
import { OpticalLookupService } from './opticalLookup.service';

export class ImportExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportExportError';
  }
}

const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

const HEADER_ALIASES: Record<ImportField, string[]> = {
  barcode: ['barkod', 'barcode', 'ean', 'gtin'],
  stock_code: ['stok kodu', 'stok_kodu', 'stock code', 'stock_code', 'kod'],
  name: ['ürün adı', 'urun adi', 'urun_adi', 'product name', 'name', 'ad', 'ürün'],
  product_type: ['ürün tipi', 'urun tipi', 'product type', 'product_type', 'tip', 'type'],
  main_group: ['ana grup', 'main group', 'main_group', 'grup'],
  sub_group: ['alt grup', 'sub group', 'sub_group', 'altgrup'],
  brand: ['marka', 'brand'],
  model: ['model'],
  color: ['renk', 'color', 'ürün rengi'],
  frame_type: ['çerçeve tipi', 'cerceve tipi', 'frame type', 'frame_type'],
  frame_material: ['çerçeve materyali', 'cerceve materyali', 'frame material'],
  frame_color: ['çerçeve rengi', 'cerceve rengi', 'frame color'],
  lens_color: ['cam rengi', 'lens color'],
  eye_size: ['ekartman', 'eye size', 'eye_size'],
  bridge_size: ['köprü', 'kopru', 'bridge', 'bridge_size'],
  temple_length: ['sap', 'sap uzunluğu', 'temple', 'temple_length'],
  lens_type: ['cam tipi', 'lens type', 'lens_type'],
  lens_material: ['cam materyali', 'lens material'],
  lens_index: ['cam indeksi', 'lens index', 'lens_index'],
  contact_lens_type: ['kontakt lens tipi', 'contact lens type'],
  usage_period: ['kullanım süresi', 'kullanim suresi', 'usage period'],
  ubb_code: ['ubb', 'ubb kodu', 'ubb_code'],
  uts_product_no: ['üts ürün no', 'uts urun no', 'uts_product_no', 'üts no'],
  category: ['kategori', 'category'],
  purchase_price: ['alış fiyatı', 'alis fiyati', 'purchase price', 'purchase_price', 'alış', 'alis'],
  sale_price: ['satış fiyatı', 'satis fiyati', 'sale price', 'sale_price', 'satış', 'satis', 'fiyat'],
  vat_rate: ['kdv', 'kdv oranı', 'vat', 'vat_rate'],
  stock_quantity: ['stok', 'stok miktarı', 'stock', 'stock_quantity', 'miktar', 'adet'],
  min_stock: ['kritik stok', 'min stok', 'min_stock', 'minimum stok'],
  shelf_location: ['raf', 'konum', 'raf / konum', 'shelf', 'shelf_location', 'raf konum'],
  description: ['açıklama', 'aciklama', 'description', 'not'],
  size: ['ölçü', 'olcu', 'size', 'ekartman'],
  sph: ['sph'],
  cyl: ['cyl', 'silindir'],
  ax: ['ax', 'aks'],
  add: ['add', 'yakın', 'yakin'],
  diameter: ['çap', 'cap', 'diameter', 'dia çap'],
  index: ['indeks', 'index'],
  coating: ['kaplama', 'coating'],
  bc: ['bc', 'base curve'],
  dia: ['dia', 'diameter lens'],
  lot_no: ['lot', 'lot no', 'lot_no', 'parti'],
  expiry_date: ['son kullanma', 'skt', 'expiry', 'expiry_date'],
};

export function normalizeProductType(raw: string | undefined): ProductType {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return 'Diğer';
  if (['çerçeve', 'cerceve', 'frame'].includes(v)) return 'Çerçeve';
  if (['güneş gözlüğü', 'gunes gozlugu', 'sunglasses'].includes(v)) return 'Güneş Gözlüğü';
  if (['optik cam', 'cam', 'glass', 'gözlük camı', 'gozluk cami'].includes(v)) return 'Optik Cam';
  if (['kontakt lens', 'kontak lens', 'lens'].includes(v)) return 'Kontakt Lens';
  if (['lens solüsyonu', 'lens solusyonu', 'solution'].includes(v)) return 'Lens Solüsyonu';
  if (['aksesuar', 'accessory'].includes(v)) return 'Aksesuar';
  if (['hizmet', 'service'].includes(v)) return 'Hizmet';
  if (PRODUCT_TYPES.includes(raw as ProductType)) return raw as ProductType;
  return 'Diğer';
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    const norm = normalizeHeader(header);
    let matched: ImportField | '' = '';
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ImportField, string[]][]) {
      if (aliases.some((a) => norm === a || norm.includes(a))) {
        matched = field;
        break;
      }
    }
    mapping[header] = matched;
  }
  return mapping;
}

function parseNumber(value: string | undefined, fallback = 0): number {
  if (!value?.trim()) return fallback;
  const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function getMappedValue(row: Record<string, string>, mapping: ColumnMapping, field: ImportField): string {
  for (const [col, mapped] of Object.entries(mapping)) {
    if (mapped === field) return (row[col] ?? '').trim();
  }
  return '';
}

export function rowToProductInput(
  row: Record<string, string>,
  mapping: ColumnMapping
): { input: ProductInput; warnings: string[] } {
  const warnings: string[] = [];
  const name = getMappedValue(row, mapping, 'name');
  const productType = normalizeProductType(getMappedValue(row, mapping, 'product_type'));
  const purchasePrice = parseNumber(getMappedValue(row, mapping, 'purchase_price'));
  const salePrice = parseNumber(getMappedValue(row, mapping, 'sale_price'));
  const stockQty = parseNumber(getMappedValue(row, mapping, 'stock_quantity'));
  const minStock = parseNumber(getMappedValue(row, mapping, 'min_stock'));
  const vatRate = parseNumber(getMappedValue(row, mapping, 'vat_rate'), 18);
  const barcode = getMappedValue(row, mapping, 'barcode');

  if (purchasePrice < 0) warnings.push('Alış fiyatı negatif, 0 kabul edildi.');
  if (salePrice < 0) warnings.push('Satış fiyatı negatif, 0 kabul edildi.');
  if (stockQty < 0) warnings.push('Stok miktarı negatif, 0 kabul edildi.');
  if (!barcode) warnings.push('Barkod boş.');

  const extra: Record<string, string> = {};
  const extraFields: ImportField[] = ['size', 'sph', 'cyl', 'ax', 'add', 'diameter', 'index', 'coating', 'bc', 'dia', 'lot_no', 'expiry_date'];
  for (const f of extraFields) {
    const val = getMappedValue(row, mapping, f);
    if (val) {
      const key = f === 'size' ? 'size' : f === 'ax' ? 'ax' : f;
      extra[key] = val;
    }
  }

  const mainGroup = getMappedValue(row, mapping, 'main_group');
  const subGroup = getMappedValue(row, mapping, 'sub_group');

  return {
    input: {
      barcode: barcode || undefined,
      stock_code: getMappedValue(row, mapping, 'stock_code') || undefined,
      name,
      product_type: mainGroup ? normalizeProductType(mainGroup) : productType,
      brand: getMappedValue(row, mapping, 'brand') || undefined,
      model: getMappedValue(row, mapping, 'model') || undefined,
      category: getMappedValue(row, mapping, 'category') || undefined,
      purchase_price: Math.max(0, purchasePrice),
      sale_price: Math.max(0, salePrice),
      vat_rate: vatRate,
      stock_quantity: Math.max(0, Math.round(stockQty)),
      min_stock: Math.max(0, Math.round(minStock)),
      shelf_location: getMappedValue(row, mapping, 'shelf_location') || undefined,
      description: getMappedValue(row, mapping, 'description') || undefined,
      status: 'Aktif',
      extra_fields: Object.keys(extra).length ? extra : undefined,
      ubb_code: getMappedValue(row, mapping, 'ubb_code') || undefined,
      uts_product_no: getMappedValue(row, mapping, 'uts_product_no') || undefined,
      frame_color: getMappedValue(row, mapping, 'frame_color') || getMappedValue(row, mapping, 'color') || undefined,
      lens_color: getMappedValue(row, mapping, 'lens_color') || undefined,
      eye_size: getMappedValue(row, mapping, 'eye_size') || getMappedValue(row, mapping, 'size') || undefined,
      bridge_size: getMappedValue(row, mapping, 'bridge_size') || undefined,
      temple_length: getMappedValue(row, mapping, 'temple_length') || undefined,
      sph: getMappedValue(row, mapping, 'sph') || undefined,
      cyl: getMappedValue(row, mapping, 'cyl') || undefined,
      axis: getMappedValue(row, mapping, 'ax') || undefined,
      addition: getMappedValue(row, mapping, 'add') || undefined,
      diameter: getMappedValue(row, mapping, 'diameter') || getMappedValue(row, mapping, 'dia') || undefined,
      base_curve: getMappedValue(row, mapping, 'base_curve') || getMappedValue(row, mapping, 'bc') || undefined,
      lens_index: getMappedValue(row, mapping, 'lens_index') || getMappedValue(row, mapping, 'index') || undefined,
      usage_period: getMappedValue(row, mapping, 'usage_period') || undefined,
      lot_no: getMappedValue(row, mapping, 'lot_no') || undefined,
      uts_expiry_date: getMappedValue(row, mapping, 'expiry_date') || undefined,
      _import_main_group: mainGroup || undefined,
      _import_sub_group: subGroup || undefined,
      _import_frame_type: getMappedValue(row, mapping, 'frame_type') || undefined,
      _import_frame_material: getMappedValue(row, mapping, 'frame_material') || undefined,
      _import_lens_type: getMappedValue(row, mapping, 'lens_type') || undefined,
      _import_lens_material: getMappedValue(row, mapping, 'lens_material') || undefined,
      _import_coating: getMappedValue(row, mapping, 'coating') || undefined,
      _import_contact_lens_type: getMappedValue(row, mapping, 'contact_lens_type') || undefined,
    } as ProductInput & Record<string, string | undefined>,
    warnings,
  };
}

export class ImportExportService {
  private productService: ProductService;
  private lookupService: OpticalLookupService;

  constructor(private db: Database.Database) {
    this.productService = new ProductService(db);
    this.lookupService = new OpticalLookupService(db);
  }

  private resolveImportLookups(input: ProductInput): ProductInput {
    const imp = input as ProductInput & Record<string, string | undefined>;
    const out: ProductInput = { ...input };

    const assign = (type: import('../types/opticalLookup').OpticalLookupType, name?: string, parentId?: number | null) => {
      if (!name?.trim()) return undefined;
      return this.lookupService.findOrCreate(type, name.trim(), parentId ?? null, true)?.id;
    };

    if (imp._import_main_group) {
      out.group_id = assign('PRODUCT_GROUP', imp._import_main_group);
    }
    if (imp._import_sub_group && out.group_id) {
      out.subgroup_id = assign('PRODUCT_SUBGROUP', imp._import_sub_group, out.group_id);
    }
    if (input.brand) {
      out.brand_id = assign('BRAND', input.brand);
    }
    if (input.model && out.brand_id) {
      out.model_id = assign('MODEL', input.model, out.brand_id);
    }
    if (imp.frame_color || imp._import_color) {
      out.color_id = assign('COLOR', imp.frame_color || imp._import_color);
    }
    if (imp._import_frame_type) {
      out.frame_type_id = assign('FRAME_TYPE', imp._import_frame_type, out.group_id);
    }
    if (imp._import_frame_material) {
      out.frame_material_id = assign('FRAME_MATERIAL', imp._import_frame_material);
    }
    if (imp._import_lens_type) {
      out.lens_type_id = assign('LENS_TYPE', imp._import_lens_type);
    }
    if (imp._import_lens_material) {
      out.lens_material_id = assign('LENS_MATERIAL', imp._import_lens_material);
    }
    if (imp._import_coating) {
      out.lens_coating_id = assign('LENS_COATING', imp._import_coating);
    }
    if (imp._import_contact_lens_type) {
      out.contact_lens_type_id = assign('CONTACT_LENS_TYPE', imp._import_contact_lens_type);
    }

    return out;
  }

  validateExtension(filePath: string): void {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      throw new ImportExportError('Desteklenmeyen dosya formatı. .xlsx, .xls veya .csv kullanın.');
    }
  }

  parseFile(filePath: string): ParsedImportFile {
    this.validateExtension(filePath);
    if (!fs.existsSync(filePath)) {
      throw new ImportExportError('Dosya bulunamadı.');
    }

    let workbook: XLSX.WorkBook;
    try {
      const buffer = fs.readFileSync(filePath);
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new ImportExportError('Dosya okunamadı. Dosyanın bozuk olmadığından emin olun.');
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new ImportExportError('Excel dosyası boş.');
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (!rawRows.length) {
      throw new ImportExportError('Excel dosyasında veri satırı bulunamadı.');
    }

    const headers = Object.keys(rawRows[0] || {});
    if (!headers.length) {
      throw new ImportExportError('Excel dosyasında başlık satırı bulunamadı.');
    }

    const rows = rawRows.map((row) => {
      const normalized: Record<string, string> = {};
      for (const [key, val] of Object.entries(row)) {
        normalized[key] = val == null ? '' : String(val).trim();
      }
      return normalized;
    });

    return {
      fileName: path.basename(filePath),
      headers,
      rows,
    };
  }

  previewImport(rows: Record<string, string>[], mapping: ColumnMapping): ImportPreviewResult {
    const barcodeCounts = new Map<string, number>();
    const duplicateBarcodesInFile: string[] = [];

    for (const row of rows) {
      const bc = getMappedValue(row, mapping, 'barcode');
      if (bc) {
        const count = (barcodeCounts.get(bc) || 0) + 1;
        barcodeCounts.set(bc, count);
        if (count === 2) duplicateBarcodesInFile.push(bc);
      }
    }

    const previews: ImportRowPreview[] = rows.map((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const { input, warnings: rowWarnings } = rowToProductInput(row, mapping);
      warnings.push(...rowWarnings);

      if (!input.name?.trim()) {
        errors.push('Ürün adı zorunludur.');
      }

      const bc = input.barcode?.trim();
      if (bc && barcodeCounts.get(bc)! > 1) {
        errors.push('Dosyada tekrar eden barkod.');
      }

      let existingProductId: number | undefined;
      if (bc) {
        const existing = this.productService.findByBarcode(bc);
        if (existing) {
          existingProductId = existing.id as number;
          warnings.push('Bu barkod veritabanında mevcut.');
        }
      }

      return {
        rowIndex: index + 2,
        data: input as unknown as Record<string, unknown>,
        errors,
        warnings,
        isValid: errors.length === 0 && !!input.name?.trim(),
        existingProductId,
      };
    });

    return {
      rows: previews,
      duplicateBarcodesInFile,
      suggestedMapping: mapping,
    };
  }

  executeImport(input: ImportExecuteInput): ImportResult {
    const result: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [], warnings: [] };

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const rowIndex = i + 2;
      const preview = this.previewImport([row], input.mapping).rows[0];

      if (!preview.isValid) {
        result.skipped++;
        result.errors.push({ rowIndex, message: preview.errors.join('; ') });
        continue;
      }

      const { input: productInput, warnings } = rowToProductInput(row, input.mapping);
      for (const w of warnings) {
        result.warnings.push({ rowIndex, message: w });
      }

      try {
        const resolved = this.resolveImportLookups(productInput);
        const action = this.productService.upsertFromImport(resolved, input.duplicateAction);
        if (action === 'created') result.added++;
        else if (action === 'updated') result.updated++;
        else result.skipped++;
      } catch (err) {
        result.skipped++;
        result.errors.push({ rowIndex, message: (err as Error).message });
      }
    }

    return result;
  }

  exportToFile(filePath: string): void {
    const products = this.productService.list();
    const rows = products.map((p) => {
      const extra = (p.extra_fields as Record<string, string>) || {};
      return {
        Barkod: p.barcode || '',
        'Stok kodu': p.stock_code || '',
        'Ürün adı': p.name,
        'Ana Grup': p.group_name || '',
        'Alt Grup': p.subgroup_name || '',
        'Ürün tipi': p.product_type,
        Marka: p.brand || p.brand_lookup_name || '',
        Model: p.model || p.model_lookup_name || '',
        Renk: p.color_name || p.frame_color || extra.color || '',
        Kategori: p.category || '',
        Stok: p.stock_quantity,
        'Alış fiyatı': p.purchase_price,
        'Satış fiyatı': p.sale_price,
        'KDV oranı': p.vat_rate ?? 18,
        'Raf / konum': p.shelf_location || '',
        Durum: p.status || 'Aktif',
        Açıklama: p.description || '',
        'Çerçeve Tipi': '',
        'Çerçeve Materyali': '',
        Ekartman: p.eye_size || extra.size || '',
        Köprü: p.bridge_size || extra.bridge_size || '',
        'Sap Uzunluğu': p.temple_length || extra.temple_length || '',
        'Cam Tipi': '',
        'Cam Materyali': '',
        'Cam İndeksi': p.lens_index || extra.index || '',
        Kaplama: extra.coating || '',
        SPH: p.sph || extra.sph || '',
        CYL: p.cyl || extra.cyl || '',
        AXIS: p.axis || extra.ax || '',
        ADD: p.addition || extra.add || '',
        Çap: p.diameter || extra.diameter || '',
        'Base Curve': p.base_curve || extra.bc || '',
        'Lens Tipi': '',
        'Kullanım Süresi': p.usage_period || '',
        'Lot No': p.lot_no || extra.lot_no || '',
        'Son Kullanma Tarihi': p.uts_expiry_date || extra.expiry_date || '',
        'UBB Kodu': p.ubb_code || '',
        'ÜTS Ürün No': p.uts_product_no || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stok');
    XLSX.writeFile(wb, filePath);
  }

  generateTemplate(filePath: string): void {
    const rows = [
      {
        Barkod: '8690001001001',
        'Stok kodu': 'CR-001',
        'Ürün adı': 'Ray-Ban RB2140 Siyah',
        'Ürün tipi': 'Çerçeve',
        Marka: 'Ray-Ban',
        Model: 'RB2140',
        Kategori: 'Güneş',
        'Alış fiyatı': 850,
        'Satış fiyatı': 1499,
        'KDV oranı': 20,
        Stok: 5,
        'Kritik stok': 2,
        'Raf / konum': 'A-01',
        Açıklama: 'Örnek çerçeve',
        Renk: 'Siyah',
        Ekartman: '54-18-140',
      },
      {
        Barkod: '8690001001002',
        'Stok kodu': 'CM-001',
        'Ürün adı': 'Progresif Cam 1.67',
        'Ürün tipi': 'Cam',
        Marka: 'Essilor',
        Model: 'Varilux',
        Kategori: 'Progresif',
        'Alış fiyatı': 450,
        'Satış fiyatı': 899,
        'KDV oranı': 20,
        Stok: 10,
        'Kritik stok': 3,
        'Raf / konum': 'B-02',
        SPH: '-2.00',
        CYL: '-0.50',
        AX: '90',
        ADD: '+2.00',
        Çap: '65',
        İndeks: '1.67',
        Kaplama: 'Anti-refle',
      },
      {
        Barkod: '8690001001003',
        'Stok kodu': 'LN-001',
        'Ürün adı': 'Günlük Lens 30lu',
        'Ürün tipi': 'Lens',
        Marka: 'Acuvue',
        Model: 'Oasys',
        Kategori: 'Günlük',
        'Alış fiyatı': 120,
        'Satış fiyatı': 249,
        'KDV oranı': 20,
        Stok: 20,
        'Kritik stok': 5,
        'Raf / konum': 'C-03',
        SPH: '-3.00',
        BC: '8.4',
        DIA: '14.0',
        'Lot no': 'LOT2026A',
        'Son kullanma tarihi': '2027-12-31',
      },
      {
        Barkod: '8690001001004',
        'Stok kodu': 'AK-001',
        'Ürün adı': 'Gözlük Temizleme Seti',
        'Ürün tipi': 'Aksesuar',
        Marka: 'Woontegra',
        Model: 'CleanKit',
        Kategori: 'Bakım',
        'Alış fiyatı': 25,
        'Satış fiyatı': 59,
        'KDV oranı': 20,
        Stok: 50,
        'Kritik stok': 10,
        'Raf / konum': 'D-01',
        Açıklama: 'Örnek aksesuar',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, filePath);
  }
}
