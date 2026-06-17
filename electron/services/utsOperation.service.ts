import * as XLSX from 'xlsx';
import type Database from 'better-sqlite3';
import { parseScannedCode } from './barcodeParser.service';
import type {
  UtsCreateOperationInput,
  UtsImportRow,
  UtsMarkIgnoredInput,
  UtsOperationHistoryFilters,
  UtsOperationListFilters,
  UtsOperationType,
  UtsPendingRow,
  UtsReportFilters,
} from '../types/utsOperation';

export class UtsOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UtsOperationError';
  }
}

export const UTS_EXCEL_COLUMN_MAP: Array<{ header: string; key: string }> = [
  { header: 'İşlem Türü', key: 'operation_type_label' },
  { header: 'Ürün Adı', key: 'product_name' },
  { header: 'Barkod / GTIN', key: 'barcode' },
  { header: 'UBB Kodu', key: 'ubb_code' },
  { header: 'ÜTS Ürün No', key: 'uts_product_no' },
  { header: 'Seri No', key: 'serial_no' },
  { header: 'Lot No', key: 'lot_no' },
  { header: 'Son Kullanma Tarihi', key: 'expiry_date' },
  { header: 'Adet', key: 'quantity' },
  { header: 'Müşteri', key: 'customer_name' },
  { header: 'Tedarikçi', key: 'supplier_name' },
  { header: 'Belge No', key: 'document_no' },
  { header: 'Kaynak İşlem No', key: 'source_ref' },
  { header: 'Not', key: 'notes' },
];

const OP_LABELS: Record<string, string> = {
  ALMA_BILDIRIMI: 'Alma Bildirimi',
  VERME_BILDIRIMI: 'Verme Bildirimi',
  IADE_BILDIRIMI: 'İade Bildirimi',
  RED_BILDIRIMI: 'Red Bildirimi',
  TITUBB_BILDIRIMI: 'TİTUBB Bildirimi',
  MANUEL_DUZELTME: 'Manuel Düzeltme',
};

function parseLineNote(lineNote: string | null | undefined): {
  serial_no?: string;
  lot_no?: string;
  expiry_date?: string;
} {
  if (!lineNote) return {};
  return {
    serial_no: lineNote.match(/Seri:\s*([^|]+)/)?.[1]?.trim(),
    lot_no: lineNote.match(/Lot:\s*([^|]+)/)?.[1]?.trim(),
    expiry_date: lineNote.match(/SKT:\s*([^|]+)/)?.[1]?.trim(),
  };
}

export class UtsOperationService {
  constructor(private db: Database.Database) {}

  private generateOperationNo(type: UtsOperationType): string {
    const prefixMap: Record<string, string> = {
      ALMA_BILDIRIMI: 'UTS-ALMA',
      VERME_BILDIRIMI: 'UTS-VER',
      IADE_BILDIRIMI: 'UTS-IADE',
      RED_BILDIRIMI: 'UTS-RED',
      TITUBB_BILDIRIMI: 'UTS-TIT',
      MANUEL_DUZELTME: 'UTS-MAN',
    };
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const prefix = `${prefixMap[type] || 'UTS'}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const row = this.db
      .prepare(`SELECT operation_no FROM uts_operations WHERE operation_no LIKE ? ORDER BY id DESC LIMIT 1`)
      .get(`${prefix}%`) as { operation_no: string } | undefined;
    let seq = 1;
    if (row?.operation_no) {
      const last = parseInt(row.operation_no.split('-').pop() || '0', 10);
      if (Number.isFinite(last)) seq = last + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private isSourceClosed(sourceType: string, sourceId: number, operationType: UtsOperationType): boolean {
    const row = this.db
      .prepare(
        `SELECT status FROM uts_operations
         WHERE source_type = ? AND source_id = ? AND operation_type = ?
         AND status IN ('ÜTS''de İşlendi', 'İşlem Dışı')
         ORDER BY id DESC LIMIT 1`
      )
      .get(sourceType, sourceId, operationType) as { status: string } | undefined;
    return !!row;
  }

  private isSerialProcessed(
    productId: number,
    serialNo: string | null,
    operationType: UtsOperationType
  ): boolean {
    if (!serialNo?.trim()) return false;
    const row = this.db
      .prepare(
        `SELECT uoi.id FROM uts_operation_items uoi
         INNER JOIN uts_operations uo ON uo.id = uoi.operation_id
         WHERE uoi.product_id = ? AND uoi.serial_no = ? AND uo.operation_type = ?
         AND uo.status IN ('ÜTS''de İşlendi', 'İşlem Dışı') LIMIT 1`
      )
      .get(productId, serialNo.trim(), operationType);
    return !!row;
  }

  validateRow(
    row: Partial<UtsPendingRow>,
    operationType: UtsOperationType
  ): string[] {
    const missing: string[] = [];
    if (!row.product_name?.trim()) missing.push('Ürün adı');
    const gtin = row.gtin || row.barcode;
    if (!gtin?.trim()) missing.push('Barkod / GTIN');
    if (!row.ubb_code?.trim() && !row.uts_product_no?.trim()) missing.push('UBB veya ÜTS ürün no');
    if (row.product_type === 'Lens' || row.product_type === 'Kontakt Lens') {
      if (!row.lot_no?.trim()) missing.push('Lot no');
    } else if (!row.serial_no?.trim() && !row.lot_no?.trim()) {
      missing.push('Seri no veya lot no');
    }
    if (operationType === 'VERME_BILDIRIMI' && !row.customer_name?.trim()) {
      missing.push('Müşteri bilgisi');
    }
    if (
      (operationType === 'ALMA_BILDIRIMI' || operationType === 'IADE_BILDIRIMI') &&
      !row.supplier_name?.trim() &&
      operationType === 'ALMA_BILDIRIMI'
    ) {
      if (!row.batch_no?.trim() && !row.document_no?.trim()) missing.push('Belge / mal kabul fişi');
    }
    return missing;
  }

  listPendingReceive(filters: UtsOperationListFilters = {}): UtsPendingRow[] {
    let sql = `
      SELECT sei.id as source_id, sei.product_id, sei.quantity, sei.barcode as item_barcode,
             seb.id as stock_entry_batch_id, seb.batch_no, seb.document_no, seb.entry_date, seb.supplier_id,
             p.name as product_name, p.product_type, p.ubb_code, p.uts_product_no, p.uts_barcode,
             p.serial_no, p.lot_no, p.uts_expiry_date, pb.barcode as primary_barcode, s.name as supplier_name
      FROM stock_entry_items sei
      INNER JOIN stock_entry_batches seb ON seb.id = sei.batch_id
      INNER JOIN products p ON p.id = sei.product_id
      LEFT JOIN suppliers s ON s.id = seb.supplier_id
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
      WHERE (
        p.uts_tracking_required = 1 OR p.ubb_code IS NOT NULL AND p.ubb_code != '' OR
        p.uts_product_no IS NOT NULL AND p.uts_product_no != '' OR
        p.uts_barcode IS NOT NULL AND p.uts_barcode != ''
      )
    `;
    const params: unknown[] = [];
    if (filters.date_from) { sql += ` AND date(seb.entry_date) >= date(?)`; params.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND date(seb.entry_date) <= date(?)`; params.push(filters.date_to); }
    if (filters.supplier_id) { sql += ` AND seb.supplier_id = ?`; params.push(filters.supplier_id); }
    if (filters.stock_entry_batch_id) { sql += ` AND seb.id = ?`; params.push(filters.stock_entry_batch_id); }
    if (filters.ubb_code?.trim()) { sql += ` AND p.ubb_code LIKE ?`; params.push(`%${filters.ubb_code.trim()}%`); }
    if (filters.uts_product_no?.trim()) { sql += ` AND p.uts_product_no LIKE ?`; params.push(`%${filters.uts_product_no.trim()}%`); }
    if (filters.serial_no?.trim()) { sql += ` AND p.serial_no LIKE ?`; params.push(`%${filters.serial_no.trim()}%`); }
    if (filters.lot_no?.trim()) { sql += ` AND p.lot_no LIKE ?`; params.push(`%${filters.lot_no.trim()}%`); }
    if (filters.product_type) { sql += ` AND p.product_type = ?`; params.push(filters.product_type); }
    sql += ` ORDER BY seb.entry_date DESC LIMIT 2000`;

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows
      .map((r) => {
        const sourceId = Number(r.source_id);
        const productId = Number(r.product_id);
        const serialNo = (r.serial_no as string) || undefined;
        const closed = this.isSourceClosed('stock_entry_item', sourceId, 'ALMA_BILDIRIMI');
        const serialDone = this.isSerialProcessed(productId, serialNo || null, 'ALMA_BILDIRIMI');
        if (closed || serialDone) return null;

        const base: UtsPendingRow = {
          row_key: `recv-sei-${sourceId}`,
          source_type: 'stock_entry_item',
          source_id: sourceId,
          product_id: productId,
          product_name: String(r.product_name),
          product_type: String(r.product_type),
          barcode: (r.item_barcode as string) || (r.primary_barcode as string) || undefined,
          gtin: (r.uts_barcode as string) || (r.item_barcode as string) || undefined,
          ubb_code: (r.ubb_code as string) || undefined,
          uts_product_no: (r.uts_product_no as string) || undefined,
          serial_no: serialNo,
          lot_no: (r.lot_no as string) || undefined,
          expiry_date: (r.uts_expiry_date as string) || undefined,
          quantity: Number(r.quantity ?? 1),
          supplier_id: r.supplier_id ? Number(r.supplier_id) : undefined,
          supplier_name: (r.supplier_name as string) || undefined,
          stock_entry_batch_id: Number(r.stock_entry_batch_id),
          batch_no: (r.batch_no as string) || undefined,
          document_no: (r.document_no as string) || undefined,
          entry_date: (r.entry_date as string) || undefined,
          operation_date: (r.entry_date as string) || undefined,
          uts_status: 'Bekliyor',
          missing_fields: [],
          has_warnings: false,
        };
        base.missing_fields = this.validateRow(base, 'ALMA_BILDIRIMI');
        base.has_warnings = base.missing_fields.length > 0;
        return base;
      })
      .filter((r): r is UtsPendingRow => {
        if (!r) return false;
        if (filters.missing_only && !r.has_warnings) return false;
        if (filters.status && r.uts_status !== filters.status) return false;
        if (filters.search?.trim()) {
          const term = filters.search.trim().toLowerCase();
          const hay = `${r.product_name} ${r.barcode} ${r.serial_no} ${r.batch_no}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      });
  }

  listPendingGive(filters: UtsOperationListFilters = {}): UtsPendingRow[] {
    let sql = `
      SELECT si.id as source_id, si.product_id, si.quantity, si.barcode, si.line_note,
             s.id as sale_id, s.sale_no, s.sale_date, s.status as sale_status, s.customer_id,
             c.full_name as customer_name, c.tc_no as customer_tc, c.institution_name,
             pr.prescription_no, pr.e_prescription_no,
             p.name as product_name, p.product_type, p.ubb_code, p.uts_product_no, p.uts_barcode,
             p.serial_no as product_serial, p.lot_no as product_lot, p.uts_expiry_date
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      INNER JOIN products p ON p.id = si.product_id
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
      WHERE s.status != 'İptal edildi'
      AND (
        p.uts_tracking_required = 1 OR p.ubb_code IS NOT NULL AND p.ubb_code != '' OR
        p.uts_product_no IS NOT NULL AND p.uts_product_no != ''
      )
    `;
    const params: unknown[] = [];
    if (filters.date_from) { sql += ` AND date(s.sale_date) >= date(?)`; params.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND date(s.sale_date) <= date(?)`; params.push(filters.date_to); }
    if (filters.customer_id) { sql += ` AND s.customer_id = ?`; params.push(filters.customer_id); }
    if (filters.sale_id) { sql += ` AND s.id = ?`; params.push(filters.sale_id); }
    if (filters.serial_no?.trim()) { sql += ` AND (si.line_note LIKE ? OR p.serial_no LIKE ?)`; params.push(`%${filters.serial_no}%`, `%${filters.serial_no}%`); }
    if (filters.lot_no?.trim()) { sql += ` AND (si.line_note LIKE ? OR p.lot_no LIKE ?)`; params.push(`%${filters.lot_no}%`, `%${filters.lot_no}%`); }
    sql += ` ORDER BY s.sale_date DESC LIMIT 2000`;

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows
      .map((r) => {
        const sourceId = Number(r.source_id);
        const productId = Number(r.product_id);
        const parsed = parseLineNote(r.line_note as string);
        const serialNo = parsed.serial_no || (r.product_serial as string) || undefined;
        const lotNo = parsed.lot_no || (r.product_lot as string) || undefined;
        const expiry = parsed.expiry_date || (r.uts_expiry_date as string) || undefined;

        if (this.isSourceClosed('sale_item', sourceId, 'VERME_BILDIRIMI')) return null;
        if (serialNo && this.isSerialProcessed(productId, serialNo, 'VERME_BILDIRIMI')) return null;

        const returned = this.db
          .prepare(
            `SELECT SUM(ri.quantity) as qty FROM return_items ri
             INNER JOIN returns ret ON ret.id = ri.return_id
             WHERE ri.sale_item_id = ? AND ret.status = 'Tamamlandı'`
          )
          .get(sourceId) as { qty: number } | undefined;
        if (returned?.qty && Number(returned.qty) >= Number(r.quantity)) return null;

        let warning: string | undefined;
        if (serialNo) {
          const inStock = this.db
            .prepare(`SELECT stock_quantity FROM products WHERE id = ?`)
            .get(productId) as { stock_quantity: number } | undefined;
          if ((inStock?.stock_quantity ?? 0) <= 0) warning = 'Seri stokta görünmüyor';
        }

        const base: UtsPendingRow = {
          row_key: `give-si-${sourceId}`,
          source_type: 'sale_item',
          source_id: sourceId,
          product_id: productId,
          product_name: String(r.product_name),
          product_type: String(r.product_type),
          barcode: (r.barcode as string) || (r.uts_barcode as string) || undefined,
          gtin: (r.uts_barcode as string) || (r.barcode as string) || undefined,
          ubb_code: (r.ubb_code as string) || undefined,
          uts_product_no: (r.uts_product_no as string) || undefined,
          serial_no: serialNo,
          lot_no: lotNo,
          expiry_date: expiry,
          quantity: Number(r.quantity ?? 1),
          customer_id: r.customer_id ? Number(r.customer_id) : undefined,
          customer_name: (r.customer_name as string) || undefined,
          customer_tc: (r.customer_tc as string) || undefined,
          sale_id: Number(r.sale_id),
          sale_no: (r.sale_no as string) || undefined,
          sale_date: (r.sale_date as string) || undefined,
          prescription_no: (r.prescription_no as string) || (r.e_prescription_no as string) || undefined,
          operation_date: (r.sale_date as string) || undefined,
          uts_status: 'Bekliyor',
          missing_fields: [],
          has_warnings: false,
          warning_message: warning,
          sale_cancelled: r.sale_status === 'İptal edildi',
        };
        base.missing_fields = this.validateRow(base, 'VERME_BILDIRIMI');
        base.has_warnings = base.missing_fields.length > 0 || !!warning;
        return base;
      })
      .filter((r): r is UtsPendingRow => {
        if (!r) return false;
        if (filters.missing_only && !r.has_warnings) return false;
        if (filters.search?.trim()) {
          const term = filters.search.trim().toLowerCase();
          const hay = `${r.product_name} ${r.sale_no} ${r.customer_name} ${r.serial_no}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      });
  }

  listPendingReturn(filters: UtsOperationListFilters = {}): UtsPendingRow[] {
    let sql = `
      SELECT ri.id as source_id, ri.product_id, ri.quantity, ri.sale_item_id,
             ret.id as return_id, ret.return_type, ret.created_at as return_date, ret.customer_id,
             s.sale_no, s.id as sale_id,
             c.full_name as customer_name, c.tc_no as customer_tc,
             si.line_note, p.name as product_name, p.product_type, p.ubb_code, p.uts_product_no,
             p.uts_barcode, p.serial_no as product_serial, p.lot_no as product_lot, p.uts_expiry_date
      FROM return_items ri
      INNER JOIN returns ret ON ret.id = ri.return_id
      INNER JOIN products p ON p.id = ri.product_id
      LEFT JOIN sale_items si ON si.id = ri.sale_item_id
      LEFT JOIN sales s ON s.id = ret.sale_id
      LEFT JOIN customers c ON c.id = ret.customer_id
      WHERE ret.status = 'Tamamlandı'
      AND (
        p.uts_tracking_required = 1 OR p.ubb_code IS NOT NULL AND p.ubb_code != '' OR
        p.uts_product_no IS NOT NULL AND p.uts_product_no != ''
      )
    `;
    const params: unknown[] = [];
    if (filters.date_from) { sql += ` AND date(ret.created_at) >= date(?)`; params.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND date(ret.created_at) <= date(?)`; params.push(filters.date_to); }
    if (filters.customer_id) { sql += ` AND ret.customer_id = ?`; params.push(filters.customer_id); }
    sql += ` ORDER BY ret.created_at DESC LIMIT 2000`;

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows
      .map((r) => {
        const sourceId = Number(r.source_id);
        const productId = Number(r.product_id);
        const parsed = parseLineNote(r.line_note as string);
        const serialNo = parsed.serial_no || (r.product_serial as string) || undefined;
        const opType = r.return_type === 'İptal' ? 'RED_BILDIRIMI' : 'IADE_BILDIRIMI';
        if (this.isSourceClosed('return_item', sourceId, opType as UtsOperationType)) return null;

        const subtype =
          r.return_type === 'İptal'
            ? 'Satış iptal'
            : r.return_type === 'Değişim'
              ? 'Müşteriden iade'
              : 'Müşteriden iade';

        const base: UtsPendingRow = {
          row_key: `ret-ri-${sourceId}`,
          source_type: 'return_item',
          source_id: sourceId,
          product_id: productId,
          product_name: String(r.product_name),
          product_type: String(r.product_type),
          barcode: (r.uts_barcode as string) || undefined,
          gtin: (r.uts_barcode as string) || undefined,
          ubb_code: (r.ubb_code as string) || undefined,
          uts_product_no: (r.uts_product_no as string) || undefined,
          serial_no: serialNo,
          lot_no: parsed.lot_no || (r.product_lot as string) || undefined,
          expiry_date: parsed.expiry_date || (r.uts_expiry_date as string) || undefined,
          quantity: Number(r.quantity ?? 1),
          customer_id: r.customer_id ? Number(r.customer_id) : undefined,
          customer_name: (r.customer_name as string) || undefined,
          customer_tc: (r.customer_tc as string) || undefined,
          sale_id: r.sale_id ? Number(r.sale_id) : undefined,
          sale_no: (r.sale_no as string) || undefined,
          return_id: Number(r.return_id),
          return_subtype: subtype,
          operation_date: (r.return_date as string) || undefined,
          uts_status: 'Bekliyor',
          missing_fields: [],
          has_warnings: false,
        };
        base.missing_fields = this.validateRow(base, opType as UtsOperationType);
        base.has_warnings = base.missing_fields.length > 0;
        if (filters.return_subtype && base.return_subtype !== filters.return_subtype) return null;
        return base;
      })
      .filter((r): r is UtsPendingRow => !!r);
  }

  private resolveRows(operationType: UtsOperationType, rowKeys: string[]): UtsPendingRow[] {
    const listFn =
      operationType === 'ALMA_BILDIRIMI'
        ? () => this.listPendingReceive({})
        : operationType === 'VERME_BILDIRIMI'
          ? () => this.listPendingGive({})
          : () => this.listPendingReturn({});
    const all = listFn();
    const selected = all.filter((r) => rowKeys.includes(r.row_key));
    if (selected.length !== rowKeys.length) {
      throw new UtsOperationError('Bazı kayıtlar bulunamadı veya zaten işlenmiş.');
    }
    return selected;
  }

  createOperation(input: UtsCreateOperationInput, userId: number): { operationId: number; operationNo: string; itemCount: number } {
    if (!input.row_keys?.length) throw new UtsOperationError('En az bir kayıt seçin.');
    const rows = this.resolveRows(input.operation_type, input.row_keys);
    const warnCount = rows.filter((r) => r.has_warnings).length;
    if (warnCount > 0 && !input.force_with_warnings) {
      throw new UtsOperationError(`${warnCount} kayıtta eksik alan var. Devam etmek için onaylayın.`);
    }

    const operationNo = this.generateOperationNo(input.operation_type);
    const first = rows[0];

    const run = this.db.transaction(() => {
      const opResult = this.db
        .prepare(
          `INSERT INTO uts_operations (
            operation_no, operation_type, source_type, source_id,
            customer_id, supplier_id, sale_id, return_id, stock_entry_batch_id,
            document_no, operation_date, status, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          operationNo,
          input.operation_type,
          rows.length === 1 ? first.source_type : 'batch',
          rows.length === 1 ? first.source_id : null,
          first.customer_id || null,
          first.supplier_id || null,
          first.sale_id || null,
          first.return_id || null,
          first.stock_entry_batch_id || null,
          first.document_no || first.sale_no || first.batch_no || null,
          first.operation_date || new Date().toISOString().slice(0, 10),
          warnCount > 0 ? 'Hatalı' : 'Hazırlandı',
          input.notes || null,
          userId
        );
      const operationId = Number(opResult.lastInsertRowid);

      const insertItem = this.db.prepare(
        `INSERT INTO uts_operation_items (
          operation_id, product_id, barcode, gtin, ubb_code, uts_product_no,
          serial_no, lot_no, expiry_date, quantity, customer_id, supplier_id,
          status, error_message, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const row of rows) {
        insertItem.run(
          operationId,
          row.product_id,
          row.barcode || null,
          row.gtin || null,
          row.ubb_code || null,
          row.uts_product_no || null,
          row.serial_no || null,
          row.lot_no || null,
          row.expiry_date || null,
          row.quantity,
          row.customer_id || null,
          row.supplier_id || null,
          row.has_warnings ? 'Hatalı' : 'Hazırlandı',
          row.has_warnings ? row.missing_fields.join(', ') : null,
          row.source_type
        );
        this.db
          .prepare(
            `INSERT INTO uts_operations (
              operation_no, operation_type, source_type, source_id,
              customer_id, supplier_id, sale_id, return_id, stock_entry_batch_id,
              document_no, operation_date, status, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Hazırlandı', ?, ?)`
          )
          .run(
            `${operationNo}-L${row.source_id}`,
            input.operation_type,
            row.source_type,
            row.source_id,
            row.customer_id || null,
            row.supplier_id || null,
            row.sale_id || null,
            row.return_id || null,
            row.stock_entry_batch_id || null,
            row.document_no || row.sale_no || row.batch_no || null,
            row.operation_date || new Date().toISOString().slice(0, 10),
            `Bağlı: ${operationNo}`,
            userId
          );
      }

      this.db
        .prepare(`INSERT INTO uts_operation_logs (operation_id, status, description, created_by) VALUES (?, ?, ?, ?)`)
        .run(operationId, 'Hazırlandı', `${OP_LABELS[input.operation_type]} hazırlandı (${rows.length} kalem)`, userId);

      return operationId;
    });

    const operationId = run();
    return { operationId, operationNo, itemCount: rows.length };
  }

  exportExcel(operationId: number, filePath: string, userId: number): { filePath: string; rowCount: number } {
    const detail = this.getDetail(operationId);
    if (!detail) throw new UtsOperationError('Operasyon bulunamadı.');
    const items = (detail.items as Record<string, unknown>[]) || [];
    const op = detail.operation as Record<string, unknown>;

    const sheetRows = items.map((item) => ({
      operation_type_label: OP_LABELS[String(op.operation_type)] || op.operation_type,
      product_name: item.product_name || '',
      barcode: item.barcode || item.gtin || '',
      ubb_code: item.ubb_code || '',
      uts_product_no: item.uts_product_no || '',
      serial_no: item.serial_no || '',
      lot_no: item.lot_no || '',
      expiry_date: item.expiry_date || '',
      quantity: item.quantity,
      customer_name: item.customer_name || '',
      supplier_name: item.supplier_name || '',
      document_no: op.document_no || '',
      source_ref: op.operation_no,
      notes: item.notes || op.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(sheetRows, {
      header: UTS_EXCEL_COLUMN_MAP.map((c) => c.header),
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ÜTS');
    XLSX.writeFile(wb, filePath);

    this.db
      .prepare(`UPDATE uts_operations SET status = 'Dışa Aktarıldı', exported_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(operationId);
    this.db
      .prepare(`INSERT INTO uts_operation_logs (operation_id, status, description, created_by) VALUES (?, ?, ?, ?)`)
      .run(operationId, 'Dışa Aktarıldı', `Excel: ${filePath}`, userId);

    return { filePath, rowCount: sheetRows.length };
  }

  getDefaultFileName(operationType: UtsOperationType): string {
    const d = new Date().toISOString().slice(0, 10);
    const map: Record<string, string> = {
      ALMA_BILDIRIMI: `uts-alma-bildirimi-${d}.xlsx`,
      VERME_BILDIRIMI: `uts-verme-bildirimi-${d}.xlsx`,
      IADE_BILDIRIMI: `uts-iade-bildirimi-${d}.xlsx`,
      RED_BILDIRIMI: `uts-red-bildirimi-${d}.xlsx`,
    };
    return map[operationType] || `uts-operasyon-${d}.xlsx`;
  }

  markProcessed(operationIds: number[], userId: number): { updated: number } {
    let count = 0;
    const run = this.db.transaction(() => {
      for (const id of operationIds) {
        this.db
          .prepare(
            `UPDATE uts_operations SET status = 'ÜTS''de İşlendi', processed_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`
          )
          .run(id);
        this.db
          .prepare(`UPDATE uts_operation_items SET status = 'ÜTS''de İşlendi' WHERE operation_id = ?`)
          .run(id);
        this.db
          .prepare(`INSERT INTO uts_operation_logs (operation_id, status, description, created_by) VALUES (?, ?, ?, ?)`)
          .run(id, 'ÜTS\'de İşlendi', 'Manuel işlendi işaretlendi', userId);
        count++;
      }
    });
    run();
    return { updated: count };
  }

  markIgnored(input: UtsMarkIgnoredInput, userId: number): { updated: number } {
    let count = 0;
    const run = this.db.transaction(() => {
      if (input.operation_ids?.length) {
        for (const id of input.operation_ids) {
          this.db
            .prepare(
              `UPDATE uts_operations SET status = 'İşlem Dışı', notes = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
            )
            .run(`${input.reason}${input.notes ? ` — ${input.notes}` : ''}`, id);
          this.db
            .prepare(`INSERT INTO uts_operation_logs (operation_id, status, description, created_by) VALUES (?, ?, ?, ?)`)
            .run(id, 'İşlem Dışı', input.reason, userId);
          count++;
        }
      }
      if (input.row_keys?.length) {
        for (const key of input.row_keys) {
          const [kind, , idStr] = key.split('-');
          const sourceType =
            kind === 'recv' ? 'stock_entry_item' : kind === 'give' ? 'sale_item' : 'return_item';
          const sourceId = Number(idStr);
          const opType =
            kind === 'recv' ? 'ALMA_BILDIRIMI' : kind === 'give' ? 'VERME_BILDIRIMI' : 'IADE_BILDIRIMI';
          this.db
            .prepare(
              `INSERT INTO uts_operations (operation_no, operation_type, source_type, source_id, operation_date, status, notes, created_by)
               VALUES (?, ?, ?, ?, date('now', 'localtime'), 'İşlem Dışı', ?, ?)`
            )
            .run(`IGNORE-${Date.now()}-${sourceId}`, opType, sourceType, sourceId, `${input.reason}`, userId);
          count++;
        }
      }
    });
    run();
    return { updated: count };
  }

  listHistory(filters: UtsOperationHistoryFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT uo.*, u.full_name as created_by_name,
             (SELECT COUNT(*) FROM uts_operation_items WHERE operation_id = uo.id) as item_count
      FROM uts_operations uo
      LEFT JOIN users u ON u.id = uo.created_by
      WHERE uo.operation_no NOT LIKE 'IGNORE-%' AND uo.operation_no NOT LIKE '%-L%'
    `;
    const params: unknown[] = [];
    if (filters.date_from) { sql += ` AND date(uo.operation_date) >= date(?)`; params.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND date(uo.operation_date) <= date(?)`; params.push(filters.date_to); }
    if (filters.operation_type) { sql += ` AND uo.operation_type = ?`; params.push(filters.operation_type); }
    if (filters.status) { sql += ` AND uo.status = ?`; params.push(filters.status); }
    if (filters.search?.trim()) {
      sql += ` AND (uo.operation_no LIKE ? OR uo.document_no LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }
    sql += ` ORDER BY uo.created_at DESC LIMIT 500`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  getDetail(operationId: number): Record<string, unknown> | null {
    const op = this.db
      .prepare(
        `SELECT uo.*, u.full_name as created_by_name FROM uts_operations uo
         LEFT JOIN users u ON u.id = uo.created_by WHERE uo.id = ?`
      )
      .get(operationId) as Record<string, unknown> | undefined;
    if (!op) return null;

    const items = this.db
      .prepare(
        `SELECT uoi.*, p.name as product_name, c.full_name as customer_name, s.name as supplier_name
         FROM uts_operation_items uoi
         LEFT JOIN products p ON p.id = uoi.product_id
         LEFT JOIN customers c ON c.id = uoi.customer_id
         LEFT JOIN suppliers s ON s.id = uoi.supplier_id
         WHERE uoi.operation_id = ?`
      )
      .all(operationId) as Record<string, unknown>[];

    const logs = this.db
      .prepare(
        `SELECT ul.*, u.full_name as created_by_name FROM uts_operation_logs ul
         LEFT JOIN users u ON u.id = ul.created_by WHERE ul.operation_id = ? ORDER BY ul.created_at`
      )
      .all(operationId);

    return { operation: op, items, logs };
  }

  importUtsFile(filePath: string): UtsImportRow[] {
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    return raw.map((row) => {
      const barcode =
        row['Barkod / GTIN'] || row['Barkod'] || row['GTIN'] || row['barcode'] || '';
      const parsed = barcode ? parseScannedCode(barcode) : null;
      const gtin = parsed?.gtin || barcode;
      let matched: { id: number; name: string } | undefined;
      if (gtin) {
        matched = this.db
          .prepare(
            `SELECT p.id, p.name FROM products p
             LEFT JOIN product_barcodes pb ON pb.product_id = p.id
             WHERE pb.barcode = ? OR p.uts_barcode = ? OR p.ubb_code = ? OR p.uts_product_no = ?
             LIMIT 1`
          )
          .get(gtin, gtin, row['UBB Kodu'] || '', row['ÜTS Ürün No'] || '') as { id: number; name: string } | undefined;
      }
      return {
        product_name: row['Ürün Adı'] || row['product_name'] || '',
        barcode,
        gtin: gtin || undefined,
        ubb_code: row['UBB Kodu'] || undefined,
        uts_product_no: row['ÜTS Ürün No'] || undefined,
        serial_no: row['Seri No'] || parsed?.serialNo || undefined,
        lot_no: row['Lot No'] || parsed?.lotNo || undefined,
        expiry_date: row['Son Kullanma Tarihi'] || row['SKT'] || parsed?.expiryDate || undefined,
        quantity: Number(row['Adet'] || 1) || 1,
        matched_product_id: matched?.id,
        matched_product_name: matched?.name,
        match_status: matched ? 'matched' : 'unmatched',
      };
    });
  }

  createStockEntryFromImport(
    rows: UtsImportRow[],
    userId: number,
    options?: { supplier_id?: number; document_no?: string; entry_date?: string }
  ): { batchId: number; batchNo: string; itemCount: number } {
    const valid = rows.filter((r) => r.matched_product_id);
    if (!valid.length) throw new UtsOperationError('Eşleşen ürün bulunamadı.');

    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const batchNo = `UTS-IMP-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Date.now().toString().slice(-4)}`;
    const entryDate = options?.entry_date || new Date().toISOString().slice(0, 10);

    const run = this.db.transaction(() => {
      const batchResult = this.db
        .prepare(
          `INSERT INTO stock_entry_batches (batch_no, supplier_id, document_no, entry_date, total_items, total_quantity, total_cost, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 0, 'ÜTS Otomatik Giriş Hazırlığı', ?)`
        )
        .run(batchNo, options?.supplier_id || null, options?.document_no || null, entryDate, valid.length, valid.reduce((s, r) => s + r.quantity, 0), userId);
      const batchId = Number(batchResult.lastInsertRowid);

      const insertItem = this.db.prepare(
        `INSERT INTO stock_entry_items (batch_id, product_id, barcode, quantity) VALUES (?, ?, ?, ?)`
      );
      for (const row of valid) {
        insertItem.run(batchId, row.matched_product_id, row.gtin || row.barcode || null, row.quantity);
        if (row.serial_no || row.lot_no) {
          this.db
            .prepare(
              `UPDATE products SET serial_no = COALESCE(?, serial_no), lot_no = COALESCE(?, lot_no),
               uts_expiry_date = COALESCE(?, uts_expiry_date), updated_at = datetime('now', 'localtime') WHERE id = ?`
            )
            .run(row.serial_no || null, row.lot_no || null, row.expiry_date || null, row.matched_product_id);
        }
      }

      const opNo = this.generateOperationNo('MANUEL_DUZELTME');
      const opResult = this.db
        .prepare(
          `INSERT INTO uts_operations (operation_no, operation_type, source_type, source_id, stock_entry_batch_id, document_no, operation_date, status, notes, created_by)
           VALUES (?, 'MANUEL_DUZELTME', 'stock_entry_batch', ?, ?, ?, ?, 'Hazırlandı', 'ÜTS dosyasından stok girişi hazırlığı', ?)`
        )
        .run(opNo, batchId, batchId, options?.document_no || batchNo, entryDate, userId);

      this.db
        .prepare(`INSERT INTO uts_operation_logs (operation_id, status, description, created_by) VALUES (?, ?, ?, ?)`)
        .run(Number(opResult.lastInsertRowid), 'Hazırlandı', 'ÜTS dosyasından stok girişi hazırlandı', userId);

      return batchId;
    });

    const batchId = run();
    return { batchId, batchNo, itemCount: valid.length };
  }

  getReport(filters: UtsReportFilters = {}): Record<string, unknown> {
    let sql = `SELECT status, operation_type, COUNT(*) as cnt FROM uts_operations WHERE operation_no NOT LIKE 'IGNORE-%' AND operation_no NOT LIKE '%-L%'`;
    const params: unknown[] = [];
    if (filters.date_from) { sql += ` AND date(operation_date) >= date(?)`; params.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND date(operation_date) <= date(?)`; params.push(filters.date_to); }
    if (filters.operation_type) { sql += ` AND operation_type = ?`; params.push(filters.operation_type); }
    if (filters.status) { sql += ` AND status = ?`; params.push(filters.status); }
    sql += ` GROUP BY status, operation_type`;

    const breakdown = this.db.prepare(sql).all(...params) as Array<{ status: string; operation_type: string; cnt: number }>;
    const summary = {
      total: 0,
      pending: 0,
      exported: 0,
      processed: 0,
      error: 0,
      ignored: 0,
    };
    for (const row of breakdown) {
      summary.total += row.cnt;
      if (['Bekliyor', 'Hazırlandı'].includes(row.status)) summary.pending += row.cnt;
      if (row.status === 'Dışa Aktarıldı') summary.exported += row.cnt;
      if (row.status === 'ÜTS\'de İşlendi') summary.processed += row.cnt;
      if (row.status === 'Hatalı') summary.error += row.cnt;
      if (row.status === 'İşlem Dışı') summary.ignored += row.cnt;
    }
    return { summary, breakdown, rows: this.listHistory(filters) };
  }

  countPendingReceive(): number {
    return this.listPendingReceive({}).length;
  }

  countPendingGive(): number {
    return this.listPendingGive({}).length;
  }

  countErrorRecords(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as c FROM uts_operations WHERE status = 'Hatalı'`)
      .get() as { c: number };
    return row.c;
  }
}
