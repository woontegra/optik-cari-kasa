import type Database from 'better-sqlite3';
import type { BankAccountInput, BankMovementInput } from '../types/finance';

export class BankValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BankValidationError';
  }
}

export class BankService {
  constructor(private db: Database.Database) {}

  listAccounts(activeOnly = true): Record<string, unknown>[] {
    let sql = `SELECT * FROM bank_accounts WHERE 1=1`;
    if (activeOnly) sql += ` AND is_active = 1`;
    sql += ` ORDER BY account_name`;
    return this.db.prepare(sql).all() as Record<string, unknown>[];
  }

  createAccount(input: BankAccountInput): { id: number } {
    if (!input.account_name?.trim() || !input.bank_name?.trim()) {
      throw new BankValidationError('Hesap adı ve banka adı zorunludur.');
    }
    const opening = input.opening_balance ?? 0;
    const result = this.db
      .prepare(
        `INSERT INTO bank_accounts (
          account_name, bank_name, iban, branch_name, account_no, opening_balance, current_balance, is_active, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.account_name.trim(),
        input.bank_name.trim(),
        input.iban?.trim() || null,
        input.branch_name?.trim() || null,
        input.account_no?.trim() || null,
        opening,
        opening,
        input.is_active === false ? 0 : 1,
        input.notes?.trim() || null
      );
    return { id: Number(result.lastInsertRowid) };
  }

  updateAccount(id: number, input: Partial<BankAccountInput>): { id: number } {
    const existing = this.db.prepare(`SELECT * FROM bank_accounts WHERE id = ?`).get(id);
    if (!existing) throw new BankValidationError('Banka hesabı bulunamadı.');
    this.db
      .prepare(
        `UPDATE bank_accounts SET
          account_name = COALESCE(?, account_name),
          bank_name = COALESCE(?, bank_name),
          iban = COALESCE(?, iban),
          branch_name = COALESCE(?, branch_name),
          account_no = COALESCE(?, account_no),
          is_active = COALESCE(?, is_active),
          notes = COALESCE(?, notes),
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.account_name?.trim() || null,
        input.bank_name?.trim() || null,
        input.iban?.trim() || null,
        input.branch_name?.trim() || null,
        input.account_no?.trim() || null,
        input.is_active === undefined ? null : input.is_active ? 1 : 0,
        input.notes?.trim() || null,
        id
      );
    return { id };
  }

  private adjustBalance(accountId: number, delta: number): void {
    this.db
      .prepare(
        `UPDATE bank_accounts SET current_balance = current_balance + ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(delta, accountId);
  }

  addMovement(input: BankMovementInput, userId?: number): { id: number } {
    if (input.amount <= 0) throw new BankValidationError('Tutar 0\'dan büyük olmalıdır.');
    const signed = input.direction === 'in' ? input.amount : -input.amount;
    const result = this.db
      .prepare(
        `INSERT INTO bank_movements (
          bank_account_id, movement_type, amount, direction, description, movement_date,
          related_customer_id, related_supplier_id, related_expense_id, created_by
        ) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')), ?, ?, ?, ?)`
      )
      .run(
        input.bank_account_id,
        input.movement_type,
        Math.abs(input.amount),
        input.direction,
        input.description || null,
        input.movement_date || null,
        input.related_customer_id ?? null,
        input.related_supplier_id ?? null,
        input.related_expense_id ?? null,
        userId ?? null
      );
    const id = Number(result.lastInsertRowid);
    this.adjustBalance(input.bank_account_id, signed);
    return { id };
  }

  listMovements(filters?: { bank_account_id?: number; date_from?: string; date_to?: string }): Record<string, unknown>[] {
    let sql = `
      SELECT bm.*, ba.account_name, ba.bank_name
      FROM bank_movements bm
      INNER JOIN bank_accounts ba ON ba.id = bm.bank_account_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters?.bank_account_id) {
      sql += ` AND bm.bank_account_id = ?`;
      params.push(filters.bank_account_id);
    }
    if (filters?.date_from) {
      sql += ` AND date(bm.movement_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters?.date_to) {
      sql += ` AND date(bm.movement_date) <= date(?)`;
      params.push(filters.date_to);
    }
    sql += ` ORDER BY bm.movement_date DESC, bm.id DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  transferCashToBank(bankAccountId: number, amount: number, description: string, userId?: number): { cashMovementId: number; bankMovementId: number } {
    if (amount <= 0) throw new BankValidationError('Aktarım tutarı 0\'dan büyük olmalıdır.');

    const tx = this.db.transaction(() => {
      const cashResult = this.db
        .prepare(
          `INSERT INTO cash_movements (movement_type, description, payment_type, amount, reference_type, reference_id, movement_date)
           VALUES ('Çıkış', ?, 'Nakit', ?, 'bank_transfer', ?, datetime('now', 'localtime'))`
        )
        .run(description || 'Kasadan bankaya aktarım', -Math.abs(amount), bankAccountId);

      const cashMovementId = Number(cashResult.lastInsertRowid);

      const bankResult = this.db
        .prepare(
          `INSERT INTO bank_movements (
            bank_account_id, movement_type, amount, direction, related_cash_movement_id, description, movement_date, created_by
          ) VALUES (?, 'Kasadan bankaya aktarım', ?, 'in', ?, ?, datetime('now', 'localtime'), ?)`
        )
        .run(bankAccountId, amount, cashMovementId, description || 'Kasadan bankaya aktarım', userId ?? null);

      const bankMovementId = Number(bankResult.lastInsertRowid);
      this.adjustBalance(bankAccountId, amount);
      return { cashMovementId, bankMovementId };
    });

    return tx();
  }

  transferBankToCash(bankAccountId: number, amount: number, description: string, userId?: number): { cashMovementId: number; bankMovementId: number } {
    if (amount <= 0) throw new BankValidationError('Aktarım tutarı 0\'dan büyük olmalıdır.');

    const account = this.db
      .prepare(`SELECT current_balance FROM bank_accounts WHERE id = ? AND is_active = 1`)
      .get(bankAccountId) as { current_balance: number } | undefined;
    if (!account) throw new BankValidationError('Banka hesabı bulunamadı.');
    if (Number(account.current_balance) < amount) {
      throw new BankValidationError('Banka bakiyesi yetersiz.');
    }

    const tx = this.db.transaction(() => {
      const bankResult = this.db
        .prepare(
          `INSERT INTO bank_movements (
            bank_account_id, movement_type, amount, direction, description, movement_date, created_by
          ) VALUES (?, 'Bankadan kasaya aktarım', ?, 'out', ?, datetime('now', 'localtime'), ?)`
        )
        .run(bankAccountId, amount, description || 'Bankadan kasaya aktarım', userId ?? null);
      const bankMovementId = Number(bankResult.lastInsertRowid);
      this.adjustBalance(bankAccountId, -amount);

      const cashResult = this.db
        .prepare(
          `INSERT INTO cash_movements (movement_type, description, payment_type, amount, reference_type, reference_id, movement_date)
           VALUES ('Giriş', ?, 'Nakit', ?, 'bank_transfer', ?, datetime('now', 'localtime'))`
        )
        .run(description || 'Bankadan kasaya aktarım', amount, bankMovementId);

      return { cashMovementId: Number(cashResult.lastInsertRowid), bankMovementId };
    });

    return tx();
  }

  recordSupplierPayment(
    bankAccountId: number,
    supplierId: number,
    amount: number,
    description: string,
    userId?: number
  ): { bankMovementId: number } {
    const result = this.addMovement(
      {
        bank_account_id: bankAccountId,
        movement_type: 'Tedarikçi ödemesi',
        amount,
        direction: 'out',
        description,
        related_supplier_id: supplierId,
      },
      userId
    );
    return { bankMovementId: result.id };
  }

  recordCustomerCollection(
    bankAccountId: number,
    customerId: number,
    amount: number,
    description: string,
    userId?: number
  ): { bankMovementId: number } {
    const result = this.addMovement(
      {
        bank_account_id: bankAccountId,
        movement_type: 'Müşteri tahsilatı',
        amount,
        direction: 'in',
        description,
        related_customer_id: customerId,
      },
      userId
    );
    return { bankMovementId: result.id };
  }

  recordExpensePayment(
    bankAccountId: number,
    expenseId: number,
    amount: number,
    description: string,
    userId?: number
  ): { bankMovementId: number } {
    const result = this.addMovement(
      {
        bank_account_id: bankAccountId,
        movement_type: 'Gider ödemesi',
        amount,
        direction: 'out',
        description,
        related_expense_id: expenseId,
      },
      userId
    );
    return { bankMovementId: result.id };
  }

  getTotalBalance(): number {
    const row = this.db
      .prepare(`SELECT COALESCE(SUM(current_balance), 0) as total FROM bank_accounts WHERE is_active = 1`)
      .get() as { total: number };
    return row.total;
  }
}
