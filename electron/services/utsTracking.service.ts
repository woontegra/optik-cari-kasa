import * as XLSX from 'xlsx';
import type Database from 'better-sqlite3';
import type { UtsListFilters } from '../types/medula';
import type { UtsStatus } from '../types/medula';
import { UTS_STATUSES } from '../types/medula';

export class UtsTrackingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UtsTrackingError';
  }
}

export class UtsTrackingService {
  constructor(private db: Database.Database) {}

  listRecords(filters: UtsListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT p.id as product_id, p.name as product_name, p.product_type,
             pb.barcode, p.ubb_code, p.uts_product_no, p.serial_no, p.lot_no,
             p.uts_expiry_date, p.stock_quantity, p.uts_status, p.uts_note,
             p.updated_at as last_updated,
             s.sale_no, s.sale_date as last_sale_date,
             c.full_name as customer_name, c.tc_no as customer_tc,
             pr.prescription_no
      FROM products p
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
      LEFT JOIN sale_items si ON si.product_id = p.id
      LEFT JOIN sales s ON s.id = si.sale_id AND s.status != 'İptal edildi'
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
      WHERE (
        p.uts_tracking_required = 1 OR
        (p.ubb_code IS NOT NULL AND p.ubb_code != '') OR
        (p.uts_product_no IS NOT NULL AND p.uts_product_no != '')
      )
    `;
    const params: unknown[] = [];

    if (filters.search?.trim()) {
      sql += ` AND (p.name LIKE ? OR pb.barcode LIKE ? OR p.ubb_code LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term);
    }
    if (filters.ubb_code?.trim()) {
      sql += ` AND p.ubb_code LIKE ?`;
      params.push(`%${filters.ubb_code.trim()}%`);
    }
    if (filters.uts_product_no?.trim()) {
      sql += ` AND p.uts_product_no LIKE ?`;
      params.push(`%${filters.uts_product_no.trim()}%`);
    }
    if (filters.serial_no?.trim()) {
      sql += ` AND p.serial_no LIKE ?`;
      params.push(`%${filters.serial_no.trim()}%`);
    }
    if (filters.lot_no?.trim()) {
      sql += ` AND p.lot_no LIKE ?`;
      params.push(`%${filters.lot_no.trim()}%`);
    }
    if (filters.uts_status) {
      sql += ` AND p.uts_status = ?`;
      params.push(filters.uts_status);
    }
    if (filters.date_from) {
      sql += ` AND date(p.updated_at) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(p.updated_at) <= date(?)`;
      params.push(filters.date_to);
    }

    sql += ` GROUP BY p.id ORDER BY p.updated_at DESC, p.name`;

    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  updateStatus(productId: number, status: UtsStatus, note?: string): { id: number } {
    if (!UTS_STATUSES.includes(status)) {
      throw new UtsTrackingError('Geçersiz ÜTS durumu.');
    }

    const existing = this.db.prepare(`SELECT id FROM products WHERE id = ?`).get(productId);
    if (!existing) throw new UtsTrackingError('Ürün bulunamadı.');

    this.db
      .prepare(
        `UPDATE products SET uts_status = ?, uts_note = COALESCE(?, uts_note),
         updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(status, note?.trim() || null, productId);

    return { id: productId };
  }

  countIncompleteProducts(): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM products
         WHERE uts_tracking_required = 1
         AND (ubb_code IS NULL OR ubb_code = '' OR uts_product_no IS NULL OR uts_product_no = '')`
      )
      .get() as { count: number };
    return row.count;
  }

  exportExcel(filePath: string, filters: UtsListFilters = {}): { recordCount: number } {
    const records = this.listRecords(filters);
    const rows = records.map((r) => ({
      'Ürün Adı': r.product_name,
      'Ürün Tipi': r.product_type,
      Barkod: r.barcode || '',
      'UBB Kodu': r.ubb_code || '',
      'ÜTS Ürün No': r.uts_product_no || '',
      'Seri No': r.serial_no || '',
      'Lot No': r.lot_no || '',
      'Son Kullanma Tarihi': r.uts_expiry_date || '',
      Stok: r.stock_quantity,
      'Satış No': r.sale_no || '',
      Müşteri: r.customer_name || '',
      'T.C.': r.customer_tc || '',
      'Reçete No': r.prescription_no || '',
      'ÜTS Durum': r.uts_status || '',
      Not: r.uts_note || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ÜTS UBB');
    XLSX.writeFile(wb, filePath);
    return { recordCount: rows.length };
  }

  getDefaultFileName(): string {
    const today = new Date().toISOString().slice(0, 10);
    return `uts-ubb-takip-${today}.xlsx`;
  }
}
