import type Database from 'better-sqlite3';
import * as XLSX from 'xlsx';
import { parseScannedCode, type ParsedBarcode } from './barcodeParser.service';
import { ProductService } from './product.service';
import type {
  CountListFilters,
  CreateCountInput,
  ResolveUnknownInput,
  ScanCodeResult,
  UpdateItemQuantityInput,
} from '../types/inventoryCount';

export class InventoryCountValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryCountValidationError';
  }
}

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ₺`;
}

function computeItemStatus(expected: number, counted: number): string {
  if (counted === 0) return 'Sayılmadı';
  const diff = counted - expected;
  if (diff === 0) return 'Eşit';
  if (diff < 0) return 'Eksik';
  return 'Fazla';
}

function buildScopeLabel(count: Record<string, unknown>): string {
  const parts: string[] = [String(count.count_type || 'Tam sayım')];
  if (count.product_type_filter && count.product_type_filter !== 'Tümü') {
    parts.push(`Tip: ${count.product_type_filter}`);
  }
  if (count.category_filter) parts.push(`Kategori: ${count.category_filter}`);
  if (count.brand_filter) parts.push(`Marka: ${count.brand_filter}`);
  if (count.location_filter) parts.push(`Raf: ${count.location_filter}`);
  return parts.join(' | ');
}

export class InventoryCountService {
  private productService: ProductService;

  constructor(private db: Database.Database) {
    this.productService = new ProductService(db);
  }

  private generateCountNo(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const prefix = `SYM-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const row = this.db
      .prepare(`SELECT count_no FROM inventory_counts WHERE count_no LIKE ? ORDER BY id DESC LIMIT 1`)
      .get(`${prefix}%`) as { count_no: string } | undefined;
    let seq = 1;
    if (row?.count_no) {
      const parts = row.count_no.split('-');
      const last = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(last)) seq = last + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private productMatchesScope(product: Record<string, unknown>, count: Record<string, unknown>): boolean {
    const typeFilter = count.product_type_filter as string | null;
    if (typeFilter && typeFilter !== 'Tümü' && product.product_type !== typeFilter) return false;
    if (count.category_filter && product.category !== count.category_filter) return false;
    if (count.brand_filter && product.brand !== count.brand_filter) return false;
    if (count.location_filter && product.shelf_location !== count.location_filter) return false;
    return true;
  }

  private buildProductQuery(count: CreateCountInput): { sql: string; params: unknown[] } {
    let sql = `
      SELECT p.id, p.stock_quantity, pb.barcode
      FROM products p
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
      WHERE p.status = 'Aktif'
    `;
    const params: unknown[] = [];
    if (count.product_type_filter && count.product_type_filter !== 'Tümü') {
      sql += ` AND p.product_type = ?`;
      params.push(count.product_type_filter);
    }
    if (count.category_filter?.trim()) {
      sql += ` AND p.category = ?`;
      params.push(count.category_filter.trim());
    }
    if (count.brand_filter?.trim()) {
      sql += ` AND p.brand = ?`;
      params.push(count.brand_filter.trim());
    }
    if (count.location_filter?.trim()) {
      sql += ` AND p.shelf_location = ?`;
      params.push(count.location_filter.trim());
    }
    sql += ` ORDER BY p.name`;
    return { sql, params };
  }

  private getCountRow(countId: number): Record<string, unknown> {
    const row = this.db
      .prepare(
        `SELECT c.*, u.full_name as created_by_name
         FROM inventory_counts c
         LEFT JOIN users u ON u.id = c.created_by
         WHERE c.id = ?`
      )
      .get(countId) as Record<string, unknown> | undefined;
    if (!row) throw new InventoryCountValidationError('Sayım kaydı bulunamadı.');
    return row;
  }

  private updateItemMetrics(itemId: number, expected: number, counted: number): void {
    const diff = counted - expected;
    const status = computeItemStatus(expected, counted);
    this.db
      .prepare(
        `UPDATE inventory_count_items
         SET counted_quantity = ?, difference_quantity = ?, status = ?,
             updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(counted, diff, status, itemId);
  }

  private mapItemRow(row: Record<string, unknown>): Record<string, unknown> {
    return {
      ...row,
      product_name: row.product_name,
      difference_quantity: Number(row.counted_quantity ?? 0) - Number(row.expected_quantity ?? 0),
    };
  }

  private loadItems(countId: number): Record<string, unknown>[] {
    const rows = this.db
      .prepare(
        `SELECT ici.*, p.name as product_name, p.product_type, p.brand, p.model, p.shelf_location
         FROM inventory_count_items ici
         INNER JOIN products p ON p.id = ici.product_id
         WHERE ici.count_id = ?
         ORDER BY p.name`
      )
      .all(countId) as Record<string, unknown>[];
    return rows.map((r) => this.mapItemRow(r));
  }

  private loadUnknowns(countId: number): Record<string, unknown>[] {
    return this.db
      .prepare(`SELECT * FROM inventory_unknown_scans WHERE count_id = ? ORDER BY scanned_at DESC`)
      .all(countId) as Record<string, unknown>[];
  }

  private loadScans(countId: number, limit = 100): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT s.*, p.name as product_name, u.full_name as scanned_by_name
         FROM inventory_count_scans s
         LEFT JOIN products p ON p.id = s.product_id
         LEFT JOIN users u ON u.id = s.created_by
         WHERE s.count_id = ?
         ORDER BY s.scanned_at DESC
         LIMIT ?`
      )
      .all(countId, limit) as Record<string, unknown>[];
  }

  computeSummary(countId: number): Record<string, unknown> {
    const items = this.loadItems(countId);
    const unknowns = this.loadUnknowns(countId).filter((u) => u.status === 'Bekliyor');
    const count = this.getCountRow(countId);

    let totalExpected = 0;
    let totalCounted = 0;
    let missingKinds = 0;
    let excessKinds = 0;
    let unscannedKinds = 0;

    for (const item of items) {
      const expected = Number(item.expected_quantity ?? 0);
      const counted = Number(item.counted_quantity ?? 0);
      totalExpected += expected;
      totalCounted += counted;
      const status = String(item.status);
      if (status === 'Eksik') missingKinds += 1;
      else if (status === 'Fazla') excessKinds += 1;
      else if (status === 'Sayılmadı') unscannedKinds += 1;
    }

    return {
      totalKinds: items.length,
      totalExpected,
      totalCounted,
      missingKinds,
      excessKinds,
      unscannedKinds,
      unknownCount: unknowns.length,
      lastScannedCode: count.last_scanned_code || '',
    };
  }

  getActiveCount(): Record<string, unknown> | null {
    const row = this.db
      .prepare(
        `SELECT c.*, u.full_name as created_by_name
         FROM inventory_counts c
         LEFT JOIN users u ON u.id = c.created_by
         WHERE c.status = 'Devam Ediyor'
         ORDER BY c.updated_at DESC
         LIMIT 1`
      )
      .get() as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.getCountDetail(Number(row.id));
  }

  createCount(input: CreateCountInput, userId: number): Record<string, unknown> {
    if (!input.name?.trim()) {
      throw new InventoryCountValidationError('Sayım adı zorunludur.');
    }

    const active = this.db
      .prepare(`SELECT id FROM inventory_counts WHERE status = 'Devam Ediyor' LIMIT 1`)
      .get() as { id: number } | undefined;
    if (active) {
      throw new InventoryCountValidationError(
        'Devam eden bir sayım var. Önce mevcut sayımı tamamlayın veya iptal edin.'
      );
    }

    const countNo = this.generateCountNo();
    const countDate = input.count_date || new Date().toISOString().slice(0, 10);
    const { sql, params } = this.buildProductQuery(input);
    const products = this.db.prepare(sql).all(...params) as Array<{
      id: number;
      stock_quantity: number;
      barcode: string | null;
    }>;

    const run = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO inventory_counts (
            count_no, name, count_date, count_type, product_type_filter,
            category_filter, brand_filter, location_filter, notes, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Devam Ediyor', ?)`
        )
        .run(
          countNo,
          input.name.trim(),
          countDate,
          input.count_type || 'Tam sayım',
          input.product_type_filter || 'Tümü',
          input.category_filter?.trim() || null,
          input.brand_filter?.trim() || null,
          input.location_filter?.trim() || null,
          input.notes?.trim() || null,
          userId
        );
      const countId = Number(result.lastInsertRowid);

      const insertItem = this.db.prepare(
        `INSERT INTO inventory_count_items (
          count_id, product_id, barcode, expected_quantity, counted_quantity,
          difference_quantity, status
        ) VALUES (?, ?, ?, ?, 0, ?, 'Sayılmadı')`
      );

      for (const p of products) {
        const expected = Number(p.stock_quantity ?? 0);
        insertItem.run(countId, p.id, p.barcode, expected, -expected);
      }

      return countId;
    });

    const countId = run();
    return this.getCountDetail(countId);
  }

  getCountDetail(countId: number): Record<string, unknown> {
    const count = this.getCountRow(countId);
    const items = this.loadItems(countId);
    const unknowns = this.loadUnknowns(countId);
    const scans = this.loadScans(countId);
    const summary = this.computeSummary(countId);
    return {
      ...count,
      scope_label: buildScopeLabel(count),
      items,
      unknowns,
      scans,
      summary,
    };
  }

  listCounts(filters: CountListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT c.*, u.full_name as created_by_name,
        (SELECT COUNT(*) FROM inventory_count_items WHERE count_id = c.id) as total_kinds,
        (SELECT COUNT(*) FROM inventory_count_items WHERE count_id = c.id AND status = 'Eksik') as missing_kinds,
        (SELECT COUNT(*) FROM inventory_count_items WHERE count_id = c.id AND status = 'Fazla') as excess_kinds,
        (SELECT COUNT(*) FROM inventory_count_items WHERE count_id = c.id AND status = 'Sayılmadı') as unscanned_kinds
      FROM inventory_counts c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.date_from) {
      sql += ` AND date(c.count_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(c.count_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.status) {
      sql += ` AND c.status = ?`;
      params.push(filters.status);
    }
    if (filters.search?.trim()) {
      sql += ` AND (c.count_no LIKE ? OR c.name LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY c.created_at DESC LIMIT 500`;
    return this.db.prepare(sql).all(...params).map((row) => ({
      ...(row as Record<string, unknown>),
      scope_label: buildScopeLabel(row as Record<string, unknown>),
    }));
  }

  saveDraft(countId: number): { saved: boolean } {
    const count = this.getCountRow(countId);
    if (count.status !== 'Devam Ediyor') {
      throw new InventoryCountValidationError('Sadece devam eden sayımlar taslak olarak kaydedilebilir.');
    }
    this.db
      .prepare(`UPDATE inventory_counts SET updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(countId);
    return { saved: true };
  }

  private ensureItemForProduct(countId: number, product: Record<string, unknown>): Record<string, unknown> {
    let item = this.db
      .prepare(`SELECT * FROM inventory_count_items WHERE count_id = ? AND product_id = ?`)
      .get(countId, product.id) as Record<string, unknown> | undefined;

    if (!item) {
      const barcode = this.db
        .prepare(`SELECT barcode FROM product_barcodes WHERE product_id = ? AND is_primary = 1 LIMIT 1`)
        .get(product.id) as { barcode: string } | undefined;
      const expected = Number(product.stock_quantity ?? 0);
      const result = this.db
        .prepare(
          `INSERT INTO inventory_count_items (
            count_id, product_id, barcode, expected_quantity, counted_quantity,
            difference_quantity, status
          ) VALUES (?, ?, ?, ?, 0, ?, 'Sayılmadı')`
        )
        .run(countId, product.id, barcode?.barcode || null, expected, -expected);
      item = this.db
        .prepare(`SELECT * FROM inventory_count_items WHERE id = ?`)
        .get(Number(result.lastInsertRowid)) as Record<string, unknown>;
    }
    return item;
  }

  scanCode(countId: number, rawCode: string, userId: number): ScanCodeResult {
    const count = this.getCountRow(countId);
    if (count.status !== 'Devam Ediyor') {
      throw new InventoryCountValidationError('Bu sayım oturumu aktif değil.');
    }

    const parsed = parseScannedCode(rawCode);
    const { product } = this.productService.resolveScan(rawCode, false);

    const insertScan = (
      productId: number | null,
      scanResult: string,
      p: ParsedBarcode
    ) => {
      this.db
        .prepare(
          `INSERT INTO inventory_count_scans (
            count_id, product_id, raw_code, normalized_code, barcode_type,
            gtin, serial_no, lot_no, expiry_date, scan_result, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          countId,
          productId,
          p.raw,
          p.normalized,
          p.type,
          p.gtin || null,
          p.serialNo || null,
          p.lotNo || null,
          p.expiryDate || null,
          scanResult,
          userId
        );
    };

    if (!product) {
      insertScan(null, 'unknown', parsed);
      this.db
        .prepare(`UPDATE inventory_counts SET last_scanned_code = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`)
        .run(parsed.normalized || rawCode, countId);
      return {
        success: false,
        message: 'Bu barkoda ait ürün bulunamadı.',
        parsed: parsed as unknown as Record<string, unknown>,
        summary: this.computeSummary(countId),
      };
    }

    if (!this.productMatchesScope(product, count)) {
      insertScan(Number(product.id), 'out_of_scope', parsed);
      return {
        success: false,
        message: 'Bu ürün bu sayım kapsamına dahil değil.',
        parsed: parsed as unknown as Record<string, unknown>,
        summary: this.computeSummary(countId),
      };
    }

    const item = this.ensureItemForProduct(countId, product);
    const itemId = Number(item.id);
    const expected = Number(item.expected_quantity ?? 0);
    let counted = Number(item.counted_quantity ?? 0);

    if (parsed.serialNo) {
      const dup = this.db
        .prepare(
          `SELECT id FROM inventory_count_scans
           WHERE count_id = ? AND product_id = ? AND serial_no = ? AND scan_result = 'ok'`
        )
        .get(countId, product.id, parsed.serialNo) as { id: number } | undefined;
      if (dup) {
        insertScan(Number(product.id), 'duplicate_serial', parsed);
        return {
          success: false,
          warning: `Bu seri numarası zaten okutuldu: ${parsed.serialNo}`,
          parsed: parsed as unknown as Record<string, unknown>,
          summary: this.computeSummary(countId),
        };
      }
    }

    counted += 1;
    const noteParts: string[] = [];
    if (parsed.serialNo) noteParts.push(`Seri: ${parsed.serialNo}`);
    if (parsed.lotNo) noteParts.push(`Lot: ${parsed.lotNo}`);
    if (parsed.expiryDate) noteParts.push(`SKT: ${parsed.expiryDate}`);
    const noteAppend = noteParts.length ? noteParts.join(' | ') : null;

    this.db
      .prepare(
        `UPDATE inventory_count_items
         SET counted_quantity = ?, last_scanned_at = datetime('now', 'localtime'),
             notes = CASE WHEN ? IS NOT NULL THEN COALESCE(notes || ' | ', '') || ? ELSE notes END,
             updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(counted, noteAppend, noteAppend, itemId);

    this.updateItemMetrics(itemId, expected, counted);
    insertScan(Number(product.id), 'ok', parsed);

    this.db
      .prepare(
        `UPDATE inventory_counts SET last_scanned_code = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(parsed.barcode || parsed.normalized || rawCode, countId);

    const updatedItem = this.db
      .prepare(
        `SELECT ici.*, p.name as product_name, p.product_type, p.brand, p.model, p.shelf_location
         FROM inventory_count_items ici
         INNER JOIN products p ON p.id = ici.product_id
         WHERE ici.id = ?`
      )
      .get(itemId) as Record<string, unknown>;

    return {
      success: true,
      item: this.mapItemRow(updatedItem),
      parsed: parsed as unknown as Record<string, unknown>,
      summary: this.computeSummary(countId),
    };
  }

  addUnknownScan(countId: number, rawCode: string, note?: string): Record<string, unknown> {
    const count = this.getCountRow(countId);
    if (count.status !== 'Devam Ediyor') {
      throw new InventoryCountValidationError('Bilinmeyen barkod sadece devam eden sayıma eklenebilir.');
    }
    const parsed = parseScannedCode(rawCode);
    const existing = this.db
      .prepare(
        `SELECT id FROM inventory_unknown_scans WHERE count_id = ? AND normalized_code = ? AND status = 'Bekliyor'`
      )
      .get(countId, parsed.normalized) as { id: number } | undefined;
    if (existing) {
      throw new InventoryCountValidationError('Bu barkod zaten bekleyen listede.');
    }

    const result = this.db
      .prepare(
        `INSERT INTO inventory_unknown_scans (
          count_id, raw_code, normalized_code, barcode_type, gtin,
          serial_no, lot_no, expiry_date, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Bekliyor')`
      )
      .run(
        countId,
        parsed.raw,
        parsed.normalized,
        parsed.type,
        parsed.gtin || null,
        parsed.serialNo || null,
        parsed.lotNo || null,
        parsed.expiryDate || null,
        note?.trim() || null
      );

    this.db
      .prepare(`UPDATE inventory_counts SET updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(countId);

    return this.db
      .prepare(`SELECT * FROM inventory_unknown_scans WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as Record<string, unknown>;
  }

  updateItemQuantity(
    countId: number,
    input: UpdateItemQuantityInput,
    userId: number
  ): Record<string, unknown> {
    const count = this.getCountRow(countId);
    if (count.status !== 'Devam Ediyor') {
      throw new InventoryCountValidationError('Sadece devam eden sayımda düzeltme yapılabilir.');
    }
    if (input.counted_quantity < 0) {
      throw new InventoryCountValidationError('Sayılan adet negatif olamaz.');
    }

    const item = this.db
      .prepare(`SELECT * FROM inventory_count_items WHERE id = ? AND count_id = ?`)
      .get(input.item_id, countId) as Record<string, unknown> | undefined;
    if (!item) throw new InventoryCountValidationError('Sayım kalemi bulunamadı.');

    const hasSerialScans = this.db
      .prepare(
        `SELECT COUNT(*) as c FROM inventory_count_scans
         WHERE count_id = ? AND product_id = ? AND serial_no IS NOT NULL AND serial_no != '' AND scan_result = 'ok'`
      )
      .get(countId, item.product_id) as { c: number };

    if (Number(hasSerialScans.c) > 0 && input.counted_quantity !== Number(item.counted_quantity)) {
      // allowed but flagged via audit on handler
    }

    const expected = Number(item.expected_quantity ?? 0);
    const note = input.note?.trim();
    this.db
      .prepare(
        `UPDATE inventory_count_items
         SET counted_quantity = ?,
             notes = CASE WHEN ? IS NOT NULL THEN COALESCE(notes || ' | ', '') || ? ELSE notes END,
             last_scanned_at = datetime('now', 'localtime'),
             updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(input.counted_quantity, note, note ? `Manuel: ${note}` : null, input.item_id);

    this.updateItemMetrics(input.item_id, expected, input.counted_quantity);

    this.db
      .prepare(
        `INSERT INTO inventory_count_scans (
          count_id, product_id, raw_code, normalized_code, barcode_type, scan_result, created_by
        ) VALUES (?, ?, 'MANUEL', 'MANUEL', 'BARCODE', 'manual', ?)`
      )
      .run(countId, item.product_id, userId);

    this.db
      .prepare(`UPDATE inventory_counts SET updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(countId);

    const updated = this.db
      .prepare(
        `SELECT ici.*, p.name as product_name, p.product_type, p.brand, p.model, p.shelf_location
         FROM inventory_count_items ici
         INNER JOIN products p ON p.id = ici.product_id
         WHERE ici.id = ?`
      )
      .get(input.item_id) as Record<string, unknown>;

    return this.mapItemRow(updated);
  }

  resolveUnknownScan(countId: number, input: ResolveUnknownInput, userId: number): Record<string, unknown> {
    const count = this.getCountRow(countId);
    if (count.status !== 'Devam Ediyor' && count.status !== 'Tamamlandı') {
      throw new InventoryCountValidationError('Bu sayım için işlem yapılamaz.');
    }

    const unknown = this.db
      .prepare(`SELECT * FROM inventory_unknown_scans WHERE id = ? AND count_id = ?`)
      .get(input.unknown_id, countId) as Record<string, unknown> | undefined;
    if (!unknown) throw new InventoryCountValidationError('Bekleyen barkod bulunamadı.');

    if (input.action === 'remove') {
      this.db.prepare(`DELETE FROM inventory_unknown_scans WHERE id = ?`).run(input.unknown_id);
      return { removed: true };
    }

    if (!input.product_id) {
      throw new InventoryCountValidationError('Ürün seçimi zorunludur.');
    }

    const product = this.productService.getById(input.product_id);
    if (!product) throw new InventoryCountValidationError('Ürün bulunamadı.');

    if (!this.productMatchesScope(product, count)) {
      throw new InventoryCountValidationError('Seçilen ürün sayım kapsamına dahil değil.');
    }

    this.db
      .prepare(
        `UPDATE inventory_unknown_scans SET status = 'Çözüldü', resolved_product_id = ? WHERE id = ?`
      )
      .run(input.product_id, input.unknown_id);

    const item = this.ensureItemForProduct(countId, product);
    const itemId = Number(item.id);
    const expected = Number(item.expected_quantity ?? 0);
    let counted = Number(item.counted_quantity ?? 0);

    if (unknown.serial_no) {
      const dup = this.db
        .prepare(
          `SELECT id FROM inventory_count_scans
           WHERE count_id = ? AND product_id = ? AND serial_no = ? AND scan_result = 'ok'`
        )
        .get(countId, input.product_id, unknown.serial_no);
      if (!dup) counted += 1;
    } else {
      counted += 1;
    }

    this.db
      .prepare(
        `UPDATE inventory_count_items
         SET counted_quantity = ?, last_scanned_at = datetime('now', 'localtime'),
             updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(counted, itemId);
    this.updateItemMetrics(itemId, expected, counted);

    this.db
      .prepare(
        `INSERT INTO inventory_count_scans (
          count_id, product_id, raw_code, normalized_code, barcode_type,
          gtin, serial_no, lot_no, expiry_date, scan_result, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'resolved_unknown', ?)`
      )
      .run(
        countId,
        input.product_id,
        unknown.raw_code,
        unknown.normalized_code,
        unknown.barcode_type,
        unknown.gtin,
        unknown.serial_no,
        unknown.lot_no,
        unknown.expiry_date,
        userId
      );

    return this.getCountDetail(countId);
  }

  completeCount(countId: number): Record<string, unknown> {
    const count = this.getCountRow(countId);
    if (count.status !== 'Devam Ediyor') {
      throw new InventoryCountValidationError('Sadece devam eden sayım tamamlanabilir.');
    }

    this.db
      .prepare(
        `UPDATE inventory_counts
         SET status = 'Tamamlandı', completed_at = datetime('now', 'localtime'),
             updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(countId);

    return this.getCountDetail(countId);
  }

  applyAdjustments(countId: number, userId: number): {
    adjustedItems: number;
    countNo: string;
  } {
    const count = this.getCountRow(countId);
    if (count.status !== 'Tamamlandı') {
      throw new InventoryCountValidationError('Farklar sadece tamamlanmış sayımlarda işlenebilir.');
    }

    const items = this.db
      .prepare(
        `SELECT ici.*, p.stock_quantity as current_stock
         FROM inventory_count_items ici
         INNER JOIN products p ON p.id = ici.product_id
         WHERE ici.count_id = ? AND ici.difference_quantity != 0`
      )
      .all(countId) as Array<Record<string, unknown>>;

    if (!items.length) {
      throw new InventoryCountValidationError('İşlenecek stok farkı bulunamadı.');
    }

    const countNo = String(count.count_no);

    const run = this.db.transaction(() => {
      const updateStock = this.db.prepare(
        `UPDATE products SET stock_quantity = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      );
      const insertMovement = this.db.prepare(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, notes)
         VALUES (?, 'Sayım Farkı', ?, 'inventory_count', ?, ?)`
      );

      let adjusted = 0;
      for (const item of items) {
        const productId = Number(item.product_id);
        const oldStock = Number(item.current_stock ?? 0);
        const newStock = Number(item.counted_quantity ?? 0);
        const diff = newStock - oldStock;
        if (diff === 0) continue;

        updateStock.run(newStock, productId);
        const note = `Sayım: ${countNo} | Eski: ${oldStock} | Yeni: ${newStock} | Fark: ${diff >= 0 ? '+' : ''}${diff}`;
        insertMovement.run(productId, diff, countId, note);
        adjusted += 1;
      }

      this.db
        .prepare(
          `UPDATE inventory_counts
           SET status = 'Farklar İşlendi', adjusted_at = datetime('now', 'localtime'),
               updated_at = datetime('now', 'localtime')
           WHERE id = ?`
        )
        .run(countId);

      return adjusted;
    });

    const adjustedItems = run();
    return { adjustedItems, countNo };
  }

  cancelCount(countId: number): { cancelled: boolean } {
    const count = this.getCountRow(countId);
    if (count.status === 'Farklar İşlendi') {
      throw new InventoryCountValidationError('Farkları işlenmiş sayım iptal edilemez.');
    }
    if (count.status === 'İptal Edildi') {
      throw new InventoryCountValidationError('Sayım zaten iptal edilmiş.');
    }

    this.db
      .prepare(
        `UPDATE inventory_counts
         SET status = 'İptal Edildi', updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(countId);
    return { cancelled: true };
  }

  buildPrintDocument(countId: number): { html: string; title: string } {
    const detail = this.getCountDetail(countId);
    const company = this.db.prepare(`SELECT name FROM companies WHERE is_default = 1 LIMIT 1`).get() as
      | { name: string }
      | undefined;
    const companyName = company?.name || 'Woontegra Optik';
    const items = (detail.items as Record<string, unknown>[]) || [];
    const summary = detail.summary as Record<string, unknown>;

    const renderRows = (rows: Record<string, unknown>[]) =>
      rows
        .map(
          (i) => `
      <tr>
        <td>${String(i.barcode || '-')}</td>
        <td>${String(i.product_name)}</td>
        <td class="num">${i.expected_quantity}</td>
        <td class="num">${i.counted_quantity}</td>
        <td class="num">${i.difference_quantity}</td>
        <td>${String(i.status)}</td>
      </tr>`
        )
        .join('');

    const missing = items.filter((i) => i.status === 'Eksik');
    const excess = items.filter((i) => i.status === 'Fazla');
    const unscanned = items.filter((i) => i.status === 'Sayılmadı');

    const section = (title: string, rows: Record<string, unknown>[]) =>
      rows.length
        ? `<h3>${title} (${rows.length})</h3>
      <table><thead><tr><th>Barkod</th><th>Ürün</th><th>Beklenen</th><th>Sayılan</th><th>Fark</th><th>Durum</th></tr></thead>
      <tbody>${renderRows(rows)}</tbody></table>`
        : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sayım Raporu</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 12px; color: #222; }
      h2 { text-align: center; margin: 4px 0 12px; font-size: 14px; }
      h3 { font-size: 12px; margin: 14px 0 6px; }
      .meta div { margin: 2px 0; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
      th { background: #f5f5f5; }
      .num { text-align: right; }
      .summary { margin: 10px 0; padding: 8px; background: #f9f9f9; border: 1px solid #ddd; }
    </style></head><body>
      <h2>ENVANTER / STOK SAYIM RAPORU</h2>
      <div class="meta">
        <div><strong>Firma:</strong> ${companyName}</div>
        <div><strong>Sayım No:</strong> ${String(detail.count_no)}</div>
        <div><strong>Sayım Adı:</strong> ${String(detail.name)}</div>
        <div><strong>Tarih:</strong> ${String(detail.count_date)}</div>
        <div><strong>Kullanıcı:</strong> ${String(detail.created_by_name || '-')}</div>
        <div><strong>Kapsam:</strong> ${String(detail.scope_label)}</div>
        <div><strong>Durum:</strong> ${String(detail.status)}</div>
      </div>
      <div class="summary">
        Ürün çeşidi: ${summary.totalKinds} |
        Beklenen: ${summary.totalExpected} |
        Sayılan: ${summary.totalCounted} |
        Eksik çeşit: ${summary.missingKinds} |
        Fazla çeşit: ${summary.excessKinds} |
        Sayılmayan: ${summary.unscannedKinds} |
        Bilinmeyen barkod: ${summary.unknownCount}
      </div>
      ${section('Eksik Ürünler', missing)}
      ${section('Fazla Ürünler', excess)}
      ${section('Sayılmayan Ürünler', unscanned)}
    </body></html>`;

    return { html, title: `Sayım Raporu — ${String(detail.count_no)}` };
  }

  exportCountToExcel(countId: number, filePath: string): { exported: boolean; rowCount: number } {
    const detail = this.getCountDetail(countId);
    const items = (detail.items as Record<string, unknown>[]) || [];
    const unknowns = (detail.unknowns as Record<string, unknown>[]) || [];

    const rows = items.map((i) => ({
      'Sayım No': detail.count_no,
      Barkod: i.barcode || '',
      'Ürün Adı': i.product_name,
      'Ürün Tipi': i.product_type,
      Marka: i.brand || '',
      Model: i.model || '',
      'Raf / Konum': i.shelf_location || '',
      'Beklenen Stok': i.expected_quantity,
      'Sayılan Stok': i.counted_quantity,
      Fark: i.difference_quantity,
      Durum: i.status,
      'Son Okutma': i.last_scanned_at || '',
      Not: i.notes || '',
    }));

    const unknownRows = unknowns.map((u) => ({
      'Okunan Barkod': u.raw_code,
      'Temizlenmiş': u.normalized_code,
      Tip: u.barcode_type,
      GTIN: u.gtin || '',
      'Seri No': u.serial_no || '',
      'Lot No': u.lot_no || '',
      SKT: u.expiry_date || '',
      'Okutma Zamanı': u.scanned_at,
      Not: u.notes || '',
      Durum: u.status,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sayım Kalemleri');
    if (unknownRows.length) {
      const ws2 = XLSX.utils.json_to_sheet(unknownRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'Bilinmeyen Barkodlar');
    }
    XLSX.writeFile(wb, filePath);
    return { exported: true, rowCount: rows.length };
  }

  getCountDifferencesReport(filters: { date_from?: string; date_to?: string } = {}): Record<string, unknown> {
    let sql = `
      SELECT c.count_no, c.name, c.count_date, c.status,
             c.count_type, c.product_type_filter, c.category_filter, c.brand_filter, c.location_filter,
             ici.barcode, p.name as product_name, p.product_type, p.brand, p.model, p.shelf_location,
             ici.expected_quantity, ici.counted_quantity, ici.difference_quantity, ici.status as item_status,
             ici.last_scanned_at, ici.notes
      FROM inventory_count_items ici
      INNER JOIN inventory_counts c ON c.id = ici.count_id
      INNER JOIN products p ON p.id = ici.product_id
      WHERE c.status IN ('Tamamlandı', 'Farklar İşlendi')
      AND ici.difference_quantity != 0
    `;
    const params: unknown[] = [];
    if (filters.date_from) {
      sql += ` AND date(c.count_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(c.count_date) <= date(?)`;
      params.push(filters.date_to);
    }
    sql += ` ORDER BY c.count_date DESC, p.name LIMIT 2000`;
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return {
      reportType: 'countDifferences',
      rows: rows.map((r) => ({ ...r, scope_label: buildScopeLabel(r) })),
      summary: { rowCount: rows.length },
    };
  }
}
