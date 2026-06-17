import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { getAppDataPath } from '../database';
import type { CustomerInput, CustomerListFilters, CustomerQuickInput } from '../types/customer';
import type { CustomerReminderListFilters } from '../types/customerTracking';
import { CustomerAccountService } from './customerAccount.service';

export class CustomerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerValidationError';
  }
}

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

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
    whatsapp_permission: row.whatsapp_permission === 1,
    marketing_permission: row.marketing_permission === 1,
    is_vip: row.is_vip === 1,
  };
}

function customerPhotoDir(): string {
  const dir = path.join(getAppDataPath(), 'customer-photos');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export class CustomerService {
  constructor(private db: Database.Database) {}

  private buildFilterSql(filters: CustomerListFilters | CustomerReminderListFilters): {
    sql: string;
    params: unknown[];
  } {
    let sql = `SELECT c.* FROM customers c WHERE 1=1`;
    const params: unknown[] = [];

    if (filters.search?.trim()) {
      sql += ` AND (c.full_name LIKE ? OR c.tc_no LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.second_phone LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term, term);
    }
    if ('status' in filters && filters.status === 'Aktif') {
      sql += ` AND (c.is_active = 1 OR c.is_active IS NULL)`;
    } else if ('status' in filters && filters.status === 'Pasif') {
      sql += ` AND c.is_active = 0`;
    }
    if (filters.customer_category) {
      sql += ` AND c.customer_category = ?`;
      params.push(filters.customer_category);
    }
    if (filters.birthday_this_month) {
      sql += ` AND c.birth_date IS NOT NULL AND strftime('%m', c.birth_date) = strftime('%m', 'now', 'localtime')`;
    }
    if (filters.upcoming_control) {
      sql += ` AND c.next_control_date IS NOT NULL AND date(c.next_control_date) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')`;
    }
    if (filters.lens_renewal_soon) {
      sql += ` AND EXISTS (
        SELECT 1 FROM customer_important_dates cid
        WHERE cid.customer_id = c.id AND cid.is_active = 1
        AND (cid.title LIKE '%Lens%' OR cid.title LIKE '%lens%')
        AND date(cid.date) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')
      )`;
    }
    if (filters.has_debt) {
      sql += ` AND c.balance > 0`;
    }
    if (filters.inactive_6_months) {
      sql += ` AND (c.last_sale_date IS NULL OR date(c.last_sale_date) < date('now', 'localtime', '-6 months'))`;
    }
    if (filters.marketing_permission) {
      sql += ` AND c.marketing_permission = 1`;
    }
    if (filters.whatsapp_permission) {
      sql += ` AND c.whatsapp_permission = 1`;
    }
    if (filters.sms_permission) {
      sql += ` AND c.sms_permission = 1`;
    }
    if (filters.email_permission) {
      sql += ` AND c.email_permission = 1`;
    }

    return { sql, params };
  }

  list(filters: CustomerListFilters = {}): Record<string, unknown>[] {
    const { sql, params } = this.buildFilterSql(filters);
    const rows = this.db.prepare(`${sql} ORDER BY c.full_name`).all(...params) as Record<string, unknown>[];
    return rows.map(mapRow);
  }

  getReminderLists(filters: CustomerReminderListFilters = {}): Record<string, unknown>[] {
    return this.list(filters);
  }

  listCategories(): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT * FROM optical_lookup_values WHERE type = 'CUSTOMER_CATEGORY' AND is_active = 1 ORDER BY sort_order, name`
      )
      .all() as Record<string, unknown>[];
  }

  search(query: string, limit = 20): Record<string, unknown>[] {
    if (!query.trim()) return [];
    const term = `%${query.trim()}%`;
    const rows = this.db
      .prepare(
        `SELECT id, full_name, tc_no, phone, email, balance, is_active, customer_category
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
    if (!row) return null;
    const mapped = mapRow(row);

    const referredBy = row.referred_by_customer_id
      ? (this.db.prepare(`SELECT full_name FROM customers WHERE id = ?`).get(row.referred_by_customer_id) as
          | { full_name: string }
          | undefined)
      : undefined;
    if (referredBy) mapped.referred_by_name = referredBy.full_name;

    const lastPrescription = this.db
      .prepare(
        `SELECT prescription_no, prescription_date FROM prescriptions WHERE customer_id = ? ORDER BY prescription_date DESC LIMIT 1`
      )
      .get(id) as { prescription_no: string; prescription_date: string } | undefined;
    if (lastPrescription) {
      mapped.last_prescription_no = lastPrescription.prescription_no;
      mapped.last_prescription_date = lastPrescription.prescription_date;
    }

    const nextAppointment = this.db
      .prepare(
        `SELECT id, appointment_date, appointment_time, appointment_type FROM appointments
         WHERE customer_id = ? AND status IN ('Planlandı', 'Ertelendi') AND date(appointment_date) >= date('now', 'localtime')
         ORDER BY appointment_date, appointment_time LIMIT 1`
      )
      .get(id) as Record<string, unknown> | undefined;
    if (nextAppointment) mapped.next_appointment = nextAppointment;

    return mapped;
  }

  isTcTaken(tcNo: string, excludeId?: number): boolean {
    if (!tcNo.trim()) return false;
    const row = this.db
      .prepare(`SELECT id FROM customers WHERE tc_no = ? AND (is_active = 1 OR is_active IS NULL)`)
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

  private insertParams(input: CustomerInput): unknown[] {
    return [
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
      input.customer_category?.trim() || null,
      input.second_phone?.trim() || null,
      input.whatsapp_phone?.trim() || null,
      input.institution_name?.trim() || null,
      input.institution_no?.trim() || null,
      input.occupation?.trim() || null,
      input.reference_source?.trim() || null,
      input.referred_by_customer_id || null,
      input.last_visit_date || null,
      input.next_control_date || null,
      input.whatsapp_permission ? 1 : 0,
      input.marketing_permission ? 1 : 0,
      input.important_note?.trim() || null,
      input.risk_note?.trim() || null,
      input.is_vip ? 1 : 0,
    ];
  }

  create(input: CustomerInput): { id: number } {
    this.validate(input);
    const result = this.db
      .prepare(
        `INSERT INTO customers (
          full_name, tc_no, phone, email, birth_date, address, city, district, notes,
          kvkk_consent, sms_permission, email_permission, is_active,
          customer_category, second_phone, whatsapp_phone, institution_name, institution_no,
          occupation, reference_source, referred_by_customer_id, last_visit_date, next_control_date,
          whatsapp_permission, marketing_permission, important_note, risk_note, is_vip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...this.insertParams(input));
    return { id: Number(result.lastInsertRowid) };
  }

  createQuick(input: CustomerQuickInput): { id: number } {
    if (!input.full_name?.trim()) {
      throw new CustomerValidationError('Ad soyad zorunludur.');
    }
    return this.create({ full_name: input.full_name, phone: input.phone, is_active: true });
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
          customer_category = ?, second_phone = ?, whatsapp_phone = ?,
          institution_name = ?, institution_no = ?, occupation = ?,
          reference_source = ?, referred_by_customer_id = ?,
          last_visit_date = ?, next_control_date = ?,
          whatsapp_permission = ?, marketing_permission = ?,
          important_note = ?, risk_note = ?, is_vip = ?,
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(...this.insertParams(input), id);
    return { id };
  }

  deactivate(id: number): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new CustomerValidationError('Müşteri bulunamadı.');
    this.db
      .prepare(`UPDATE customers SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(id);
    return { id };
  }

  uploadPhoto(customerId: number, sourcePath: string): { photo_path: string } {
    const customer = this.getById(customerId);
    if (!customer) throw new CustomerValidationError('Müşteri bulunamadı.');
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new CustomerValidationError('Fotoğraf dosyası bulunamadı.');
    }
    const ext = path.extname(sourcePath).toLowerCase();
    if (!PHOTO_EXTENSIONS.has(ext)) {
      throw new CustomerValidationError('Desteklenen formatlar: jpg, jpeg, png, webp');
    }

    if (customer.photo_path && fs.existsSync(String(customer.photo_path))) {
      try {
        fs.unlinkSync(String(customer.photo_path));
      } catch {
        /* ignore */
      }
    }

    const destPath = path.join(customerPhotoDir(), `${customerId}${ext}`);
    fs.copyFileSync(sourcePath, destPath);
    this.db
      .prepare(`UPDATE customers SET photo_path = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(destPath, customerId);
    return { photo_path: destPath };
  }

  removePhoto(customerId: number): { removed: boolean } {
    const customer = this.getById(customerId);
    if (!customer) throw new CustomerValidationError('Müşteri bulunamadı.');
    if (customer.photo_path && fs.existsSync(String(customer.photo_path))) {
      try {
        fs.unlinkSync(String(customer.photo_path));
      } catch {
        /* ignore */
      }
    }
    this.db
      .prepare(`UPDATE customers SET photo_path = NULL, updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(customerId);
    return { removed: true };
  }

  countDebtors(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as c FROM customers WHERE is_active = 1 AND balance > 0`)
      .get() as { c: number };
    return row.c;
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
