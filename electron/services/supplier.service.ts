import type Database from 'better-sqlite3';
import type { SupplierInput } from '../types/supplier';
import { SupplierAccountService } from './supplierAccount.service';
import { PurchaseService } from './purchase.service';

export class SupplierValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupplierValidationError';
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email?: string): void {
  if (email?.trim() && !EMAIL_RE.test(email.trim())) {
    throw new SupplierValidationError('Geçerli bir e-posta adresi girin.');
  }
}

export class SupplierService {
  private accountService: SupplierAccountService;
  private purchaseService: PurchaseService;

  constructor(private db: Database.Database) {
    this.accountService = new SupplierAccountService(db);
    this.purchaseService = new PurchaseService(db);
  }

  list(activeOnly = true): Record<string, unknown>[] {
    let sql = `
      SELECT s.*,
        (SELECT MAX(created_at) FROM supplier_account_movements WHERE supplier_id = s.id) as last_transaction_at
      FROM suppliers s
      WHERE 1=1
    `;
    if (activeOnly) sql += ` AND s.is_active = 1`;
    sql += ` ORDER BY s.name`;
    return this.db.prepare(sql).all() as Record<string, unknown>[];
  }

  listAll(): Record<string, unknown>[] {
    return this.list(false);
  }

  getById(id: number): Record<string, unknown> | null {
    const row = this.db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ?? null;
  }

  getDetail(id: number): Record<string, unknown> | null {
    const supplier = this.getById(id);
    if (!supplier) return null;
    return {
      ...supplier,
      purchases: this.purchaseService.listBySupplier(id),
      accountMovements: this.accountService.listMovements(id),
      payments: this.accountService.listPayments(id),
    };
  }

  private checkTaxNoDuplicate(taxNo: string | undefined, excludeId?: number): void {
    if (!taxNo?.trim()) return;
    let sql = `SELECT id, name FROM suppliers WHERE tax_no = ? AND is_active = 1`;
    const params: unknown[] = [taxNo.trim()];
    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }
    const existing = this.db.prepare(sql).get(...params) as { id: number; name: string } | undefined;
    if (existing) {
      throw new SupplierValidationError(
        `Bu vergi numarası başka bir aktif tedarikçide kayıtlı: ${existing.name}`
      );
    }
  }

  create(input: SupplierInput): { id: number; warning?: string } {
    if (!input.name?.trim()) {
      throw new SupplierValidationError('Firma adı zorunludur.');
    }
    validateEmail(input.email);
    this.checkTaxNoDuplicate(input.tax_no);

    const result = this.db
      .prepare(
        `INSERT INTO suppliers (
          name, authorized_person, phone, email, tax_office, tax_no,
          city, district, address, notes, is_active, balance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`
      )
      .run(
        input.name.trim(),
        input.authorized_person?.trim() || null,
        input.phone?.trim() || null,
        input.email?.trim() || null,
        input.tax_office?.trim() || null,
        input.tax_no?.trim() || null,
        input.city?.trim() || null,
        input.district?.trim() || null,
        input.address?.trim() || null,
        input.notes?.trim() || null
      );
    return { id: Number(result.lastInsertRowid) };
  }

  update(id: number, input: SupplierInput): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new SupplierValidationError('Tedarikçi bulunamadı.');
    if (!input.name?.trim()) throw new SupplierValidationError('Firma adı zorunludur.');
    validateEmail(input.email);
    this.checkTaxNoDuplicate(input.tax_no, id);

    this.db
      .prepare(
        `UPDATE suppliers SET
          name = ?, authorized_person = ?, phone = ?, email = ?, tax_office = ?, tax_no = ?,
          city = ?, district = ?, address = ?, notes = ?,
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.name.trim(),
        input.authorized_person?.trim() || null,
        input.phone?.trim() || null,
        input.email?.trim() || null,
        input.tax_office?.trim() || null,
        input.tax_no?.trim() || null,
        input.city?.trim() || null,
        input.district?.trim() || null,
        input.address?.trim() || null,
        input.notes?.trim() || null,
        id
      );
    return { id };
  }

  deactivate(id: number): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new SupplierValidationError('Tedarikçi bulunamadı.');
    this.db
      .prepare(
        `UPDATE suppliers SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(id);
    return { id };
  }

  getAccountMovements(supplierId: number): Record<string, unknown>[] {
    return this.accountService.listMovements(supplierId);
  }
}
