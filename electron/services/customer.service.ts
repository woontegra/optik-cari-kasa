import type Database from 'better-sqlite3';
import type { CustomerInput, CustomerListFilters, CustomerQuickInput } from '../types/customer';
import { CustomerAccountService } from './customerAccount.service';

export class CustomerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerValidationError';
  }
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  const isActive = row.is_active === 1 || row.is_active === undefined;
  return {
    ...row,
    is_active: isActive ? 1 : 0,
    status: isActive ? 'Aktif' : 'Pasif',
    kvkk_consent: row.kvkk_consent === 1,
    sms_permission: row.sms_permission === 1,
    email_permission: row.email_permission === 1,
  };
}

export class CustomerService {
  constructor(private db: Database.Database) {}

  list(filters: CustomerListFilters = {}): Record<string, unknown>[] {
    let sql = `SELECT * FROM customers WHERE 1=1`;
    const params: unknown[] = [];

    if (filters.search?.trim()) {
      sql += ` AND (full_name LIKE ? OR tc_no LIKE ? OR phone LIKE ? OR email LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term);
    }
    if (filters.status === 'Aktif') {
      sql += ` AND (is_active = 1 OR is_active IS NULL)`;
    } else if (filters.status === 'Pasif') {
      sql += ` AND is_active = 0`;
    }

    sql += ` ORDER BY full_name`;
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(mapRow);
  }

  search(query: string, limit = 20): Record<string, unknown>[] {
    if (!query.trim()) return [];
    const term = `%${query.trim()}%`;
    const rows = this.db
      .prepare(
        `SELECT id, full_name, tc_no, phone, email, balance, is_active
         FROM customers
         WHERE (is_active = 1 OR is_active IS NULL)
           AND (full_name LIKE ? OR tc_no LIKE ? OR phone LIKE ?)
         ORDER BY full_name LIMIT ?`
      )
      .all(term, term, term, limit) as Record<string, unknown>[];
    return rows.map(mapRow);
  }

  getById(id: number): Record<string, unknown> | null {
    const row = this.db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapRow(row) : null;
  }

  isTcTaken(tcNo: string, excludeId?: number): boolean {
    if (!tcNo.trim()) return false;
    const row = this.db
      .prepare(
        `SELECT id FROM customers WHERE tc_no = ? AND (is_active = 1 OR is_active IS NULL)`
      )
      .get(tcNo.trim()) as { id: number } | undefined;
    if (!row) return false;
    if (excludeId && row.id === excludeId) return false;
    return true;
  }

  validate(input: CustomerInput, excludeId?: number): void {
    if (!input.full_name?.trim()) {
      throw new CustomerValidationError('Ad soyad zorunludur.');
    }
    if (input.tc_no?.trim()) {
      const tc = input.tc_no.trim();
      if (!/^\d{11}$/.test(tc)) {
        throw new CustomerValidationError('T.C. kimlik no 11 haneli olmalıdır.');
      }
      if (this.isTcTaken(tc, excludeId)) {
        throw new CustomerValidationError('Bu T.C. kimlik no ile kayıtlı aktif müşteri zaten var.');
      }
    }
    if (input.email?.trim() && !validateEmail(input.email.trim())) {
      throw new CustomerValidationError('Geçerli bir e-posta adresi girin.');
    }
  }

  create(input: CustomerInput): { id: number } {
    this.validate(input);
    const result = this.db
      .prepare(
        `INSERT INTO customers (
          full_name, tc_no, phone, email, birth_date, address, city, district, notes,
          kvkk_consent, sms_permission, email_permission, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.full_name.trim(),
        input.tc_no?.trim() || null,
        input.phone?.trim() || null,
        input.email?.trim() || null,
        input.birth_date || null,
        input.address?.trim() || null,
        input.city?.trim() || null,
        input.district?.trim() || null,
        input.notes?.trim() || null,
        input.kvkk_consent ? 1 : 0,
        input.sms_permission ? 1 : 0,
        input.email_permission ? 1 : 0,
        input.is_active !== false ? 1 : 0
      );
    return { id: Number(result.lastInsertRowid) };
  }

  createQuick(input: CustomerQuickInput): { id: number } {
    if (!input.full_name?.trim()) {
      throw new CustomerValidationError('Ad soyad zorunludur.');
    }
    return this.create({
      full_name: input.full_name,
      phone: input.phone,
      is_active: true,
    });
  }

  update(id: number, input: CustomerInput): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new CustomerValidationError('Müşteri bulunamadı.');
    this.validate(input, id);

    this.db
      .prepare(
        `UPDATE customers SET
          full_name = ?, tc_no = ?, phone = ?, email = ?, birth_date = ?,
          address = ?, city = ?, district = ?, notes = ?,
          kvkk_consent = ?, sms_permission = ?, email_permission = ?, is_active = ?,
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.full_name.trim(),
        input.tc_no?.trim() || null,
        input.phone?.trim() || null,
        input.email?.trim() || null,
        input.birth_date || null,
        input.address?.trim() || null,
        input.city?.trim() || null,
        input.district?.trim() || null,
        input.notes?.trim() || null,
        input.kvkk_consent ? 1 : 0,
        input.sms_permission ? 1 : 0,
        input.email_permission ? 1 : 0,
        input.is_active !== false ? 1 : 0,
        id
      );
    return { id };
  }

  deactivate(id: number): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new CustomerValidationError('Müşteri bulunamadı.');
    this.db
      .prepare(
        `UPDATE customers SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(id);
    return { id };
  }

  getSalesByCustomer(customerId: number): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT s.*, pr.prescription_no, pr.e_prescription_no
         FROM sales s
         LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
         WHERE s.customer_id = ?
         ORDER BY s.sale_date DESC`
      )
      .all(customerId) as Record<string, unknown>[];
  }

  getAccountMovements(customerId: number): Record<string, unknown>[] {
    return new CustomerAccountService(this.db).listMovements(customerId);
  }
}
