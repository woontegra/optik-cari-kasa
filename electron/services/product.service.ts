import type Database from 'better-sqlite3';
import type { ProductInput, ProductListFilters } from '../types/product';
import { PRODUCT_TYPES } from '../types/product';
import { parseScannedCode, buildSearchCandidates, type ParsedBarcode } from './barcodeParser.service';
import { OpticalLookupService } from './opticalLookup.service';
import {
  PRODUCT_LOOKUP_JOIN_SQL,
  PRODUCT_LOOKUP_SELECT,
  hydrateFromLegacyRow,
  mergeLegacyExtraFields,
  opticalBindValues,
  opticalColumnNames,
  opticalPlaceholders,
} from './productOptical.mapper';

export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductValidationError';
  }
}

function parseExtraFields(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function mapProductRow(row: Record<string, unknown>): Record<string, unknown> {
  const base = {
    ...row,
    extra_fields: parseExtraFields(row.extra_fields as string | null),
    uts_tracking_required: !!row.uts_tracking_required,
    is_polarized: !!row.is_polarized,
    has_uv_protection: !!row.has_uv_protection,
    has_blue_light_filter: !!row.has_blue_light_filter,
    is_photochromic: !!row.is_photochromic,
    is_progressive: !!row.is_progressive,
  };
  return hydrateFromLegacyRow(base);
}

const BASE_INSERT_COLS = `name, product_type, brand, model, stock_code, category,
            stock_quantity, purchase_price, sale_price, vat_rate,
            shelf_location, status, min_stock, description, extra_fields,
            ubb_code, uts_product_no, uts_barcode, serial_no, lot_no,
            uts_expiry_date, medical_device_class, uts_tracking_required, uts_status, uts_note`;

const BASE_UPDATE_SET = `name = ?, product_type = ?, brand = ?, model = ?, stock_code = ?, category = ?,
            stock_quantity = ?, purchase_price = ?, sale_price = ?, vat_rate = ?,
            shelf_location = ?, status = ?, min_stock = ?, description = ?, extra_fields = ?,
            ubb_code = ?, uts_product_no = ?, uts_barcode = ?, serial_no = ?, lot_no = ?,
            uts_expiry_date = ?, medical_device_class = ?, uts_tracking_required = ?,
            uts_status = ?, uts_note = ?`;

export class ProductService {
  private lookup: OpticalLookupService;

  constructor(private db: Database.Database) {
    this.lookup = new OpticalLookupService(db);
  }

  private normalizeInput(input: ProductInput): ProductInput {
    let merged = mergeLegacyExtraFields(input);
    if (merged.brand_id && !merged.brand?.trim()) {
      merged = { ...merged, brand: this.lookup.getNameById(merged.brand_id) || merged.brand };
    }
    if (merged.model_id && !merged.model?.trim()) {
      merged = { ...merged, model: this.lookup.getNameById(merged.model_id) || merged.model };
    }
    if (merged.color_id && !merged.frame_color?.trim()) {
      const colorName = this.lookup.getNameById(merged.color_id);
      if (colorName) merged = { ...merged, frame_color: colorName };
    }
    return merged;
  }

  private baseBindValues(input: ProductInput): unknown[] {
    return [
      input.name.trim(),
      input.product_type,
      input.brand?.trim() || null,
      input.model?.trim() || null,
      input.stock_code?.trim() || null,
      input.category?.trim() || null,
      input.stock_quantity,
      input.purchase_price,
      input.sale_price,
      input.vat_rate ?? 18,
      input.shelf_location?.trim() || null,
      input.status || 'Aktif',
      input.min_stock ?? 0,
      input.description?.trim() || null,
      input.extra_fields ? JSON.stringify(input.extra_fields) : null,
      input.ubb_code?.trim() || null,
      input.uts_product_no?.trim() || null,
      input.uts_barcode?.trim() || null,
      input.serial_no?.trim() || null,
      input.lot_no?.trim() || null,
      input.uts_expiry_date?.trim() || null,
      input.medical_device_class?.trim() || null,
      input.uts_tracking_required ? 1 : 0,
      input.uts_status || 'Bekliyor',
      input.uts_note?.trim() || null,
    ];
  }

  list(filters: ProductListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT p.*, pb.barcode, ${PRODUCT_LOOKUP_SELECT}
      FROM products p
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
      ${PRODUCT_LOOKUP_JOIN_SQL}
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.search?.trim()) {
      sql += ` AND (
        p.name LIKE ? OR p.brand LIKE ? OR p.model LIKE ? OR
        p.stock_code LIKE ? OR pb.barcode LIKE ? OR g.name LIKE ? OR b.name LIKE ?
      )`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term, term, term, term);
    }
    if (filters.product_type) {
      sql += ` AND p.product_type = ?`;
      params.push(filters.product_type);
    }
    if (filters.status) {
      sql += ` AND p.status = ?`;
      params.push(filters.status);
    }
    if (filters.group_id) {
      sql += ` AND p.group_id = ?`;
      params.push(filters.group_id);
    }
    if (filters.subgroup_id) {
      sql += ` AND p.subgroup_id = ?`;
      params.push(filters.subgroup_id);
    }
    if (filters.brand_id) {
      sql += ` AND p.brand_id = ?`;
      params.push(filters.brand_id);
    }
    if (filters.model_id) {
      sql += ` AND p.model_id = ?`;
      params.push(filters.model_id);
    }
    if (filters.color_id) {
      sql += ` AND p.color_id = ?`;
      params.push(filters.color_id);
    }
    if (filters.shelf_location?.trim()) {
      sql += ` AND p.shelf_location LIKE ?`;
      params.push(`%${filters.shelf_location.trim()}%`);
    }
    if (filters.critical_only) {
      sql += ` AND p.status = 'Aktif' AND p.stock_quantity <= p.min_stock`;
    }
    if (filters.uts_tracking_required) {
      sql += ` AND p.uts_tracking_required = 1`;
    }
    if (filters.no_barcode) {
      sql += ` AND (pb.barcode IS NULL OR pb.barcode = '')`;
    }

    sql += ` ORDER BY p.name`;
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(mapProductRow);
  }

  getById(id: number): Record<string, unknown> | null {
    const row = this.db
      .prepare(
        `SELECT p.*, pb.barcode, ${PRODUCT_LOOKUP_SELECT}
         FROM products p
         LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
         ${PRODUCT_LOOKUP_JOIN_SQL}
         WHERE p.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapProductRow(row) : null;
  }

  findByBarcode(barcode: string, activeOnly = false): Record<string, unknown> | null {
    let sql = `
      SELECT p.*, pb.barcode, ${PRODUCT_LOOKUP_SELECT}
      FROM products p
      INNER JOIN product_barcodes pb ON pb.product_id = p.id
      ${PRODUCT_LOOKUP_JOIN_SQL}
      WHERE pb.barcode = ?
    `;
    if (activeOnly) sql += ` AND p.status = 'Aktif'`;
    const row = this.db.prepare(sql).get(barcode.trim()) as Record<string, unknown> | undefined;
    return row ? mapProductRow(row) : null;
  }

  private findByProductField(
    field: 'uts_barcode' | 'ubb_code' | 'uts_product_no',
    value: string,
    activeOnly = false
  ): Record<string, unknown> | null {
    const v = value.trim();
    if (!v) return null;
    let sql = `
      SELECT p.*, pb.barcode, ${PRODUCT_LOOKUP_SELECT}
      FROM products p
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
      ${PRODUCT_LOOKUP_JOIN_SQL}
      WHERE p.${field} = ?
    `;
    if (activeOnly) sql += ` AND p.status = 'Aktif'`;
    const row = this.db.prepare(sql).get(v) as Record<string, unknown> | undefined;
    return row ? mapProductRow(row) : null;
  }

  resolveScan(
    rawCode: string,
    activeOnly = false
  ): { product: Record<string, unknown> | null; parsed: ParsedBarcode; matchedBy?: string } {
    const parsed = parseScannedCode(rawCode);
    const candidates = buildSearchCandidates(parsed, rawCode);

    for (const code of candidates) {
      const product = this.findByBarcode(code, activeOnly);
      if (product) return { product, parsed, matchedBy: 'barcode' };
    }

    const fieldOrder: Array<{ field: 'uts_barcode' | 'ubb_code' | 'uts_product_no'; label: string }> = [
      { field: 'uts_barcode', label: 'uts_barcode' },
      { field: 'ubb_code', label: 'ubb_code' },
      { field: 'uts_product_no', label: 'uts_product_no' },
    ];

    for (const code of candidates) {
      for (const { field, label } of fieldOrder) {
        const product = this.findByProductField(field, code, activeOnly);
        if (product) return { product, parsed, matchedBy: label };
      }
    }

    return { product: null, parsed };
  }

  isBarcodeTaken(barcode: string, excludeProductId?: number): boolean {
    if (!barcode.trim()) return false;
    const row = this.db
      .prepare('SELECT product_id FROM product_barcodes WHERE barcode = ?')
      .get(barcode.trim()) as { product_id: number } | undefined;
    if (!row) return false;
    if (excludeProductId && row.product_id === excludeProductId) return false;
    return true;
  }

  validate(input: ProductInput, excludeProductId?: number): void {
    if (!input.name?.trim()) {
      throw new ProductValidationError('Ürün adı zorunludur.');
    }
    if (!input.product_type || !PRODUCT_TYPES.includes(input.product_type)) {
      throw new ProductValidationError('Ürün tipi zorunludur.');
    }
    if (input.purchase_price < 0) {
      throw new ProductValidationError('Alış fiyatı negatif olamaz.');
    }
    if (input.sale_price < 0) {
      throw new ProductValidationError('Satış fiyatı negatif olamaz.');
    }
    if (input.stock_quantity < 0) {
      throw new ProductValidationError('Stok miktarı negatif olamaz.');
    }
    if (input.barcode?.trim() && this.isBarcodeTaken(input.barcode, excludeProductId)) {
      throw new ProductValidationError('Bu barkod başka bir üründe kayıtlı.');
    }
  }

  create(input: ProductInput): { id: number } {
    const normalized = this.normalizeInput(input);
    this.validate(normalized);

    const opticalCols = opticalColumnNames().join(', ');

    const createTx = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO products (${BASE_INSERT_COLS}, ${opticalCols})
           VALUES (${Array(25).fill('?').join(', ')}, ${opticalPlaceholders()})`
        )
        .run(...this.baseBindValues(normalized), ...opticalBindValues(normalized));

      const productId = Number(result.lastInsertRowid);

      if (normalized.barcode?.trim()) {
        this.db
          .prepare('INSERT INTO product_barcodes (product_id, barcode, is_primary) VALUES (?, ?, 1)')
          .run(productId, normalized.barcode.trim());
      }

      if (normalized.stock_quantity > 0) {
        this.db
          .prepare(
            `INSERT INTO stock_movements (product_id, movement_type, quantity, unit_price, notes)
             VALUES (?, 'Giriş', ?, ?, 'Başlangıç stoku')`
          )
          .run(productId, normalized.stock_quantity, normalized.purchase_price);
      }

      return { id: productId };
    });

    return createTx();
  }

  update(id: number, input: ProductInput): { id: number } {
    const existing = this.getById(id);
    if (!existing) {
      throw new ProductValidationError('Ürün bulunamadı.');
    }

    const normalized = this.normalizeInput(input);
    this.validate(normalized, id);

    const oldStock = existing.stock_quantity as number;
    const opticalSet = opticalColumnNames().map((c) => `${c} = ?`).join(', ');

    const updateTx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE products SET ${BASE_UPDATE_SET}, ${opticalSet},
            updated_at = datetime('now', 'localtime')
           WHERE id = ?`
        )
        .run(...this.baseBindValues(normalized), ...opticalBindValues(normalized), id);

      const barcode = normalized.barcode?.trim();
      this.db.prepare('DELETE FROM product_barcodes WHERE product_id = ?').run(id);
      if (barcode) {
        this.db
          .prepare('INSERT INTO product_barcodes (product_id, barcode, is_primary) VALUES (?, ?, 1)')
          .run(id, barcode);
      }

      const stockDiff = normalized.stock_quantity - oldStock;
      if (stockDiff !== 0) {
        this.db
          .prepare(
            `INSERT INTO stock_movements (product_id, movement_type, quantity, unit_price, notes)
             VALUES (?, 'Düzeltme', ?, ?, 'Stok düzeltmesi')`
          )
          .run(id, stockDiff, normalized.purchase_price);
      }

      return { id };
    });

    return updateTx();
  }

  deactivate(id: number): { id: number } {
    const existing = this.getById(id);
    if (!existing) {
      throw new ProductValidationError('Ürün bulunamadı.');
    }
    this.db
      .prepare(
        `UPDATE products SET status = 'Pasif', updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(id);
    return { id };
  }

  delete(id: number): { id: number } {
    const existing = this.getById(id);
    if (!existing) {
      throw new ProductValidationError('Ürün bulunamadı.');
    }
    this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return { id };
  }

  findIdByBarcode(barcode: string): number | null {
    if (!barcode.trim()) return null;
    const row = this.db
      .prepare('SELECT product_id FROM product_barcodes WHERE barcode = ?')
      .get(barcode.trim()) as { product_id: number } | undefined;
    return row?.product_id ?? null;
  }

  upsertFromImport(input: ProductInput, duplicateAction: 'update' | 'skip'): 'created' | 'updated' | 'skipped' {
    const barcode = input.barcode?.trim();
    if (barcode) {
      const existingId = this.findIdByBarcode(barcode);
      if (existingId) {
        if (duplicateAction === 'skip') return 'skipped';
        this.update(existingId, input);
        return 'updated';
      }
    }
    this.create(input);
    return 'created';
  }
}
