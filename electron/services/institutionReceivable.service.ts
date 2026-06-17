import type Database from 'better-sqlite3';
import type {
  InstitutionPaymentInput,
  InstitutionReceivableListFilters,
  InstitutionReceivableStatus,
} from '../types/institutionReceivable';

export class InstitutionReceivableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstitutionReceivableError';
  }
}

export class InstitutionReceivableService {
  constructor(private db: Database.Database) {}

  list(filters: InstitutionReceivableListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT ir.*, c.full_name as customer_name, c.tc_no as customer_tc,
             s.sale_no, pr.prescription_no, pr.e_prescription_no, pr.prescription_date
      FROM institution_receivables ir
      LEFT JOIN customers c ON c.id = ir.customer_id
      LEFT JOIN sales s ON s.id = ir.sale_id
      LEFT JOIN prescriptions pr ON pr.id = ir.prescription_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.date_from) {
      sql += ` AND date(ir.created_at) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(ir.created_at) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.institution?.trim()) {
      sql += ` AND ir.institution_name LIKE ?`;
      params.push(`%${filters.institution.trim()}%`);
    }
    if (filters.status) {
      sql += ` AND ir.status = ?`;
      params.push(filters.status);
    }
    if (filters.customer_search?.trim()) {
      sql += ` AND (c.full_name LIKE ? OR c.tc_no LIKE ?)`;
      const term = `%${filters.customer_search.trim()}%`;
      params.push(term, term);
    }
    if (filters.sale_no?.trim()) {
      sql += ` AND s.sale_no LIKE ?`;
      params.push(`%${filters.sale_no.trim()}%`);
    }

    sql += ` ORDER BY ir.created_at DESC, ir.id DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  getBySaleId(saleId: number): Record<string, unknown> | null {
    return (
      (this.db.prepare(`SELECT * FROM institution_receivables WHERE sale_id = ?`).get(saleId) as
        | Record<string, unknown>
        | undefined) || null
    );
  }

  createOrUpdateFromSale(
    saleId: number,
    payment: InstitutionPaymentInput
  ): { id: number; created: boolean } {
    const sale = this.db
      .prepare(
        `SELECT s.*, pr.id as prescription_id, pr.institution, pr.institution_code, pr.prescription_type
         FROM sales s
         LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
         WHERE s.id = ?`
      )
      .get(saleId) as Record<string, unknown> | undefined;

    if (!sale) throw new InstitutionReceivableError('Satış bulunamadı.');

    const institutionAmt = payment.institution_amount ?? 0;
    if (institutionAmt <= 0) {
      throw new InstitutionReceivableError('Kurum karşılığı tutarı girilmelidir.');
    }

    const total = Number(sale.net_amount) || 0;
    const patientAmt = payment.patient_amount ?? 0;
    const collected = payment.collected_patient_amount ?? patientAmt;
    const remaining = Math.max(0, institutionAmt);

    const existing = this.getBySaleId(saleId);
    const now = "datetime('now', 'localtime')";

    if (existing) {
      this.db
        .prepare(
          `UPDATE institution_receivables SET
            total_amount = ?, patient_amount = ?, institution_amount = ?,
            collected_patient_amount = ?, remaining_institution_amount = ?,
            notes = ?, updated_at = ${now}
           WHERE id = ?`
        )
        .run(total, patientAmt, institutionAmt, collected, remaining, payment.notes || null, existing.id);
      return { id: Number(existing.id), created: false };
    }

    const result = this.db
      .prepare(
        `INSERT INTO institution_receivables (
          prescription_id, sale_id, customer_id, institution_name, institution_code,
          total_amount, patient_amount, institution_amount, collected_patient_amount,
          remaining_institution_amount, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Bekliyor', ?)`
      )
      .run(
        sale.prescription_id || null,
        saleId,
        sale.customer_id || null,
        sale.institution || null,
        sale.institution_code || null,
        total,
        patientAmt,
        institutionAmt,
        collected,
        remaining,
        payment.notes || null
      );

    return { id: Number(result.lastInsertRowid), created: true };
  }

  updateFromMedulaInfo(
    saleId: number,
    data: {
      institution_amount?: number;
      patient_amount?: number;
      contribution_amount?: number;
      notes?: string;
    }
  ): { id: number } {
    const rec = this.getBySaleId(saleId);
    if (!rec) {
      return this.createOrUpdateFromSale(saleId, {
        patient_amount: data.patient_amount ?? 0,
        institution_amount: data.institution_amount ?? 0,
        contribution_amount: data.contribution_amount,
        notes: data.notes,
      });
    }

    const institutionAmt = data.institution_amount ?? Number(rec.institution_amount);
    const patientAmt = data.patient_amount ?? Number(rec.patient_amount);
    const remaining = Math.max(0, institutionAmt - (Number(rec.collected_institution) || 0));

    this.db
      .prepare(
        `UPDATE institution_receivables SET
          patient_amount = ?, institution_amount = ?, remaining_institution_amount = ?,
          notes = COALESCE(?, notes), updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(patientAmt, institutionAmt, remaining, data.notes || null, rec.id);

    return { id: Number(rec.id) };
  }

  updateStatus(id: number, status: InstitutionReceivableStatus): { id: number } {
    const rec = this.db.prepare(`SELECT id FROM institution_receivables WHERE id = ?`).get(id);
    if (!rec) throw new InstitutionReceivableError('Kurum alacağı bulunamadı.');
    this.db
      .prepare(
        `UPDATE institution_receivables SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(status, id);
    return { id };
  }

  markCollected(id: number): { id: number } {
    const rec = this.db
      .prepare(`SELECT * FROM institution_receivables WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    if (!rec) throw new InstitutionReceivableError('Kurum alacağı bulunamadı.');

    this.db
      .prepare(
        `UPDATE institution_receivables SET
          status = 'Tahsil Edildi', remaining_institution_amount = 0,
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(id);
    return { id };
  }

  getDashboardStats(): { pendingTotal: number; pendingCount: number } {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as count, COALESCE(SUM(remaining_institution_amount), 0) as total
         FROM institution_receivables
         WHERE status IN ('Bekliyor', 'Faturaya Hazır', 'Faturalandı')`
      )
      .get() as { count: number; total: number };
    return { pendingTotal: row.total, pendingCount: row.count };
  }

  getReportSummary(dateFrom?: string, dateTo?: string): Record<string, unknown> {
    let sql = `SELECT status, COUNT(*) as count, COALESCE(SUM(remaining_institution_amount), 0) as remaining,
                      COALESCE(SUM(institution_amount), 0) as total_institution
               FROM institution_receivables WHERE 1=1`;
    const params: unknown[] = [];
    if (dateFrom) {
      sql += ` AND date(created_at) >= date(?)`;
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ` AND date(created_at) <= date(?)`;
      params.push(dateTo);
    }
    sql += ` GROUP BY status`;
    const byStatus = this.db.prepare(sql).all(...params);
    const collected = this.db
      .prepare(
        `SELECT COALESCE(SUM(institution_amount), 0) as total FROM institution_receivables WHERE status = 'Tahsil Edildi'`
      )
      .get() as { total: number };
    const pending = this.db
      .prepare(
        `SELECT COALESCE(SUM(remaining_institution_amount), 0) as total FROM institution_receivables
         WHERE status IN ('Bekliyor', 'Faturaya Hazır', 'Faturalandı')`
      )
      .get() as { total: number };
    return { byStatus, collectedTotal: collected.total, pendingTotal: pending.total };
  }
}
