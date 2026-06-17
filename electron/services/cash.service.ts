import type Database from 'better-sqlite3';
import type { AddCashExpenseInput, AddCashIncomeInput, CashPaymentType } from '../types/sale';
import { CustomerAccountService } from './customerAccount.service';

export class CashValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CashValidationError';
  }
}

export class CashService {
  private accountService: CustomerAccountService;

  constructor(private db: Database.Database) {
    this.accountService = new CustomerAccountService(db);
  }

  getSummary(): Record<string, number> {
    const today = `date('now', 'localtime')`;

    const todayCash = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
         WHERE date(movement_date) = ${today} AND amount > 0 AND payment_type = 'Nakit'`
      )
      .get() as { total: number };

    const todayCard = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
         WHERE date(movement_date) = ${today} AND amount > 0 AND payment_type = 'Kredi Kartı'`
      )
      .get() as { total: number };

    const todayTransfer = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
         WHERE date(movement_date) = ${today} AND amount > 0 AND payment_type = 'Havale/EFT'`
      )
      .get() as { total: number };

    const todayCollection = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
         WHERE date(movement_date) = ${today} AND amount > 0`
      )
      .get() as { total: number };

    const totalCash = this.db
      .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements`)
      .get() as { total: number };

    return {
      todayCash: todayCash.total,
      todayCard: todayCard.total,
      todayTransfer: todayTransfer.total,
      todayCollection: todayCollection.total,
      totalCash: totalCash.total,
    };
  }

  listMovements(filters?: { date_from?: string; date_to?: string }): Record<string, unknown>[] {
    let sql = `
      SELECT cm.*, c.full_name as customer_name, s.sale_no
      FROM cash_movements cm
      LEFT JOIN customers c ON c.id = cm.customer_id
      LEFT JOIN sales s ON s.id = cm.sale_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.date_from) {
      sql += ` AND date(cm.movement_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters?.date_to) {
      sql += ` AND date(cm.movement_date) <= date(?)`;
      params.push(filters.date_to);
    }

    sql += ` ORDER BY cm.movement_date DESC, cm.id DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  addIncome(input: AddCashIncomeInput): { id: number } {
    if (input.amount <= 0) {
      throw new CashValidationError('Tahsilat tutarı 0\'dan büyük olmalıdır.');
    }

    const tx = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO cash_movements (movement_type, description, payment_type, amount, customer_id, movement_date)
           VALUES ('Giriş', ?, ?, ?, ?, datetime('now', 'localtime'))`
        )
        .run(
          input.description || 'Manuel tahsilat',
          input.paymentType,
          input.amount,
          input.customerId ?? null
        );

      if (input.customerId) {
        this.accountService.addCollection(input.customerId, input.amount, {
          description: input.description || 'Manuel tahsilat',
        });
      }

      return { id: Number(result.lastInsertRowid) };
    });

    return tx();
  }

  addExpense(input: AddCashExpenseInput): { id: number } {
    if (input.amount <= 0) {
      throw new CashValidationError('Gider tutarı 0\'dan büyük olmalıdır.');
    }

    const result = this.db
      .prepare(
        `INSERT INTO cash_movements (movement_type, description, payment_type, amount, category, movement_date)
         VALUES ('Çıkış', ?, ?, ?, ?, datetime('now', 'localtime'))`
      )
      .run(
        input.description,
        input.paymentType,
        -Math.abs(input.amount),
        input.category || 'Genel'
      );

    return { id: Number(result.lastInsertRowid) };
  }

  recordSalePayment(
    saleId: number,
    customerId: number | null,
    amount: number,
    paymentType: CashPaymentType,
    description: string
  ): void {
    if (amount <= 0) return;

    this.db
      .prepare(
        `INSERT INTO cash_movements (movement_type, description, payment_type, amount, customer_id, sale_id, reference_type, reference_id, movement_date)
         VALUES ('Giriş', ?, ?, ?, ?, ?, 'sale', ?, datetime('now', 'localtime'))`
      )
      .run(description, paymentType, amount, customerId, saleId, saleId);
  }

  recordSaleRefund(
    saleId: number,
    customerId: number | null,
    amount: number,
    paymentType: CashPaymentType,
    description: string
  ): void {
    if (amount <= 0) return;

    this.db
      .prepare(
        `INSERT INTO cash_movements (movement_type, description, payment_type, amount, customer_id, sale_id, reference_type, reference_id, movement_date)
         VALUES ('Çıkış', ?, ?, ?, ?, ?, 'sale_cancel', ?, datetime('now', 'localtime'))`
      )
      .run(description, paymentType, -Math.abs(amount), customerId, saleId, saleId);
  }

  recordReturnRefund(
    returnId: number,
    saleId: number | null,
    customerId: number | null,
    amount: number,
    paymentType: CashPaymentType | 'Cari',
    description: string
  ): void {
    if (amount <= 0 || paymentType === 'Cari') return;

    this.db
      .prepare(
        `INSERT INTO cash_movements (movement_type, description, payment_type, amount, customer_id, sale_id, reference_type, reference_id, movement_date)
         VALUES ('Çıkış', ?, ?, ?, ?, ?, 'return', ?, datetime('now', 'localtime'))`
      )
      .run(description, paymentType, -Math.abs(amount), customerId, saleId, returnId);
  }

  recordExchangeCollection(
    returnId: number,
    saleId: number | null,
    customerId: number | null,
    amount: number,
    paymentType: CashPaymentType,
    description: string
  ): void {
    if (amount <= 0) return;

    this.db
      .prepare(
        `INSERT INTO cash_movements (movement_type, description, payment_type, amount, customer_id, sale_id, reference_type, reference_id, movement_date)
         VALUES ('Giriş', ?, ?, ?, ?, ?, 'exchange', ?, datetime('now', 'localtime'))`
      )
      .run(description, paymentType, amount, customerId, saleId, returnId);
  }
}
