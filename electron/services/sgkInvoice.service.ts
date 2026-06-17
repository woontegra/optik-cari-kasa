import fs from 'fs';
import * as XLSX from 'xlsx';
import type Database from 'better-sqlite3';
import { InstitutionReceivableService } from './institutionReceivable.service';
import { MedulaOperationService } from './medulaOperation.service';
import type { SgkCreateBatchInput, SgkInvoiceListFilters, SgkInvoiceReadyFilters } from '../types/sgkInvoice';

export class SgkInvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SgkInvoiceError';
  }
}

export class SgkInvoiceService {
  private receivableService: InstitutionReceivableService;
  private medulaService: MedulaOperationService;

  constructor(private db: Database.Database) {
    this.receivableService = new InstitutionReceivableService(db);
    this.medulaService = new MedulaOperationService(db);
  }

  listInvoiceReady(filters: SgkInvoiceReadyFilters = {}): Record<string, unknown>[] {
    const rows = this.medulaService.listSgkPrescriptions({
      date_from: filters.date_from,
      date_to: filters.date_to,
      institution: filters.institution,
      medula_status: filters.medula_status,
      invoice_ready: filters.invoice_ready,
    });

    return rows
      .filter((r) => {
        if (filters.invoiced === true) return r.medula_status === 'Faturalandı';
        if (filters.invoiced === false) return r.medula_status !== 'Faturalandı';
        if (filters.invoice_ready === true) return r.medula_status === 'Faturaya Hazır';
        return ['Faturaya Hazır', 'Faturalandı', 'Medula\'ya İşlendi'].includes(r.medula_status);
      })
      .map((r) => ({ ...r }));
  }

  createBatch(input: SgkCreateBatchInput, userId?: number): { batchId: number; batchNo: string; itemCount: number } {
    let saleIds = input.sale_ids || [];
    if (!saleIds.length) {
      const ready = this.listInvoiceReady({
        date_from: input.date_from,
        date_to: input.date_to,
        institution: input.institution,
        invoice_ready: true,
      });
      saleIds = ready.map((r) => r.sale_id as number);
    }
    if (!saleIds.length) throw new SgkInvoiceError('Fatura hazırlığı için uygun kayıt bulunamadı.');

    const batchNo = `SGK-FAT-${Date.now()}`;
    let totalAmount = 0;
    let totalPatient = 0;
    let totalInstitution = 0;

    const tx = this.db.transaction(() => {
      const batchResult = this.db
        .prepare(
          `INSERT INTO sgk_invoice_batches (
            batch_no, institution_name, date_from, date_to, status, notes, created_by
          ) VALUES (?, ?, ?, ?, 'Taslak', ?, ?)`
        )
        .run(
          batchNo,
          input.institution || null,
          input.date_from,
          input.date_to,
          input.notes || null,
          userId || null
        );
      const batchId = Number(batchResult.lastInsertRowid);

      const insertItem = this.db.prepare(
        `INSERT INTO sgk_invoice_batch_items (
          batch_id, prescription_id, sale_id, customer_id, institution_receivable_id,
          amount, patient_amount, institution_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Taslak')`
      );

      for (const saleId of saleIds) {
        const sale = this.db
          .prepare(
            `SELECT s.*, pr.id as prescription_id FROM sales s
             LEFT JOIN prescriptions pr ON pr.id = s.prescription_id WHERE s.id = ?`
          )
          .get(saleId) as Record<string, unknown> | undefined;
        if (!sale) continue;

        const amount = Number(sale.net_amount) || 0;
        const patientAmt = Number(sale.patient_amount) || 0;
        const institutionAmt = Number(sale.institution_amount) || 0;
        totalAmount += amount;
        totalPatient += patientAmt;
        totalInstitution += institutionAmt;

        const rec = this.receivableService.getBySaleId(saleId);
        insertItem.run(
          batchId,
          sale.prescription_id,
          saleId,
          sale.customer_id,
          rec?.id || null,
          amount,
          patientAmt,
          institutionAmt
        );
      }

      this.db
        .prepare(
          `UPDATE sgk_invoice_batches SET
            total_prescriptions = ?, total_amount = ?, total_patient_amount = ?,
            total_institution_amount = ?, status = 'Hazırlandı', updated_at = datetime('now', 'localtime')
           WHERE id = ?`
        )
        .run(saleIds.length, totalAmount, totalPatient, totalInstitution, batchId);

      this.db
        .prepare(
          `INSERT INTO medula_operations (
            operation_no, operation_type, operation_date, status, notes, created_by
          ) VALUES (?, 'SGK_FATURA', date('now', 'localtime'), 'Tamamlandı', ?, ?)`
        )
        .run(`MOP-FAT-${Date.now()}`, `SGK fatura batch: ${batchNo}`, userId || null);

      return { batchId, batchNo, itemCount: saleIds.length };
    });

    return tx();
  }

  listBatches(filters: SgkInvoiceListFilters = {}): Record<string, unknown>[] {
    let sql = `SELECT * FROM sgk_invoice_batches WHERE 1=1`;
    const params: unknown[] = [];
    if (filters.date_from) {
      sql += ` AND date(date_from) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(date_to) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.institution?.trim()) {
      sql += ` AND institution_name LIKE ?`;
      params.push(`%${filters.institution.trim()}%`);
    }
    if (filters.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }
    sql += ` ORDER BY created_at DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  getBatchDetail(id: number): Record<string, unknown> | null {
    const batch = this.db.prepare(`SELECT * FROM sgk_invoice_batches WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    if (!batch) return null;

    const items = this.db
      .prepare(
        `SELECT bi.*, c.full_name as customer_name, c.tc_no as customer_tc,
                s.sale_no, pr.prescription_no, pr.provision_no, pr.medula_status
         FROM sgk_invoice_batch_items bi
         LEFT JOIN customers c ON c.id = bi.customer_id
         LEFT JOIN sales s ON s.id = bi.sale_id
         LEFT JOIN prescriptions pr ON pr.id = bi.prescription_id
         WHERE bi.batch_id = ?
         ORDER BY bi.id`
      )
      .all(id);

    return { ...batch, items };
  }

  markInvoiced(batchId: number, userId?: number): { batchId: number } {
    const batch = this.db.prepare(`SELECT * FROM sgk_invoice_batches WHERE id = ?`).get(batchId) as
      | Record<string, unknown>
      | undefined;
    if (!batch) throw new SgkInvoiceError('Fatura batch bulunamadı.');

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE sgk_invoice_batches SET status = 'Faturalandı', updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(batchId);

      const items = this.db
        .prepare(`SELECT sale_id, prescription_id, institution_receivable_id FROM sgk_invoice_batch_items WHERE batch_id = ?`)
        .all(batchId) as Array<Record<string, unknown>>;

      for (const item of items) {
        if (item.prescription_id) {
          this.db
            .prepare(
              `UPDATE prescriptions SET medula_status = 'Faturalandı', updated_at = datetime('now', 'localtime') WHERE id = ?`
            )
            .run(item.prescription_id);
        }
        if (item.institution_receivable_id) {
          this.receivableService.updateStatus(Number(item.institution_receivable_id), 'Faturalandı');
          this.db
            .prepare(`UPDATE institution_receivables SET invoice_batch_id = ? WHERE id = ?`)
            .run(batchId, item.institution_receivable_id);
        }
        this.db
          .prepare(`UPDATE sgk_invoice_batch_items SET status = 'Faturalandı' WHERE batch_id = ? AND sale_id = ?`)
          .run(batchId, item.sale_id);
      }
    });
    tx();
    return { batchId };
  }

  markCollected(batchId: number): { batchId: number } {
    const batch = this.db.prepare(`SELECT id FROM sgk_invoice_batches WHERE id = ?`).get(batchId);
    if (!batch) throw new SgkInvoiceError('Fatura batch bulunamadı.');

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE sgk_invoice_batches SET status = 'Tahsil Edildi', updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(batchId);

      const items = this.db
        .prepare(`SELECT institution_receivable_id FROM sgk_invoice_batch_items WHERE batch_id = ?`)
        .all(batchId) as Array<{ institution_receivable_id: number | null }>;

      for (const item of items) {
        if (item.institution_receivable_id) {
          this.receivableService.markCollected(item.institution_receivable_id);
        }
      }
    });
    tx();
    return { batchId };
  }

  exportExcel(batchId: number, filePath: string): { recordCount: number } {
    const detail = this.getBatchDetail(batchId);
    if (!detail) throw new SgkInvoiceError('Batch bulunamadı.');
    const items = (detail.items as Array<Record<string, unknown>>) || [];
    const rows = items.map((i) => ({
      Hasta: i.customer_name || '',
      'T.C.': i.customer_tc || '',
      'Reçete No': i.prescription_no || '',
      'Provizyon No': i.provision_no || '',
      'Satış No': i.sale_no || '',
      'Toplam Tutar': i.amount,
      'Hasta Payı': i.patient_amount,
      'Kurum Karşılığı': i.institution_amount,
      Durum: i.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SGK Fatura');
    XLSX.writeFile(wb, filePath);
    return { recordCount: rows.length };
  }

  getPrintHtml(batchId: number): string {
    const detail = this.getBatchDetail(batchId);
    if (!detail) return '<p>Batch bulunamadı.</p>';
    const company = this.db.prepare(`SELECT * FROM company_settings LIMIT 1`).get() as Record<string, unknown> | undefined;
    const items = (detail.items as Array<Record<string, unknown>>) || [];

    const companyHeader = company
      ? `<h2>${company.company_name || 'Firma'}</h2><p>${company.address || ''} ${company.phone || ''}</p>`
      : '';

    const rows = items
      .map(
        (i) =>
          `<tr><td>${i.customer_name}</td><td>${i.customer_tc}</td><td>${i.prescription_no}</td><td>${i.sale_no}</td><td>${i.institution_amount}</td></tr>`
      )
      .join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SGK Fatura Hazırlık</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:4px 6px}th{background:#f0f0f0}</style></head>
      <body>${companyHeader}<h3>SGK Fatura Hazırlık Listesi — ${detail.batch_no}</h3>
      <p>Dönem: ${detail.date_from} — ${detail.date_to}</p>
      <table><thead><tr><th>Hasta</th><th>T.C.</th><th>Reçete</th><th>Satış</th><th>Kurum Karşılığı</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
  }
}
