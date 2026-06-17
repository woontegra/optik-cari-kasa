import type Database from 'better-sqlite3';
import type { PosAccountInput } from '../types/finance';

export class PosValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PosValidationError';
  }
}

export class PosService {
  constructor(private db: Database.Database) {}

  listAccounts(activeOnly = true): Record<string, unknown>[] {
    let sql = `
      SELECT p.*, b.account_name as bank_account_name
      FROM pos_accounts p
      LEFT JOIN bank_accounts b ON b.id = p.bank_account_id
      WHERE 1=1
    `;
    if (activeOnly) sql += ` AND p.is_active = 1`;
    sql += ` ORDER BY p.name`;
    return this.db.prepare(sql).all() as Record<string, unknown>[];
  }

  getDefaultAccount(): Record<string, unknown> | null {
    const row = this.db
      .prepare(`SELECT p.* FROM pos_accounts p WHERE p.is_active = 1 ORDER BY p.id LIMIT 1`)
      .get() as Record<string, unknown> | undefined;
    return row ?? null;
  }

  createAccount(input: PosAccountInput): { id: number } {
    if (!input.name?.trim()) throw new PosValidationError('POS adı zorunludur.');
    const result = this.db
      .prepare(
        `INSERT INTO pos_accounts (name, bank_account_id, commission_rate, block_days, is_active, notes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name.trim(),
        input.bank_account_id ?? null,
        input.commission_rate ?? 0,
        input.block_days ?? 0,
        input.is_active === false ? 0 : 1,
        input.notes?.trim() || null
      );
    return { id: Number(result.lastInsertRowid) };
  }

  updateAccount(id: number, input: Partial<PosAccountInput>): { id: number } {
    const existing = this.db.prepare(`SELECT id FROM pos_accounts WHERE id = ?`).get(id);
    if (!existing) throw new PosValidationError('POS hesabı bulunamadı.');
    this.db
      .prepare(
        `UPDATE pos_accounts SET
          name = COALESCE(?, name),
          bank_account_id = COALESCE(?, bank_account_id),
          commission_rate = COALESCE(?, commission_rate),
          block_days = COALESCE(?, block_days),
          is_active = COALESCE(?, is_active),
          notes = COALESCE(?, notes),
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.name?.trim() || null,
        input.bank_account_id ?? null,
        input.commission_rate ?? null,
        input.block_days ?? null,
        input.is_active === undefined ? null : input.is_active ? 1 : 0,
        input.notes?.trim() || null,
        id
      );
    return { id };
  }

  recordSalePayment(saleId: number, posAccountId: number, grossAmount: number): { id: number } {
    if (grossAmount <= 0) throw new PosValidationError('POS tutarı 0\'dan büyük olmalıdır.');
    const pos = this.db
      .prepare(`SELECT * FROM pos_accounts WHERE id = ? AND is_active = 1`)
      .get(posAccountId) as Record<string, unknown> | undefined;
    if (!pos) throw new PosValidationError('POS hesabı bulunamadı.');

    const commissionRate = Number(pos.commission_rate || 0);
    const blockDays = Number(pos.block_days || 0);
    const commissionAmount = Math.round(grossAmount * commissionRate) / 100;
    const netAmount = grossAmount - commissionAmount;

    const expected = new Date();
    expected.setDate(expected.getDate() + blockDays);
    const expectedTransferDate = expected.toISOString().slice(0, 10);

    const result = this.db
      .prepare(
        `INSERT INTO pos_movements (
          pos_account_id, sale_id, gross_amount, commission_amount, net_amount, expected_transfer_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'Bekliyor')`
      )
      .run(posAccountId, saleId, grossAmount, commissionAmount, netAmount, expectedTransferDate);

    return { id: Number(result.lastInsertRowid) };
  }

  listMovements(filters?: { pos_account_id?: number; date_from?: string; date_to?: string; status?: string }): Record<string, unknown>[] {
    let sql = `
      SELECT pm.*, p.name as pos_name, s.sale_no
      FROM pos_movements pm
      INNER JOIN pos_accounts p ON p.id = pm.pos_account_id
      LEFT JOIN sales s ON s.id = pm.sale_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters?.pos_account_id) {
      sql += ` AND pm.pos_account_id = ?`;
      params.push(filters.pos_account_id);
    }
    if (filters?.status) {
      sql += ` AND pm.status = ?`;
      params.push(filters.status);
    }
    if (filters?.date_from) {
      sql += ` AND date(pm.created_at) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters?.date_to) {
      sql += ` AND date(pm.created_at) <= date(?)`;
      params.push(filters.date_to);
    }
    sql += ` ORDER BY pm.created_at DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  getPendingTotal(): number {
    const row = this.db
      .prepare(`SELECT COALESCE(SUM(net_amount), 0) as total FROM pos_movements WHERE status = 'Bekliyor'`)
      .get() as { total: number };
    return row.total;
  }
}
