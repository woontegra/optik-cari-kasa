import type Database from 'better-sqlite3';
import type { AppointmentInput, AppointmentListFilters } from '../types/customerTracking';

export class AppointmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentValidationError';
  }
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row };
}

export class AppointmentService {
  constructor(private db: Database.Database) {}

  list(filters: AppointmentListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT a.*, c.full_name as customer_name, c.phone as customer_phone, c.whatsapp_phone
      FROM appointments a
      INNER JOIN customers c ON c.id = a.customer_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.customer_id) {
      sql += ` AND a.customer_id = ?`;
      params.push(filters.customer_id);
    }
    if (filters.status) {
      sql += ` AND a.status = ?`;
      params.push(filters.status);
    }

    const view = filters.view || 'all';
    if (view === 'today') {
      sql += ` AND date(a.appointment_date) = date('now', 'localtime')`;
    } else if (view === 'week') {
      sql += ` AND date(a.appointment_date) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+6 days')`;
    } else if (view === 'overdue') {
      sql += ` AND date(a.appointment_date) < date('now', 'localtime') AND a.status = 'Planlandı'`;
    }

    sql += ` ORDER BY a.appointment_date, a.appointment_time`;
    return (this.db.prepare(sql).all(...params) as Record<string, unknown>[]).map(mapRow);
  }

  getByCustomer(customerId: number): Record<string, unknown>[] {
    return this.list({ customer_id: customerId, view: 'all' });
  }

  getById(id: number): Record<string, unknown> | null {
    const row = this.db
      .prepare(
        `SELECT a.*, c.full_name as customer_name, c.phone as customer_phone
         FROM appointments a INNER JOIN customers c ON c.id = a.customer_id WHERE a.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  create(input: AppointmentInput, createdBy?: number): { id: number } {
    if (!input.customer_id) throw new AppointmentValidationError('Müşteri seçilmelidir.');
    if (!input.appointment_date) throw new AppointmentValidationError('Randevu tarihi zorunludur.');
    if (!input.appointment_type) throw new AppointmentValidationError('Randevu türü zorunludur.');

    const result = this.db
      .prepare(
        `INSERT INTO appointments (customer_id, appointment_date, appointment_time, appointment_type, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.customer_id,
        input.appointment_date,
        input.appointment_time || null,
        input.appointment_type,
        input.status || 'Planlandı',
        input.notes?.trim() || null,
        createdBy || null
      );
    return { id: Number(result.lastInsertRowid) };
  }

  update(id: number, input: Partial<AppointmentInput>): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new AppointmentValidationError('Randevu bulunamadı.');

    this.db
      .prepare(
        `UPDATE appointments SET
          appointment_date = COALESCE(?, appointment_date),
          appointment_time = COALESCE(?, appointment_time),
          appointment_type = COALESCE(?, appointment_type),
          status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.appointment_date ?? null,
        input.appointment_time ?? null,
        input.appointment_type ?? null,
        input.status ?? null,
        input.notes !== undefined ? input.notes?.trim() || null : null,
        id
      );
    return { id };
  }

  updateStatus(id: number, status: string): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new AppointmentValidationError('Randevu bulunamadı.');
    this.db
      .prepare(`UPDATE appointments SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(status, id);
    return { id };
  }

  cancel(id: number): { id: number } {
    return this.updateStatus(id, 'İptal');
  }

  countToday(): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as c FROM appointments
         WHERE date(appointment_date) = date('now', 'localtime') AND status IN ('Planlandı', 'Ertelendi')`
      )
      .get() as { c: number };
    return row.c;
  }

  countUpcomingControls(): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as c FROM customers
         WHERE is_active = 1 AND next_control_date IS NOT NULL
         AND date(next_control_date) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+7 days')`
      )
      .get() as { c: number };
    return row.c;
  }

  countLensRenewalSoon(): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(DISTINCT cid.customer_id) as c
         FROM customer_important_dates cid
         INNER JOIN customers c ON c.id = cid.customer_id
         WHERE cid.is_active = 1 AND c.is_active = 1
         AND (cid.title LIKE '%Lens%' OR cid.title LIKE '%lens%')
         AND date(cid.date) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')`
      )
      .get() as { c: number };
    return row.c;
  }
}
