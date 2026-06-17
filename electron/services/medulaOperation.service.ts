import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import type Database from 'better-sqlite3';
import { InstitutionReceivableService } from './institutionReceivable.service';
import { MedulaExportService } from './medulaExport.service';
import {
  isInstitutionPrescriptionType,
  missingFieldsSummary,
  validateMedulaSaleRecord,
} from '../utils/medulaValidation.util';
import type {
  MedulaEnterInfoInput,
  MedulaOperationHistoryFilters,
  MedulaReportFilters,
  SgkPrescriptionListFilters,
  SgkPrescriptionRow,
} from '../types/medulaOperation';
import { INSTITUTION_PRESCRIPTION_TYPES } from '../types/medulaOperation';
import type { MedulaListFilters } from '../types/medula';

export class MedulaOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MedulaOperationError';
  }
}

function nextOperationNo(): string {
  return `MOP-${Date.now()}`;
}

export class MedulaOperationService {
  private exportService: MedulaExportService;
  private receivableService: InstitutionReceivableService;

  constructor(private db: Database.Database) {
    this.exportService = new MedulaExportService(db);
    this.receivableService = new InstitutionReceivableService(db);
  }

  validateRecord(saleId: number) {
    return validateMedulaSaleRecord(this.db, saleId);
  }

  validateRows(saleIds: number[]): Array<ReturnType<typeof validateMedulaSaleRecord>> {
    return saleIds.map((id) => this.validateRecord(id));
  }

  listPendingExport(filters: MedulaListFilters = {}): Record<string, unknown>[] {
    const merged: MedulaListFilters = {
      ...filters,
      prescription_type: filters.prescription_type,
    };
    const rows = this.exportService.listReadyRecords(merged);
    return rows.filter((row) => {
      const type = String(row.prescription_type || '');
      if (!isInstitutionPrescriptionType(type)) return false;
      const status = String(row.medula_status || '');
      if (['Medula\'ya İşlendi', 'Faturalandı', 'İptal'].includes(status)) return false;
      if (filters.has_missing_fields === false && (row.missing_count as number) > 0) return false;
      return true;
    });
  }

  listSgkPrescriptions(filters: SgkPrescriptionListFilters = {}): SgkPrescriptionRow[] {
    let sql = `
      SELECT s.id as sale_id, s.sale_no, s.net_amount,
             s.patient_amount, s.institution_amount, s.contribution_amount,
             pr.id as prescription_id, pr.prescription_date, pr.prescription_type,
             pr.e_prescription_no, pr.provision_no, pr.institution, pr.medula_status,
             c.full_name as customer_name, COALESCE(pr.patient_tc, c.tc_no) as customer_tc,
             ir.id as institution_receivable_id, ir.status as receivable_status
      FROM sales s
      INNER JOIN prescriptions pr ON pr.id = s.prescription_id
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN institution_receivables ir ON ir.sale_id = s.id
      WHERE s.status != 'İptal edildi'
      AND pr.prescription_type IN (${INSTITUTION_PRESCRIPTION_TYPES.map(() => '?').join(',')})
    `;
    const params: unknown[] = [...INSTITUTION_PRESCRIPTION_TYPES];

    if (filters.date_from) {
      sql += ` AND date(pr.prescription_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(pr.prescription_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.prescription_type) {
      sql += ` AND pr.prescription_type = ?`;
      params.push(filters.prescription_type);
    }
    if (filters.medula_status) {
      sql += ` AND pr.medula_status = ?`;
      params.push(filters.medula_status);
    }
    if (filters.institution?.trim()) {
      sql += ` AND pr.institution LIKE ?`;
      params.push(`%${filters.institution.trim()}%`);
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
    if (filters.provision_no?.trim()) {
      sql += ` AND pr.provision_no LIKE ?`;
      params.push(`%${filters.provision_no.trim()}%`);
    }
    if (filters.invoice_ready === true) {
      sql += ` AND pr.medula_status = 'Faturaya Hazır'`;
    }
    if (filters.has_missing_fields === true) {
      sql += ` AND pr.medula_status = 'Eksik Bilgi'`;
    }

    sql += ` ORDER BY pr.prescription_date DESC, s.id DESC`;

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    return rows
      .map((row) => {
        const validation = validateMedulaSaleRecord(this.db, row.sale_id as number);
        const missing = missingFieldsSummary(validation);
        return {
          sale_id: row.sale_id as number,
          sale_no: String(row.sale_no),
          prescription_id: row.prescription_id as number,
          prescription_date: row.prescription_date as string | undefined,
          customer_name: row.customer_name as string | undefined,
          customer_tc: row.customer_tc as string | undefined,
          e_prescription_no: row.e_prescription_no as string | undefined,
          provision_no: row.provision_no as string | undefined,
          institution: row.institution as string | undefined,
          prescription_type: row.prescription_type as string | undefined,
          net_amount: Number(row.net_amount) || 0,
          patient_amount: Number(row.patient_amount) || 0,
          institution_amount: Number(row.institution_amount) || 0,
          contribution_amount: Number(row.contribution_amount) || 0,
          medula_status: String(row.medula_status || ''),
          missing_fields: missing.missing_fields,
          missing_count: missing.missing_count,
          institution_receivable_id: row.institution_receivable_id as number | undefined,
          receivable_status: row.receivable_status as string | undefined,
        };
      })
      .filter((row) => {
        if (filters.has_missing_fields === true) return row.missing_count > 0;
        if (filters.has_missing_fields === false) return row.missing_count === 0;
        return true;
      });
  }

  private logOperation(
    operationId: number,
    status: string,
    description: string,
    userId?: number
  ): void {
    this.db
      .prepare(
        `INSERT INTO medula_operation_logs (operation_id, status, description, created_by)
         VALUES (?, ?, ?, ?)`
      )
      .run(operationId, status, description, userId || null);
  }

  private createOperation(
    type: string,
    data: {
      prescription_id?: number;
      sale_id?: number;
      customer_id?: number;
      institution_receivable_id?: number;
      notes?: string;
      status?: string;
    },
    userId?: number
  ): number {
    const opNo = nextOperationNo();
    const result = this.db
      .prepare(
        `INSERT INTO medula_operations (
          operation_no, operation_type, prescription_id, sale_id, customer_id,
          institution_receivable_id, operation_date, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, date('now', 'localtime'), ?, ?, ?)`
      )
      .run(
        opNo,
        type,
        data.prescription_id || null,
        data.sale_id || null,
        data.customer_id || null,
        data.institution_receivable_id || null,
        data.status || 'Tamamlandı',
        data.notes || null,
        userId || null
      );
    const opId = Number(result.lastInsertRowid);
    this.logOperation(opId, data.status || 'Tamamlandı', `${type} işlemi`, userId);
    return opId;
  }

  markProcessed(saleIds: number[], userId?: number): { updated: number } {
    let updated = 0;
    const tx = this.db.transaction(() => {
      for (const saleId of saleIds) {
        const sale = this.db
          .prepare(`SELECT prescription_id, customer_id FROM sales WHERE id = ?`)
          .get(saleId) as { prescription_id: number; customer_id: number } | undefined;
        if (!sale?.prescription_id) continue;

        this.db
          .prepare(
            `UPDATE prescriptions SET medula_status = 'Medula''ya İşlendi', updated_at = datetime('now', 'localtime') WHERE id = ?`
          )
          .run(sale.prescription_id);

        this.createOperation(
          'MEDULAYA_ISLENDI',
          {
            prescription_id: sale.prescription_id,
            sale_id: saleId,
            customer_id: sale.customer_id,
            notes: 'Medula\'ya işlendi olarak işaretlendi',
          },
          userId
        );
        updated++;
      }
    });
    tx();
    return { updated };
  }

  markInvoiceReady(saleIds: number[], userId?: number): { updated: number } {
    let updated = 0;
    const tx = this.db.transaction(() => {
      for (const saleId of saleIds) {
        const sale = this.db
          .prepare(`SELECT prescription_id, customer_id FROM sales WHERE id = ?`)
          .get(saleId) as { prescription_id: number; customer_id: number } | undefined;
        if (!sale?.prescription_id) continue;

        this.db
          .prepare(
            `UPDATE prescriptions SET medula_status = 'Faturaya Hazır', updated_at = datetime('now', 'localtime') WHERE id = ?`
          )
          .run(sale.prescription_id);

        const rec = this.receivableService.getBySaleId(saleId);
        if (rec) {
          this.receivableService.updateStatus(Number(rec.id), 'Faturaya Hazır');
        }

        this.createOperation(
          'FATURAYA_HAZIR',
          {
            prescription_id: sale.prescription_id,
            sale_id: saleId,
            customer_id: sale.customer_id,
            institution_receivable_id: rec ? Number(rec.id) : undefined,
          },
          userId
        );
        updated++;
      }
    });
    tx();
    return { updated };
  }

  markIgnored(saleIds: number[], userId?: number): { updated: number } {
    let updated = 0;
    const tx = this.db.transaction(() => {
      for (const saleId of saleIds) {
        const sale = this.db
          .prepare(`SELECT prescription_id, customer_id FROM sales WHERE id = ?`)
          .get(saleId) as { prescription_id: number; customer_id: number } | undefined;
        if (!sale?.prescription_id) continue;
        this.db
          .prepare(
            `UPDATE prescriptions SET medula_status = 'İptal', updated_at = datetime('now', 'localtime') WHERE id = ?`
          )
          .run(sale.prescription_id);
        this.createOperation(
          'MANUEL_DUZELTME',
          { prescription_id: sale.prescription_id, sale_id: saleId, customer_id: sale.customer_id, notes: 'İşlem dışı' },
          userId
        );
        updated++;
      }
    });
    tx();
    return { updated };
  }

  enterMedulaInfo(input: MedulaEnterInfoInput, userId?: number): { sale_id: number; receivable_id?: number } {
    const sale = this.db
      .prepare(`SELECT * FROM sales WHERE id = ?`)
      .get(input.sale_id) as Record<string, unknown> | undefined;
    if (!sale) throw new MedulaOperationError('Satış bulunamadı.');

    const prescriptionId = sale.prescription_id as number;
    if (!prescriptionId) throw new MedulaOperationError('Reçete bağlantısı yok.');

    let receivableId: number | undefined;

    const tx = this.db.transaction(() => {
      if (input.provision_no) {
        this.db.prepare(`UPDATE prescriptions SET provision_no = ? WHERE id = ?`).run(input.provision_no, prescriptionId);
      }
      if (input.sgk_tracking_no) {
        this.db
          .prepare(`UPDATE prescriptions SET sgk_tracking_no = ? WHERE id = ?`)
          .run(input.sgk_tracking_no, prescriptionId);
      }
      if (input.medula_note) {
        this.db.prepare(`UPDATE prescriptions SET medula_note = ? WHERE id = ?`).run(input.medula_note, prescriptionId);
      }
      if (input.approval_status) {
        this.db
          .prepare(`UPDATE prescriptions SET medula_approval_status = ? WHERE id = ?`)
          .run(input.approval_status, prescriptionId);
      }

      const patientAmt = input.patient_amount ?? (Number(sale.patient_amount) || 0);
      const institutionAmt = input.institution_amount ?? (Number(sale.institution_amount) || 0);
      const contribution = input.contribution_amount ?? (Number(sale.contribution_amount) || 0);
      const diffFee = input.difference_fee ?? (Number(sale.difference_fee) || 0);

      this.db
        .prepare(
          `UPDATE sales SET patient_amount = ?, institution_amount = ?, contribution_amount = ?,
           difference_fee = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(patientAmt, institutionAmt, contribution, diffFee, input.sale_id);

      const validation = validateMedulaSaleRecord(this.db, input.sale_id);
      const newStatus = validation.isValid ? 'Hazır' : 'Eksik Bilgi';
      this.db
        .prepare(
          `UPDATE prescriptions SET medula_status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(newStatus, prescriptionId);

      if (institutionAmt > 0) {
        const rec = this.receivableService.createOrUpdateFromSale(input.sale_id, {
          patient_amount: patientAmt,
          institution_amount: institutionAmt,
          contribution_amount: contribution,
          difference_fee: diffFee,
          notes: input.medula_note,
        });
        receivableId = rec.id;
        if (!validation.isValid) {
          this.receivableService.updateStatus(rec.id, 'Eksik Bilgi');
        }
      }

      this.createOperation(
        'MEDULADAN_BILGI_GIRISI',
        {
          prescription_id: prescriptionId,
          sale_id: input.sale_id,
          customer_id: sale.customer_id as number,
          institution_receivable_id: receivableId,
          notes: input.medula_note,
        },
        userId
      );
    });
    tx();
    return { sale_id: input.sale_id, receivable_id: receivableId };
  }

  listOperations(filters: MedulaOperationHistoryFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT mo.*, c.full_name as customer_name, s.sale_no, pr.prescription_no
      FROM medula_operations mo
      LEFT JOIN customers c ON c.id = mo.customer_id
      LEFT JOIN sales s ON s.id = mo.sale_id
      LEFT JOIN prescriptions pr ON pr.id = mo.prescription_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters.date_from) {
      sql += ` AND date(mo.operation_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(mo.operation_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.operation_type) {
      sql += ` AND mo.operation_type = ?`;
      params.push(filters.operation_type);
    }
    if (filters.status) {
      sql += ` AND mo.status = ?`;
      params.push(filters.status);
    }
    if (filters.search?.trim()) {
      sql += ` AND (mo.operation_no LIKE ? OR c.full_name LIKE ? OR s.sale_no LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term);
    }
    sql += ` ORDER BY mo.operation_date DESC, mo.id DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  getOperationDetail(id: number): Record<string, unknown> | null {
    const op = this.db
      .prepare(
        `SELECT mo.*, c.full_name as customer_name, s.sale_no, pr.prescription_no, pr.e_prescription_no
         FROM medula_operations mo
         LEFT JOIN customers c ON c.id = mo.customer_id
         LEFT JOIN sales s ON s.id = mo.sale_id
         LEFT JOIN prescriptions pr ON pr.id = mo.prescription_id
         WHERE mo.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!op) return null;
    const logs = this.db
      .prepare(`SELECT * FROM medula_operation_logs WHERE operation_id = ? ORDER BY created_at DESC`)
      .all(id);
    return { ...op, logs };
  }

  getReport(filters: MedulaReportFilters = {}): Record<string, unknown> {
    const sgkRows = this.listSgkPrescriptions({
      date_from: filters.date_from,
      date_to: filters.date_to,
      prescription_type: filters.prescription_type,
      medula_status: filters.medula_status,
    });

    const summary = {
      total: sgkRows.length,
      processed: sgkRows.filter((r) => r.medula_status === 'Medula\'ya İşlendi').length,
      missing: sgkRows.filter((r) => r.missing_count > 0 || r.medula_status === 'Eksik Bilgi').length,
      invoiceReady: sgkRows.filter((r) => r.medula_status === 'Faturaya Hazır').length,
      invoiced: sgkRows.filter((r) => r.medula_status === 'Faturalandı').length,
      institutionTotal: sgkRows.reduce((s, r) => s + r.institution_amount, 0),
      patientTotal: sgkRows.reduce((s, r) => s + r.patient_amount, 0),
    };

    const receivableSummary = this.receivableService.getReportSummary(filters.date_from, filters.date_to);

    return { rows: sgkRows, summary, receivableSummary };
  }

  getDashboardStats(): Record<string, number> {
    const pending = this.db
      .prepare(
        `SELECT COUNT(DISTINCT s.id) as count FROM sales s
         INNER JOIN prescriptions pr ON pr.id = s.prescription_id
         WHERE s.status != 'İptal edildi'
         AND pr.prescription_type IN ('SGK', 'Kurum', 'Tamamlayıcı')
         AND pr.medula_status IN ('Hazırlanmadı', 'Hazır', 'Dışa Aktarıldı')`
      )
      .get() as { count: number };

    const missing = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM prescriptions
         WHERE prescription_type IN ('SGK', 'Kurum', 'Tamamlayıcı')
         AND medula_status = 'Eksik Bilgi' AND (is_active = 1 OR is_active IS NULL)`
      )
      .get() as { count: number };

    const invoiceReady = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM prescriptions
         WHERE prescription_type IN ('SGK', 'Kurum', 'Tamamlayıcı')
         AND medula_status = 'Faturaya Hazır'`
      )
      .get() as { count: number };

    const recv = this.receivableService.getDashboardStats();

    return {
      medulaPending: pending.count,
      medulaMissingInfo: missing.count,
      sgkInvoiceReady: invoiceReady.count,
      institutionReceivableTotal: recv.pendingTotal,
      institutionReceivableCount: recv.pendingCount,
    };
  }

  exportSgkPrescriptionsExcel(saleIds: number[], filePath: string): { recordCount: number } {
    const rows = saleIds.map((id) => this.listSgkPrescriptions({}).find((r) => r.sale_id === id)).filter(Boolean) as SgkPrescriptionRow[];
    const sheetRows = rows.map((r) => ({
      'Reçete Tarihi': r.prescription_date || '',
      Hasta: r.customer_name || '',
      'T.C.': r.customer_tc || '',
      'E-Reçete No': r.e_prescription_no || '',
      'Provizyon No': r.provision_no || '',
      Kurum: r.institution || '',
      'Satış No': r.sale_no,
      'Toplam Tutar': r.net_amount,
      'Hasta Katkı Payı': r.contribution_amount,
      'Kurum Karşılığı': r.institution_amount,
      'Medula Durumu': r.medula_status,
      'Eksik Alan': r.missing_fields,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SGK Reçeteler');
    XLSX.writeFile(wb, filePath);
    return { recordCount: sheetRows.length };
  }
}
