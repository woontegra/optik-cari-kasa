import type Database from 'better-sqlite3';

export class SupplierAccountValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupplierAccountValidationError';
  }
}

export type SupplierMovementType =
  | 'Alış Faturası'
  | 'Ödeme'
  | 'İptal'
  | 'Düzeltme';

export class SupplierAccountService {
  constructor(private db: Database.Database) {}

  getBalance(supplierId: number): number {
    const row = this.db.prepare(`SELECT balance FROM suppliers WHERE id = ?`).get(supplierId) as
      | { balance: number }
      | undefined;
    return Number(row?.balance ?? 0);
  }

  private updateSupplierBalance(supplierId: number, newBalance: number): void {
    this.db
      .prepare(
        `UPDATE suppliers SET balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(newBalance, supplierId);
  }

  addMovement(
    supplierId: number,
    movementType: SupplierMovementType,
    options: {
      debitAmount?: number;
      creditAmount?: number;
      purchaseDocumentId?: number | null;
      paymentId?: number | null;
      description?: string;
    }
  ): void {
    const debit = options.debitAmount ?? 0;
    const credit = options.creditAmount ?? 0;
    const currentBalance = this.getBalance(supplierId);
    const newBalance = currentBalance + debit - credit;

    this.db
      .prepare(
        `INSERT INTO supplier_account_movements (
          supplier_id, purchase_document_id, payment_id, movement_type,
          debit_amount, credit_amount, balance_after, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        supplierId,
        options.purchaseDocumentId ?? null,
        options.paymentId ?? null,
        movementType,
        debit,
        credit,
        newBalance,
        options.description ?? null
      );

    this.updateSupplierBalance(supplierId, newBalance);
  }

  addPurchaseDebt(
    supplierId: number,
    amount: number,
    purchaseDocumentId: number,
    description: string
  ): void {
    if (amount <= 0) return;
    this.addMovement(supplierId, 'Alış Faturası', {
      debitAmount: amount,
      purchaseDocumentId,
      description,
    });
  }

  addPayment(
    supplierId: number,
    amount: number,
    paymentId: number,
    options: { purchaseDocumentId?: number | null; description?: string }
  ): void {
    if (amount <= 0) {
      throw new SupplierAccountValidationError('Ödeme tutarı 0\'dan büyük olmalıdır.');
    }
    this.addMovement(supplierId, 'Ödeme', {
      creditAmount: amount,
      paymentId,
      purchaseDocumentId: options.purchaseDocumentId,
      description: options.description ?? 'Tedarikçi ödemesi',
    });
  }

  reversePurchaseDebt(
    supplierId: number,
    amount: number,
    purchaseDocumentId: number,
    description: string
  ): void {
    if (amount <= 0) return;
    this.addMovement(supplierId, 'İptal', {
      creditAmount: amount,
      purchaseDocumentId,
      description,
    });
  }

  listMovements(supplierId: number): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT sam.*, pd.document_no
         FROM supplier_account_movements sam
         LEFT JOIN purchase_documents pd ON pd.id = sam.purchase_document_id
         WHERE sam.supplier_id = ?
         ORDER BY sam.created_at DESC, sam.id DESC`
      )
      .all(supplierId) as Record<string, unknown>[];
  }

  listPayments(supplierId: number): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT sp.*, pd.document_no, u.full_name as created_by_name
         FROM supplier_payments sp
         LEFT JOIN purchase_documents pd ON pd.id = sp.purchase_document_id
         LEFT JOIN users u ON u.id = sp.created_by
         WHERE sp.supplier_id = ?
         ORDER BY sp.payment_date DESC, sp.id DESC`
      )
      .all(supplierId) as Record<string, unknown>[];
  }
}
