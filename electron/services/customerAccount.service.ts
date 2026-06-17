import type Database from 'better-sqlite3';
import type { AccountMovementType } from '../types/sale';

export class CustomerAccountValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerAccountValidationError';
  }
}

export class CustomerAccountService {
  constructor(private db: Database.Database) {}

  getBalance(customerId: number): number {
    const row = this.db.prepare(`SELECT balance FROM customers WHERE id = ?`).get(customerId) as
      | { balance: number }
      | undefined;
    return row?.balance ?? 0;
  }

  private updateCustomerBalance(customerId: number, newBalance: number): void {
    this.db
      .prepare(
        `UPDATE customers SET balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(newBalance, customerId);
  }

  addMovement(
    customerId: number,
    movementType: AccountMovementType,
    options: {
      debitAmount?: number;
      creditAmount?: number;
      saleId?: number;
      description?: string;
    }
  ): void {
    const debit = options.debitAmount ?? 0;
    const credit = options.creditAmount ?? 0;
    const currentBalance = this.getBalance(customerId);
    const newBalance = currentBalance + debit - credit;

    this.db
      .prepare(
        `INSERT INTO customer_account_movements
         (customer_id, sale_id, movement_type, debit_amount, credit_amount, balance_after, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        customerId,
        options.saleId ?? null,
        movementType,
        debit,
        credit,
        newBalance,
        options.description ?? null
      );

    this.updateCustomerBalance(customerId, newBalance);
  }

  listMovements(customerId: number): Record<string, unknown>[] {
    const rows = this.db
      .prepare(
        `SELECT cam.*, s.sale_no
         FROM customer_account_movements cam
         LEFT JOIN sales s ON s.id = cam.sale_id
         WHERE cam.customer_id = ?
         ORDER BY cam.created_at DESC, cam.id DESC`
      )
      .all(customerId) as Record<string, unknown>[];

    return rows;
  }

  addDebt(customerId: number, amount: number, saleId: number, description: string): void {
    if (amount <= 0) return;
    this.addMovement(customerId, 'Borç', {
      debitAmount: amount,
      saleId,
      description,
    });
  }

  addCollection(
    customerId: number,
    amount: number,
    options: { saleId?: number; description?: string }
  ): void {
    if (amount <= 0) {
      throw new CustomerAccountValidationError('Tahsilat tutarı 0\'dan büyük olmalıdır.');
    }
    this.addMovement(customerId, 'Tahsilat', {
      creditAmount: amount,
      saleId: options.saleId,
      description: options.description ?? 'Tahsilat',
    });
  }

  reverseDebt(customerId: number, amount: number, saleId: number, description: string): void {
    if (amount <= 0) return;
    this.addMovement(customerId, 'Düzeltme', {
      creditAmount: amount,
      saleId,
      description,
    });
  }

  addCredit(customerId: number, amount: number, options: { saleId?: number; description?: string }): void {
    if (amount <= 0) return;
    this.addMovement(customerId, 'İade', {
      creditAmount: amount,
      saleId: options.saleId,
      description: options.description ?? 'Cari alacak',
    });
  }
}
