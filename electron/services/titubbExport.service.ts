import * as XLSX from 'xlsx';
import type Database from 'better-sqlite3';
import type {
  TitubbExportInput,
  TitubbListFilters,
  TitubbMarkIgnoredInput,
  TitubbPendingRow,
  TitubbValidateResult,
} from '../types/titubb';

export class TitubbExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TitubbExportError';
  }
}

/** Merkezi Excel kolon eşlemesi — ÜTS şablonu değişirse buradan güncellenir */
export const TITUBB_EXCEL_COLUMN_MAP: Array<{ header: string; field: keyof TitubbPendingRow | 'supplier_name' | 'batch_no' | 'document_no' | 'entry_date' | 'note' }> = [
  { header: 'Ürün Adı', field: 'product_name' },
  { header: 'Ürün Tipi', field: 'product_type' },
  { header: 'Barkod / GTIN', field: 'barcode' },
  { header: 'UBB Kodu', field: 'ubb_code' },
  { header: 'ÜTS Ürün No', field: 'uts_product_no' },
  { header: 'Seri No', field: 'serial_no' },
  { header: 'Lot No', field: 'lot_no' },
  { header: 'Son Kullanma Tarihi', field: 'expiry_date' },
  { header: 'Adet', field: 'quantity' },
  { header: 'Tedarikçi', field: 'supplier_name' },
  { header: 'Belge No', field: 'document_no' },
  { header: 'Mal Kabul Fiş No', field: 'batch_no' },
  { header: 'Mal Kabul Tarihi', field: 'entry_date' },
  { header: 'Not', field: 'note' },
];

export class TitubbExportService {
  constructor(private db: Database.Database) {}

  private generateExportNo(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const prefix = `TIT-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const row = this.db
      .prepare(`SELECT export_no FROM uts_titubb_exports WHERE export_no LIKE ? ORDER BY id DESC LIMIT 1`)
      .get(`${prefix}%`) as { export_no: string } | undefined;
    let seq = 1;
    if (row?.export_no) {
      const parts = row.export_no.split('-');
      const last = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(last)) seq = last + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private rowKey(stockEntryItemId: number): string {
    return `sei-${stockEntryItemId}`;
  }

  private isPreviouslyUploaded(productId: number, serialNo: string | null, lotNo: string | null): boolean {
    const row = this.db
      .prepare(
        `SELECT id FROM uts_titubb_export_items
         WHERE product_id = ? AND COALESCE(serial_no,'') = ? AND COALESCE(lot_no,'') = ?
         AND status = 'ÜTS''ye Yüklendi' LIMIT 1`
      )
      .get(productId, serialNo || '', lotNo || '');
    return !!row;
  }

  private getItemTitubbStatus(stockEntryItemId: number): string {
    const row = this.db
      .prepare(
        `SELECT status FROM uts_titubb_export_items
         WHERE stock_entry_item_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get(stockEntryItemId) as { status: string } | undefined;
    if (!row) return 'Bildirim Bekliyor';
    if (row.status === 'İşlem Dışı') return 'İşlem Dışı';
    if (row.status === 'ÜTS\'ye Yüklendi') return 'ÜTS\'ye Yüklendi';
    if (row.status === 'Excel Hazırlandı') return 'Excel Hazırlandı';
    if (row.status === 'Hatalı') return 'Hatalı';
    return 'Bildirim Bekliyor';
  }

  validateRow(row: Omit<TitubbPendingRow, 'missing_fields' | 'has_warnings' | 'titubb_status' | 'previously_uploaded'>): string[] {
    const missing: string[] = [];
    if (!row.product_name?.trim()) missing.push('Ürün adı');
    const gtin = row.gtin || row.barcode;
    if (!gtin?.trim()) missing.push('Barkod / GTIN');
    if (!row.ubb_code?.trim() && !row.uts_product_no?.trim()) missing.push('UBB veya ÜTS ürün no');
    if (row.product_type === 'Lens') {
      if (!row.lot_no?.trim()) missing.push('Lot no (Lens)');
    } else if (!row.serial_no?.trim() && !row.lot_no?.trim()) {
      missing.push('Seri no veya lot no');
    }
    if (!row.quantity || row.quantity <= 0) missing.push('Adet');
    if (!row.entry_date?.trim()) missing.push('Mal kabul / belge tarihi');
    return missing;
  }

  private mapDbRow(r: Record<string, unknown>): TitubbPendingRow {
    const stockEntryItemId = Number(r.stock_entry_item_id);
    const productId = Number(r.product_id);
    const serialNo = (r.serial_no as string) || null;
    const lotNo = (r.lot_no as string) || null;
    const previouslyUploaded = this.isPreviouslyUploaded(productId, serialNo, lotNo);
    const titubbStatus = previouslyUploaded
      ? 'ÜTS\'ye Yüklendi'
      : (this.getItemTitubbStatus(stockEntryItemId) as TitubbPendingRow['titubb_status']);

    const base = {
      row_key: this.rowKey(stockEntryItemId),
      product_id: productId,
      stock_entry_batch_id: Number(r.stock_entry_batch_id),
      stock_entry_item_id: stockEntryItemId,
      product_name: String(r.product_name),
      product_type: String(r.product_type),
      barcode: (r.barcode as string) || (r.uts_barcode as string) || undefined,
      gtin: (r.uts_barcode as string) || (r.barcode as string) || undefined,
      ubb_code: (r.ubb_code as string) || undefined,
      uts_product_no: (r.uts_product_no as string) || undefined,
      serial_no: serialNo || undefined,
      lot_no: lotNo || undefined,
      expiry_date: (r.uts_expiry_date as string) || undefined,
      supplier_name: (r.supplier_name as string) || undefined,
      batch_no: (r.batch_no as string) || undefined,
      document_no: (r.document_no as string) || undefined,
      quantity: Number(r.quantity ?? 1),
      entry_date: (r.entry_date as string) || undefined,
    };

    const missing_fields = this.validateRow(base);
    return {
      ...base,
      titubb_status: titubbStatus,
      missing_fields,
      has_warnings: missing_fields.length > 0,
      previously_uploaded: previouslyUploaded,
    };
  }

  listPending(filters: TitubbListFilters = {}): TitubbPendingRow[] {
    let sql = `
      SELECT sei.id as stock_entry_item_id, seb.id as stock_entry_batch_id,
             seb.batch_no, seb.document_no, seb.entry_date,
             sei.product_id, sei.quantity, sei.barcode as item_barcode,
             p.name as product_name, p.product_type, p.ubb_code, p.uts_product_no,
             p.uts_barcode, p.serial_no, p.lot_no, p.uts_expiry_date,
             pb.barcode as primary_barcode, s.name as supplier_name
      FROM stock_entry_items sei
      INNER JOIN stock_entry_batches seb ON seb.id = sei.batch_id
      INNER JOIN products p ON p.id = sei.product_id
      LEFT JOIN suppliers s ON s.id = seb.supplier_id
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
      WHERE (
        p.uts_tracking_required = 1 OR
        (p.ubb_code IS NOT NULL AND p.ubb_code != '') OR
        (p.uts_product_no IS NOT NULL AND p.uts_product_no != '') OR
        (p.uts_barcode IS NOT NULL AND p.uts_barcode != '')
      )
      AND NOT EXISTS (
        SELECT 1 FROM uts_titubb_export_items tei
        WHERE tei.stock_entry_item_id = sei.id AND tei.status = 'İşlem Dışı'
      )
    `;
    const params: unknown[] = [];

    if (filters.date_from) {
      sql += ` AND date(seb.entry_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(seb.entry_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.product_type) {
      sql += ` AND p.product_type = ?`;
      params.push(filters.product_type);
    }
    if (filters.supplier_id) {
      sql += ` AND seb.supplier_id = ?`;
      params.push(filters.supplier_id);
    }
    if (filters.stock_entry_batch_id) {
      sql += ` AND seb.id = ?`;
      params.push(filters.stock_entry_batch_id);
    }
    if (filters.batch_no?.trim()) {
      sql += ` AND seb.batch_no LIKE ?`;
      params.push(`%${filters.batch_no.trim()}%`);
    }
    if (filters.ubb_code?.trim()) {
      sql += ` AND p.ubb_code LIKE ?`;
      params.push(`%${filters.ubb_code.trim()}%`);
    }
    if (filters.uts_product_no?.trim()) {
      sql += ` AND p.uts_product_no LIKE ?`;
      params.push(`%${filters.uts_product_no.trim()}%`);
    }
    if (filters.barcode?.trim()) {
      sql += ` AND (pb.barcode LIKE ? OR p.uts_barcode LIKE ? OR sei.barcode LIKE ?)`;
      const term = `%${filters.barcode.trim()}%`;
      params.push(term, term, term);
    }
    if (filters.serial_no?.trim()) {
      sql += ` AND p.serial_no LIKE ?`;
      params.push(`%${filters.serial_no.trim()}%`);
    }
    if (filters.lot_no?.trim()) {
      sql += ` AND p.lot_no LIKE ?`;
      params.push(`%${filters.lot_no.trim()}%`);
    }

    sql += ` ORDER BY seb.entry_date DESC, sei.id DESC LIMIT 2000`;

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    let mapped = rows.map((r) =>
      this.mapDbRow({
        ...r,
        barcode: r.item_barcode || r.primary_barcode,
      })
    );

    if (filters.status) {
      mapped = mapped.filter((r) => r.titubb_status === filters.status);
    }
    if (filters.missing_only) {
      mapped = mapped.filter((r) => r.has_warnings);
    }
    mapped = mapped.filter((r) => !r.previously_uploaded || filters.status === 'ÜTS\'ye Yüklendi');

    return mapped;
  }

  validateRows(rowKeys: string[]): TitubbValidateResult {
    const all = this.listPending({});
    const selected = all.filter((r) => rowKeys.includes(r.row_key));
    const validCount = selected.filter((r) => r.missing_fields.length === 0).length;
    return {
      rows: selected,
      validCount,
      invalidCount: selected.length - validCount,
    };
  }

  countPending(): number {
    return this.listPending({ status: 'Bildirim Bekliyor' }).filter((r) => !r.previously_uploaded).length;
  }

  private rowToExcelObject(row: TitubbPendingRow, note?: string): Record<string, string | number> {
    const obj: Record<string, string | number> = {};
    for (const col of TITUBB_EXCEL_COLUMN_MAP) {
      let val: unknown;
      if (col.field === 'note') val = note || (row.has_warnings ? 'Eksik alan olabilir' : '');
      else if (col.field === 'barcode') val = row.gtin || row.barcode || '';
      else val = row[col.field as keyof TitubbPendingRow];
      obj[col.header] = val == null ? '' : (typeof val === 'number' ? val : String(val));
    }
    return obj;
  }

  exportExcel(input: TitubbExportInput, filePath: string, userId: number): {
    exportId: number;
    exportNo: string;
    recordCount: number;
    filePath: string;
    warnings: string[];
  } {
    const all = this.listPending({});
    const selected = all.filter((r) => input.row_keys.includes(r.row_key));
    if (!selected.length) throw new TitubbExportError('Dışa aktarılacak kayıt seçilmedi.');

    const warnings: string[] = [];
    const invalid = selected.filter((r) => r.missing_fields.length > 0);
    if (invalid.length && !input.allow_incomplete) {
      throw new TitubbExportError(
        `${invalid.length} kayıtta eksik alan var. "Eksik alanlara rağmen aktar" seçeneğini kullanın.`
      );
    }
    if (invalid.length) {
      warnings.push(`${invalid.length} kayıt eksik alan içeriyor; dosya hatalı olabilir.`);
    }

    const dup = selected.filter((r) => r.previously_uploaded);
    if (dup.length) {
      warnings.push(`${dup.length} kayıt daha önce ÜTS'ye yüklendi olarak işaretlenmiş.`);
    }

    const exportNo = this.generateExportNo();
    const excelRows = selected.map((r) => this.rowToExcelObject(r, input.notes));

    const run = this.db.transaction(() => {
      const exp = this.db
        .prepare(
          `INSERT INTO uts_titubb_exports (export_no, file_path, record_count, status, notes, created_by)
           VALUES (?, ?, ?, 'Excel Hazırlandı', ?, ?)`
        )
        .run(exportNo, filePath, selected.length, input.notes || null, userId);
      const exportId = Number(exp.lastInsertRowid);

      const insertItem = this.db.prepare(
        `INSERT INTO uts_titubb_export_items (
          export_id, product_id, stock_entry_batch_id, stock_entry_item_id,
          barcode, gtin, serial_no, lot_no, expiry_date, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const row of selected) {
        const status = row.missing_fields.length > 0 ? 'Hatalı' : 'Excel Hazırlandı';
        insertItem.run(
          exportId,
          row.product_id,
          row.stock_entry_batch_id ?? null,
          row.stock_entry_item_id ?? null,
          row.barcode || null,
          row.gtin || null,
          row.serial_no || null,
          row.lot_no || null,
          row.expiry_date || null,
          status,
          row.missing_fields.length ? row.missing_fields.join(', ') : null
        );
        this.db
          .prepare(`UPDATE products SET uts_status = 'Hazır', updated_at = datetime('now', 'localtime') WHERE id = ?`)
          .run(row.product_id);
      }

      return exportId;
    });

    const exportId = run();
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TİTUBB Bildirimi');
    XLSX.writeFile(wb, filePath);

    return { exportId, exportNo, recordCount: selected.length, filePath, warnings };
  }

  listExports(): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT e.*, u.full_name as created_by_name
         FROM uts_titubb_exports e
         LEFT JOIN users u ON u.id = e.created_by
         ORDER BY e.exported_at DESC LIMIT 200`
      )
      .all() as Record<string, unknown>[];
  }

  getExportDetail(exportId: number): Record<string, unknown> | null {
    const exp = this.db
      .prepare(
        `SELECT e.*, u.full_name as created_by_name FROM uts_titubb_exports e
         LEFT JOIN users u ON u.id = e.created_by WHERE e.id = ?`
      )
      .get(exportId) as Record<string, unknown> | undefined;
    if (!exp) return null;
    const items = this.db
      .prepare(
        `SELECT tei.*, p.name as product_name, p.product_type
         FROM uts_titubb_export_items tei
         INNER JOIN products p ON p.id = tei.product_id
         WHERE tei.export_id = ? ORDER BY tei.id`
      )
      .all(exportId);
    return { ...exp, items };
  }

  markUploaded(exportId: number, userId: number): { updated: number } {
    const exp = this.db
      .prepare(`SELECT * FROM uts_titubb_exports WHERE id = ?`)
      .get(exportId) as Record<string, unknown> | undefined;
    if (!exp) throw new TitubbExportError('Dışa aktarım kaydı bulunamadı.');
    if (exp.status === 'ÜTS\'ye Yüklendi') {
      throw new TitubbExportError('Bu dışa aktarım zaten yüklendi olarak işaretlenmiş.');
    }

    const run = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE uts_titubb_exports SET status = 'ÜTS''ye Yüklendi',
           uploaded_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(exportId);

      const items = this.db
        .prepare(`SELECT * FROM uts_titubb_export_items WHERE export_id = ?`)
        .all(exportId) as Record<string, unknown>[];

      for (const item of items) {
        this.db
          .prepare(`UPDATE uts_titubb_export_items SET status = 'ÜTS''ye Yüklendi' WHERE id = ?`)
          .run(item.id);
        this.db
          .prepare(
            `UPDATE products SET uts_status = 'İşlendi', updated_at = datetime('now', 'localtime') WHERE id = ?`
          )
          .run(item.product_id);
      }
      return items.length;
    });

    return { updated: run() };
  }

  markIgnored(input: TitubbMarkIgnoredInput): { ignored: number } {
    if (!input.row_keys?.length) throw new TitubbExportError('İşlem dışı bırakılacak kayıt seçilmedi.');

    const all = this.listPending({});
    let count = 0;
    const run = this.db.transaction(() => {
      for (const key of input.row_keys) {
        const row = all.find((r) => r.row_key === key);
        if (!row?.stock_entry_item_id) continue;

        const fakeExport = this.db
          .prepare(
            `INSERT INTO uts_titubb_exports (export_no, record_count, status, notes, created_by)
             VALUES (?, 0, 'İşlem Dışı', ?, NULL)`
          )
          .run(`IGNORE-${Date.now()}-${count}`, input.notes || 'İşlem dışı');
        const exportId = Number(fakeExport.lastInsertRowid);

        this.db
          .prepare(
            `INSERT INTO uts_titubb_export_items (
              export_id, product_id, stock_entry_batch_id, stock_entry_item_id,
              barcode, gtin, serial_no, lot_no, expiry_date, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'İşlem Dışı', ?)`
          )
          .run(
            exportId,
            row.product_id,
            row.stock_entry_batch_id ?? null,
            row.stock_entry_item_id,
            row.barcode || null,
            row.gtin || null,
            row.serial_no || null,
            row.lot_no || null,
            row.expiry_date || null,
            input.notes || null
          );
        count += 1;
      }
    });
    run();
    return { ignored: count };
  }

  getDefaultFileName(): string {
    return `titubb-bildirimi-${new Date().toISOString().slice(0, 10)}.xlsx`;
  }
}
