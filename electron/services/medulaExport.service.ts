import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import type Database from 'better-sqlite3';
import type { MedulaListFilters, MedulaValidationResult } from '../types/medula';
import { validateMedulaSaleRecord, missingFieldsSummary } from '../utils/medulaValidation.util';

export class MedulaExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MedulaExportError';
  }
}

function hasEyeData(row: Record<string, unknown>, side: 'right' | 'left'): boolean {
  const prefix = side === 'right' ? 'right' : 'left';
  return !!(row[`${prefix}_sph`] || row[`${prefix}_cyl`] || row[`${prefix}_ax`]);
}

function formatEye(sph: unknown, cyl: unknown, ax: unknown): string {
  if (!sph && !cyl && !ax) return '-';
  return `${sph || '0'} / ${cyl || '0'} x ${ax || '0'}`;
}

export class MedulaExportService {
  constructor(private db: Database.Database) {}

  validateRecord(saleId: number): MedulaValidationResult {
    return validateMedulaSaleRecord(this.db, saleId);
  }

  private computeMissingSummary(saleId: number): { missing_fields: string; missing_count: number } {
    return missingFieldsSummary(this.validateRecord(saleId));
  }

  listReadyRecords(filters: MedulaListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT s.id as sale_id, s.sale_no, s.sale_date, s.delivery_date,
             c.full_name as customer_name,
             COALESCE(pr.patient_tc, c.tc_no) as customer_tc,
             pr.id as prescription_id, pr.prescription_no, pr.e_prescription_no,
             pr.prescription_type, pr.medula_status,
             pr.right_sph, pr.right_cyl, pr.right_ax,
             pr.left_sph, pr.left_cyl, pr.left_ax,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
      FROM sales s
      INNER JOIN prescriptions pr ON pr.id = s.prescription_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.prescription_id IS NOT NULL AND s.status != 'İptal edildi'
    `;
    const params: unknown[] = [];

    if (filters.date_from) {
      sql += ` AND date(s.sale_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(s.sale_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.customer_search?.trim()) {
      sql += ` AND (c.full_name LIKE ? OR c.tc_no LIKE ? OR pr.patient_tc LIKE ?)`;
      const term = `%${filters.customer_search.trim()}%`;
      params.push(term, term, term);
    }
    if (filters.prescription_no?.trim()) {
      sql += ` AND (pr.prescription_no LIKE ? OR pr.e_prescription_no LIKE ?)`;
      const term = `%${filters.prescription_no.trim()}%`;
      params.push(term, term);
    }
    if (filters.medula_status) {
      sql += ` AND pr.medula_status = ?`;
      params.push(filters.medula_status);
    }
    if (filters.prescription_type) {
      sql += ` AND pr.prescription_type = ?`;
      params.push(filters.prescription_type);
    }
    if (filters.only_institution) {
      sql += ` AND pr.prescription_type IN ('SGK', 'Kurum', 'Tamamlayıcı')`;
    }

    sql += ` ORDER BY s.sale_date DESC, s.id DESC`;

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    return rows
      .map((row) => {
        const missing = this.computeMissingSummary(row.sale_id as number);
        return {
          ...row,
          right_eye: formatEye(row.right_sph, row.right_cyl, row.right_ax),
          left_eye: formatEye(row.left_sph, row.left_cyl, row.left_ax),
          missing_fields: missing.missing_fields,
          missing_count: missing.missing_count,
        };
      })
      .filter((row) => {
        if (filters.has_missing_fields === true) return (row.missing_count as number) > 0;
        if (filters.has_missing_fields === false) return (row.missing_count as number) === 0;
        return true;
      });
  }

  getRecordDetail(saleId: number): Record<string, unknown> | null {
    const sale = this.db
      .prepare(
        `SELECT s.*, c.full_name as customer_name, c.tc_no as customer_tc, c.phone as customer_phone
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE s.id = ? AND s.prescription_id IS NOT NULL`
      )
      .get(saleId) as Record<string, unknown> | undefined;

    if (!sale) return null;

    const prescription = this.db
      .prepare(`SELECT * FROM prescriptions WHERE id = ?`)
      .get(sale.prescription_id) as Record<string, unknown>;

    const items = this.db
      .prepare(
        `SELECT si.*, p.name as product_name, p.product_type, p.ubb_code, p.uts_product_no,
                p.serial_no, p.lot_no, p.uts_barcode,
                COALESCE(si.barcode, pb.barcode) as barcode
         FROM sale_items si
         INNER JOIN products p ON p.id = si.product_id
         LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
         WHERE si.sale_id = ?`
      )
      .all(saleId) as Array<Record<string, unknown>>;

    const itemsWithBarcode = items;

    return {
      sale,
      customer: {
        full_name: sale.customer_name,
        tc_no: sale.customer_tc,
        phone: sale.customer_phone,
      },
      prescription,
      items: itemsWithBarcode,
      validation: this.validateRecord(saleId),
    };
  }

  private buildExportRows(saleIds: number[]): Record<string, string | number>[] {
    const rows: Record<string, string | number>[] = [];

    for (const saleId of saleIds) {
      const detail = this.getRecordDetail(saleId);
      if (!detail) continue;

      const sale = detail.sale as Record<string, unknown>;
      const prescription = detail.prescription as Record<string, unknown>;
      const customer = detail.customer as Record<string, unknown>;
      const items = detail.items as Array<Record<string, unknown>>;

      if (!items.length) {
        rows.push(this.rowFromData(sale, prescription, customer, {}));
        continue;
      }

      for (const item of items) {
        rows.push(this.rowFromData(sale, prescription, customer, item));
      }
    }

    return rows;
  }

  private rowFromData(
    sale: Record<string, unknown>,
    prescription: Record<string, unknown>,
    customer: Record<string, unknown>,
    item: Record<string, unknown>
  ): Record<string, string | number> {
    return {
      'Satış No': String(sale.sale_no || ''),
      'Reçete No': String(prescription.prescription_no || ''),
      'E-Reçete No': String(prescription.e_prescription_no || ''),
      'Reçete Tarihi': String(prescription.prescription_date || ''),
      'Hasta Ad Soyad': String(customer.full_name || ''),
      'T.C.': String(prescription.patient_tc || customer.tc_no || ''),
      'E-Rapor No': String(prescription.e_report_no || ''),
      'Provizyon No': String(prescription.provision_no || ''),
      'Medula Takip No': String(prescription.sgk_tracking_no || ''),
      Telefon: String((sale as Record<string, unknown>).customer_phone || ''),
      Doktor: String(prescription.doctor || ''),
      Kurum: String(prescription.institution || ''),
      'Sağ SPH': String(prescription.right_sph || ''),
      'Sağ CYL': String(prescription.right_cyl || ''),
      'Sağ AX': String(prescription.right_ax || ''),
      'Sol SPH': String(prescription.left_sph || ''),
      'Sol CYL': String(prescription.left_cyl || ''),
      'Sol AX': String(prescription.left_ax || ''),
      ADD: String(prescription.add_value || ''),
      PD: String(prescription.pd || ''),
      'Ürün Adı': String(item.product_name || ''),
      'Ürün Tipi': String(item.product_type || ''),
      Barkod: String(item.barcode || ''),
      'UBB Kodu': String(item.ubb_code || ''),
      'ÜTS Ürün No': String(item.uts_product_no || ''),
      'Seri No': String(item.serial_no || ''),
      'Lot No': String(item.lot_no || ''),
      'Satış Tarihi': String(sale.sale_date || ''),
      'Teslim Tarihi': String(sale.delivery_date || prescription.rx_delivery_date || ''),
      'Toplam Tutar': Number(sale.net_amount) || 0,
      'Hasta Payı': Number(sale.patient_amount) || 0,
      'Kurum Karşılığı': Number(sale.institution_amount) || 0,
      'Medula Durumu': String(prescription.medula_status || ''),
      Not: String(prescription.medula_note || prescription.notes || ''),
    };
  }

  private validateBeforeExport(saleIds: number[], force: boolean): void {
    if (!saleIds.length) throw new MedulaExportError('Dışa aktarılacak kayıt seçilmedi.');

    if (force) return;

    const blocked: string[] = [];
    for (const id of saleIds) {
      const v = this.validateRecord(id);
      if (!v.isValid) {
        blocked.push(`Satış #${id}: ${v.errors.join(', ')}`);
      }
    }
    if (blocked.length) {
      throw new MedulaExportError(
        `Eksik alan nedeniyle dışa aktarılamaz:\n${blocked.slice(0, 5).join('\n')}`
      );
    }
  }

  exportExcel(saleIds: number[], filePath: string, force = false): { exportId: number; recordCount: number } {
    this.validateBeforeExport(saleIds, force);
    const rows = this.buildExportRows(saleIds);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Medula Hazırlık');
    XLSX.writeFile(wb, filePath);
    return this.recordExport(saleIds, 'xlsx', filePath, rows.length);
  }

  exportCsv(saleIds: number[], filePath: string, force = false): { exportId: number; recordCount: number } {
    this.validateBeforeExport(saleIds, force);
    const rows = this.buildExportRows(saleIds);
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
    fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8');
    return this.recordExport(saleIds, 'csv', filePath, rows.length);
  }

  exportTxt(saleIds: number[], filePath: string, force = false): { exportId: number; recordCount: number } {
    this.validateBeforeExport(saleIds, force);
    const rows = this.buildExportRows(saleIds);
    const headers = Object.keys(rows[0] || {});
    const lines = [headers.join('\t')];
    for (const row of rows) {
      lines.push(headers.map((h) => String(row[h] ?? '')).join('\t'));
    }
    fs.writeFileSync(filePath, '\uFEFF' + lines.join('\n'), 'utf8');
    return this.recordExport(saleIds, 'txt', filePath, rows.length);
  }

  private recordExport(
    saleIds: number[],
    exportType: string,
    filePath: string,
    recordCount: number
  ): { exportId: number; recordCount: number } {
    const exportNo = `MED-${Date.now()}`;

    const tx = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO medula_exports (export_no, export_type, file_path, record_count, status)
           VALUES (?, ?, ?, ?, 'Tamamlandı')`
        )
        .run(exportNo, exportType, filePath, recordCount);

      const exportId = Number(result.lastInsertRowid);

      const insertItem = this.db.prepare(
        `INSERT INTO medula_export_items (export_id, sale_id, prescription_id, customer_id, status)
         VALUES (?, ?, ?, ?, 'Dışa Aktarıldı')`
      );

      for (const saleId of saleIds) {
        const sale = this.db
          .prepare(`SELECT prescription_id, customer_id FROM sales WHERE id = ?`)
          .get(saleId) as { prescription_id: number; customer_id: number } | undefined;
        if (!sale) continue;

        insertItem.run(exportId, saleId, sale.prescription_id, sale.customer_id);

        this.db
          .prepare(
            `UPDATE prescriptions SET medula_status = 'Dışa Aktarıldı', updated_at = datetime('now', 'localtime') WHERE id = ?`
          )
          .run(sale.prescription_id);
      }

      return { exportId, recordCount };
    });

    return tx();
  }

  markExported(saleIds: number[]): { updated: number } {
    let updated = 0;
    const tx = this.db.transaction(() => {
      for (const saleId of saleIds) {
        const sale = this.db
          .prepare(`SELECT prescription_id FROM sales WHERE id = ?`)
          .get(saleId) as { prescription_id: number } | undefined;
        if (!sale?.prescription_id) continue;
        this.db
          .prepare(
            `UPDATE prescriptions SET medula_status = 'Dışa Aktarıldı', updated_at = datetime('now', 'localtime') WHERE id = ?`
          )
          .run(sale.prescription_id);
        updated++;
      }
    });
    tx();
    return { updated };
  }

  markUploaded(saleIds: number[]): { updated: number } {
    let updated = 0;
    const tx = this.db.transaction(() => {
      for (const saleId of saleIds) {
        const sale = this.db
          .prepare(`SELECT prescription_id FROM sales WHERE id = ?`)
          .get(saleId) as { prescription_id: number } | undefined;
        if (!sale?.prescription_id) continue;
        this.db
          .prepare(
            `UPDATE prescriptions SET medula_status = 'Manuel Yüklendi', updated_at = datetime('now', 'localtime') WHERE id = ?`
          )
          .run(sale.prescription_id);
        updated++;
      }
    });
    tx();
    return { updated };
  }

  listExports(): Record<string, unknown>[] {
    return this.db
      .prepare(`SELECT * FROM medula_exports ORDER BY exported_at DESC, id DESC`)
      .all() as Record<string, unknown>[];
  }

  getDefaultFileName(ext: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return `medula-hazirlik-${today}.${ext}`;
  }
}
