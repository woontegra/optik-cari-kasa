import type Database from 'better-sqlite3';
import type { ExpenseInput, PersonnelExpenseInput } from '../types/finance';
import { BankService } from './bank.service';
import { CashService } from './cash.service';

export class ExpenseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpenseValidationError';
  }
}

export class ExpenseService {
  private bankService: BankService;
  private cashService: CashService;

  constructor(private db: Database.Database) {
    this.bankService = new BankService(db);
    this.cashService = new CashService(db);
  }

  list(filters?: { date_from?: string; date_to?: string; category?: string; status?: string }): Record<string, unknown>[] {
    let sql = `SELECT e.*, ba.account_name as bank_account_name FROM expenses e LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id WHERE 1=1`;
    const params: unknown[] = [];
    if (filters?.date_from) {
      sql += ` AND date(e.expense_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters?.date_to) {
      sql += ` AND date(e.expense_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters?.category) {
      sql += ` AND e.category = ?`;
      params.push(filters.category);
    }
    if (filters?.status) {
      sql += ` AND e.status = ?`;
      params.push(filters.status);
    } else {
      sql += ` AND e.status != 'İptal'`;
    }
    sql += ` ORDER BY e.expense_date DESC, e.id DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  create(input: ExpenseInput, userId?: number): { id: number } {
    if (!input.description?.trim()) throw new ExpenseValidationError('Açıklama zorunludur.');
    if (input.amount <= 0) throw new ExpenseValidationError('Tutar 0\'dan büyük olmalıdır.');

    const vatRate = input.vat_rate ?? 0;
    const vatAmount = Math.round(input.amount * vatRate) / (100 + vatRate) * (vatRate / 100) * 100 / 100;
    const netVat = input.amount * vatRate / (100 + vatRate);

    const tx = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO expenses (
            expense_date, category, description, amount, vat_rate, vat_amount, payment_method,
            bank_account_id, document_no, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.expense_date,
          input.category,
          input.description.trim(),
          input.amount,
          vatRate,
          netVat,
          input.payment_method,
          input.bank_account_id ?? null,
          input.document_no?.trim() || null,
          input.notes?.trim() || null,
          userId ?? null
        );
      const expenseId = Number(result.lastInsertRowid);

      let cashMovementId: number | null = null;
      let bankMovementId: number | null = null;

      if (input.payment_method === 'Nakit') {
        const cash = this.cashService.addExpense({
          amount: input.amount,
          paymentType: 'Nakit',
          description: input.description,
          category: input.category,
        });
        cashMovementId = cash.id;
      } else if (input.payment_method === 'Banka' || input.payment_method === 'POS / Kart') {
        if (!input.bank_account_id) throw new ExpenseValidationError('Banka hesabı seçilmelidir.');
        const bank = this.bankService.recordExpensePayment(
          input.bank_account_id,
          expenseId,
          input.amount,
          input.description,
          userId
        );
        bankMovementId = bank.bankMovementId;
      }

      this.db
        .prepare(`UPDATE expenses SET cash_movement_id = ?, bank_movement_id = ? WHERE id = ?`)
        .run(cashMovementId, bankMovementId, expenseId);

      return { id: expenseId };
    });

    return tx();
  }

  createPersonnel(input: PersonnelExpenseInput, userId?: number): { id: number; expenseId: number } {
    const expenseId = this.create(
      {
        expense_date: input.expense_date,
        category: 'Personel',
        description: `${input.personnel_name} - ${input.expense_type}${input.description ? `: ${input.description}` : ''}`,
        amount: input.amount,
        payment_method: input.payment_method,
        bank_account_id: input.bank_account_id,
      },
      userId
    ).id;

    const result = this.db
      .prepare(
        `INSERT INTO personnel_expenses (
          personnel_name, expense_type, expense_date, amount, payment_method, bank_account_id, description, expense_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.personnel_name.trim(),
        input.expense_type,
        input.expense_date,
        input.amount,
        input.payment_method,
        input.bank_account_id ?? null,
        input.description?.trim() || null,
        expenseId,
        userId ?? null
      );

    return { id: Number(result.lastInsertRowid), expenseId };
  }

  cancel(id: number, userId?: number): { id: number } {
    const expense = this.db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!expense) throw new ExpenseValidationError('Gider kaydı bulunamadı.');
    if (expense.status === 'İptal') throw new ExpenseValidationError('Gider zaten iptal edilmiş.');

    const tx = this.db.transaction(() => {
      this.db
        .prepare(`UPDATE expenses SET status = 'İptal', updated_at = datetime('now', 'localtime') WHERE id = ?`)
        .run(id);

      const amount = Number(expense.amount);
      const desc = `Gider iptali: ${expense.description}`;

      if (expense.payment_method === 'Nakit' && expense.cash_movement_id) {
        this.db
          .prepare(
            `INSERT INTO cash_movements (movement_type, description, payment_type, amount, reference_type, reference_id, movement_date)
             VALUES ('Giriş', ?, 'Nakit', ?, 'expense_cancel', ?, datetime('now', 'localtime'))`
          )
          .run(desc, amount, id);
      }

      if ((expense.payment_method === 'Banka' || expense.payment_method === 'POS / Kart') && expense.bank_account_id) {
        this.bankService.addMovement(
          {
            bank_account_id: Number(expense.bank_account_id),
            movement_type: 'Düzeltme',
            amount,
            direction: 'in',
            description: desc,
            related_expense_id: id,
          },
          userId
        );
      }
    });

    tx();
    return { id };
  }

  getTodayTotal(): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
         WHERE date(expense_date) = date('now', 'localtime') AND status = 'Aktif'`
      )
      .get() as { total: number };
    return row.total;
  }

  getTotalInRange(dateFrom: string, dateTo: string): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
         WHERE date(expense_date) >= date(?) AND date(expense_date) <= date(?) AND status = 'Aktif'`
      )
      .get(dateFrom, dateTo) as { total: number };
    return row.total;
  }
}
