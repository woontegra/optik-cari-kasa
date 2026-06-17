import type Database from 'better-sqlite3';
import * as XLSX from 'xlsx';
import type {
  CancelPurchaseInput,
  CreatePurchaseInput,
  PurchaseLineInput,
  PurchaseListFilters,
  SupplierPaymentInput,
} from '../types/purchase';
import { SupplierAccountService } from './supplierAccount.service';
import { BankService } from './bank.service';

export class PurchaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurchaseValidationError';
  }
}

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ₺`;
}

function calcLineAmounts(item: PurchaseLineInput): {
  vatAmount: number;
  lineTotal: number;
  lineSubtotal: number;
} {
  const qty = item.quantity;
  const price = item.purchase_price;
  const vatRate = item.vat_rate ?? 18;
  const lineSubtotal = qty * price;
  const vatAmount = lineSubtotal * (vatRate / 100);
  const lineTotal = lineSubtotal + vatAmount;
  return { vatAmount, lineTotal, lineSubtotal };
}

function resolvePaymentStatus(total: number, paid: number, cancelled: boolean): string {
  if (cancelled) return 'İptal';
  if (paid <= 0) return 'Ödeme bekliyor';
  if (paid >= total - 0.001) return 'Ödendi';
  return 'Kısmi ödendi';
}

export class PurchaseService {
  private accountService: SupplierAccountService;
  private bankService: BankService;

  constructor(private db: Database.Database) {
    this.accountService = new SupplierAccountService(db);
    this.bankService = new BankService(db);
  }

  private generateDocumentNo(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const prefix = `ALF-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const row = this.db
      .prepare(`SELECT document_no FROM purchase_documents WHERE document_no LIKE ? ORDER BY id DESC LIMIT 1`)
      .get(`${prefix}%`) as { document_no: string } | undefined;
    let seq = 1;
    if (row?.document_no) {
      const parts = row.document_no.split('-');
      const last = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(last)) seq = last + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private calcTotals(items: PurchaseLineInput[]): {
    subtotal: number;
    vat: number;
    total: number;
    totalQty: number;
  } {
    let subtotal = 0;
    let vat = 0;
    let totalQty = 0;
    for (const item of items) {
      const { vatAmount, lineTotal, lineSubtotal } = calcLineAmounts(item);
      subtotal += lineSubtotal;
      vat += vatAmount;
      totalQty += item.quantity;
    }
    return { subtotal, vat, total: subtotal + vat, totalQty };
  }

  list(filters: PurchaseListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT pd.*, s.name as supplier_name
      FROM purchase_documents pd
      INNER JOIN suppliers s ON s.id = pd.supplier_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.status) {
      sql += ` AND pd.status = ?`;
      params.push(filters.status);
    } else {
      sql += ` AND pd.status != 'İptal'`;
    }
    if (filters.date_from) {
      sql += ` AND date(pd.document_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(pd.document_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.supplier_id) {
      sql += ` AND pd.supplier_id = ?`;
      params.push(filters.supplier_id);
    }
    if (filters.document_type) {
      sql += ` AND pd.document_type = ?`;
      params.push(filters.document_type);
    }
    if (filters.payment_status) {
      sql += ` AND pd.payment_status = ?`;
      params.push(filters.payment_status);
    }
    if (filters.search?.trim()) {
      sql += ` AND (pd.document_no LIKE ? OR s.name LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY pd.document_date DESC, pd.id DESC LIMIT 500`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  listBySupplier(supplierId: number): Record<string, unknown>[] {
    return this.list({ supplier_id: supplierId, status: '' });
  }

  getById(id: number): Record<string, unknown> | null {
    const doc = this.db
      .prepare(
        `SELECT pd.*, s.name as supplier_name, s.phone as supplier_phone,
                u.full_name as created_by_name, seb.batch_no as stock_entry_batch_no
         FROM purchase_documents pd
         INNER JOIN suppliers s ON s.id = pd.supplier_id
         LEFT JOIN users u ON u.id = pd.created_by
         LEFT JOIN stock_entry_batches seb ON seb.id = pd.stock_entry_batch_id
         WHERE pd.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!doc) return null;

    const items = this.db
      .prepare(
        `SELECT pdi.*, p.name as product_name, p.product_type, p.brand, p.model
         FROM purchase_document_items pdi
         INNER JOIN products p ON p.id = pdi.product_id
         WHERE pdi.purchase_document_id = ?
         ORDER BY pdi.id`
      )
      .all(id) as Record<string, unknown>[];

    const payments = this.db
      .prepare(
        `SELECT sp.*, u.full_name as created_by_name
         FROM supplier_payments sp
         LEFT JOIN users u ON u.id = sp.created_by
         WHERE sp.purchase_document_id = ?
         ORDER BY sp.payment_date DESC`
      )
      .all(id) as Record<string, unknown>[];

    return { ...doc, items, payments };
  }

  listStockEntryCandidates(): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT b.*, s.name as supplier_name
         FROM stock_entry_batches b
         LEFT JOIN suppliers s ON s.id = b.supplier_id
         WHERE b.id NOT IN (
           SELECT stock_entry_batch_id FROM purchase_documents
           WHERE stock_entry_batch_id IS NOT NULL AND status != 'İptal'
         )
         ORDER BY b.created_at DESC
         LIMIT 200`
      )
      .all() as Record<string, unknown>[];
  }

  getStockEntryLines(batchId: number): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT sei.*, p.name as product_name, p.product_type, p.brand, p.model,
                p.vat_rate, p.shelf_location, pb.barcode
         FROM stock_entry_items sei
         INNER JOIN products p ON p.id = sei.product_id
         LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
         WHERE sei.batch_id = ?
         ORDER BY sei.id`
      )
      .all(batchId) as Record<string, unknown>[];
  }

  create(input: CreatePurchaseInput, userId: number): { id: number; documentNo: string } {
    if (!input.supplier_id) throw new PurchaseValidationError('Tedarikçi seçimi zorunludur.');
    if (!input.items?.length) throw new PurchaseValidationError('En az bir ürün satırı gerekli.');

    const sourceType = input.source_type || 'direct';
    if (sourceType === 'stock_entry') {
      if (!input.stock_entry_batch_id) {
        throw new PurchaseValidationError('Mal kabul fişi seçimi zorunludur.');
      }
      const linked = this.db
        .prepare(
          `SELECT id FROM purchase_documents WHERE stock_entry_batch_id = ? AND status != 'İptal'`
        )
        .get(input.stock_entry_batch_id);
      if (linked) {
        throw new PurchaseValidationError('Bu mal kabul fişi zaten bir alış belgesine bağlı.');
      }
    }

    for (const item of input.items) {
      if (!item.product_id || item.quantity <= 0) {
        throw new PurchaseValidationError('Geçersiz ürün veya adet.');
      }
    }

    const documentNo = input.document_no?.trim() || this.generateDocumentNo();
    const { subtotal, vat, total, totalQty } = this.calcTotals(input.items);
    const initialPaid = Math.min(input.initial_payment?.amount ?? 0, total);
    const remaining = total - initialPaid;
    const paymentStatus = resolvePaymentStatus(total, initialPaid, false);

    const run = this.db.transaction(() => {
      const docResult = this.db
        .prepare(
          `INSERT INTO purchase_documents (
            document_no, document_type, supplier_id, document_date, due_date,
            source_type, stock_entry_batch_id, subtotal_amount, vat_amount, total_amount,
            paid_amount, remaining_amount, payment_status, status, notes,
            total_items, total_quantity, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aktif', ?, ?, ?, ?)`
        )
        .run(
          documentNo,
          input.document_type,
          input.supplier_id,
          input.document_date,
          input.due_date || null,
          sourceType,
          input.stock_entry_batch_id ?? null,
          subtotal,
          vat,
          total,
          initialPaid,
          remaining,
          paymentStatus,
          input.notes?.trim() || null,
          input.items.length,
          totalQty,
          userId
        );
      const docId = Number(docResult.lastInsertRowid);

      const getProduct = this.db.prepare(`SELECT * FROM products WHERE id = ?`);
      const updateStock = this.db.prepare(
        `UPDATE products SET stock_quantity = ?, purchase_price = ?, sale_price = COALESCE(?, sale_price),
         shelf_location = COALESCE(?, shelf_location), updated_at = datetime('now', 'localtime') WHERE id = ?`
      );
      const insertMovement = this.db.prepare(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, unit_price, reference_type, reference_id, notes)
         VALUES (?, 'Alış / İrsaliye Girişi', ?, ?, 'purchase_document', ?, ?)`
      );
      const insertItem = this.db.prepare(
        `INSERT INTO purchase_document_items (
          purchase_document_id, product_id, barcode, quantity, purchase_price,
          vat_rate, vat_amount, sale_price, line_total, shelf_location, previous_stock, new_stock
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const item of input.items) {
        const { vatAmount, lineTotal } = calcLineAmounts(item);
        const product = getProduct.get(item.product_id) as Record<string, unknown> | undefined;
        if (!product) throw new PurchaseValidationError(`Ürün bulunamadı (ID: ${item.product_id}).`);

        const prevStock = Number(product.stock_quantity ?? 0);
        let newStock = prevStock;

        if (sourceType === 'direct') {
          newStock = prevStock + item.quantity;
          updateStock.run(
            newStock,
            item.purchase_price,
            item.sale_price ?? null,
            item.shelf_location?.trim() || null,
            item.product_id
          );
          const note = `Belge: ${documentNo}`;
          insertMovement.run(item.product_id, item.quantity, item.purchase_price, docId, note);
        }

        insertItem.run(
          docId,
          item.product_id,
          item.barcode?.trim() || null,
          item.quantity,
          item.purchase_price,
          item.vat_rate ?? 18,
          vatAmount,
          item.sale_price ?? product.sale_price ?? 0,
          lineTotal,
          item.shelf_location?.trim() || product.shelf_location || null,
          prevStock,
          sourceType === 'direct' ? newStock : prevStock
        );
      }

      this.accountService.addPurchaseDebt(
        input.supplier_id,
        total,
        docId,
        `Alış belgesi: ${documentNo}`
      );

      if (initialPaid > 0 && input.initial_payment) {
        this.recordPaymentInternal(
          {
            supplier_id: input.supplier_id,
            amount: initialPaid,
            payment_type: input.initial_payment.payment_type,
            payment_date: input.document_date,
            description: input.initial_payment.description || `Belge ödemesi: ${documentNo}`,
            purchase_document_id: docId,
          },
          userId,
          docId,
          false
        );
      }

      return { id: docId, documentNo };
    });

    return run();
  }

  createFromStockEntry(
    batchId: number,
    input: Omit<CreatePurchaseInput, 'source_type' | 'stock_entry_batch_id' | 'items'>,
    userId: number
  ): { id: number; documentNo: string } {
    const lines = this.getStockEntryLines(batchId);
    if (!lines.length) throw new PurchaseValidationError('Mal kabul fişinde ürün bulunamadı.');

    const batch = this.db
      .prepare(`SELECT * FROM stock_entry_batches WHERE id = ?`)
      .get(batchId) as Record<string, unknown> | undefined;
    if (!batch) throw new PurchaseValidationError('Mal kabul fişi bulunamadı.');

    const items: PurchaseLineInput[] = lines.map((l) => ({
      product_id: Number(l.product_id),
      barcode: (l.barcode as string) || undefined,
      quantity: Number(l.quantity),
      purchase_price: Number(l.purchase_price ?? 0),
      vat_rate: Number(l.vat_rate ?? 18),
      sale_price: Number(l.sale_price ?? 0),
      shelf_location: (l.shelf_location as string) || undefined,
    }));

    const supplierId = input.supplier_id || Number(batch.supplier_id);
    if (!supplierId) {
      throw new PurchaseValidationError('Mal kabul fişi veya form için tedarikçi seçimi zorunludur.');
    }

    return this.create(
      {
        ...input,
        supplier_id: supplierId,
        source_type: 'stock_entry',
        stock_entry_batch_id: batchId,
        items,
        document_no: input.document_no || (batch.document_no as string) || undefined,
      },
      userId
    );
  }

  private recordPaymentInternal(
    input: SupplierPaymentInput,
    userId: number,
    docId?: number,
    updateDoc = true
  ): { paymentId: number; cashMovementId: number | null; bankMovementId: number | null } {
    const payResult = this.db
      .prepare(
        `INSERT INTO supplier_payments (
          supplier_id, purchase_document_id, amount, payment_type, payment_date, description, created_by, bank_account_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.supplier_id,
        input.purchase_document_id ?? docId ?? null,
        input.amount,
        input.payment_type,
        input.payment_date,
        input.description?.trim() || null,
        userId,
        input.bank_account_id ?? null
      );
    const paymentId = Number(payResult.lastInsertRowid);

    let cashMovementId: number | null = null;
    let bankMovementId: number | null = null;

    const isBankPayment =
      input.payment_type === 'Havale/EFT' && input.bank_account_id;

    if (isBankPayment) {
      const bankMove = this.bankService.recordSupplierPayment(
        input.bank_account_id!,
        input.supplier_id,
        input.amount,
        input.description || 'Tedarikçi ödemesi',
        userId
      );
      bankMovementId = bankMove.bankMovementId;
      this.db
        .prepare(`UPDATE supplier_payments SET bank_movement_id = ? WHERE id = ?`)
        .run(bankMovementId, paymentId);
    } else if (input.payment_type === 'Nakit' || input.payment_type === 'Kredi Kartı') {
      const cashResult = this.db
        .prepare(
          `INSERT INTO cash_movements (movement_type, description, payment_type, amount, category, reference_type, reference_id, movement_date)
           VALUES ('Çıkış', ?, ?, ?, 'Tedarikçi Ödemesi', 'supplier_payment', ?, datetime('now', 'localtime'))`
        )
        .run(
          input.description || 'Tedarikçi ödemesi',
          input.payment_type,
          -Math.abs(input.amount),
          paymentId
        );
      cashMovementId = Number(cashResult.lastInsertRowid);
      this.db
        .prepare(`UPDATE supplier_payments SET cash_movement_id = ? WHERE id = ?`)
        .run(cashMovementId, paymentId);
    }

    this.accountService.addPayment(input.supplier_id, input.amount, paymentId, {
      purchaseDocumentId: input.purchase_document_id ?? docId,
      description: input.description,
    });

    const targetDocId = input.purchase_document_id ?? docId;
    if (updateDoc && targetDocId) {
      const doc = this.db
        .prepare(`SELECT total_amount, paid_amount, status FROM purchase_documents WHERE id = ?`)
        .get(targetDocId) as { total_amount: number; paid_amount: number; status: string };
      const newPaid = Number(doc.paid_amount) + input.amount;
      const total = Number(doc.total_amount);
      const remaining = Math.max(0, total - newPaid);
      const paymentStatus = resolvePaymentStatus(total, newPaid, doc.status === 'İptal');
      this.db
        .prepare(
          `UPDATE purchase_documents SET paid_amount = ?, remaining_amount = ?, payment_status = ?,
           updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(newPaid, remaining, paymentStatus, targetDocId);
    }

    return { paymentId, cashMovementId, bankMovementId };
  }

  addPayment(input: SupplierPaymentInput, userId: number): { paymentId: number } {
    if (input.amount <= 0) throw new PurchaseValidationError('Ödeme tutarı 0\'dan büyük olmalıdır.');

    if (input.purchase_document_id) {
      const doc = this.db
        .prepare(`SELECT remaining_amount, status, supplier_id FROM purchase_documents WHERE id = ?`)
        .get(input.purchase_document_id) as
        | { remaining_amount: number; status: string; supplier_id: number }
        | undefined;
      if (!doc) throw new PurchaseValidationError('Alış belgesi bulunamadı.');
      if (doc.status === 'İptal') throw new PurchaseValidationError('İptal edilmiş belgeye ödeme yapılamaz.');
      if (doc.supplier_id !== input.supplier_id) {
        throw new PurchaseValidationError('Tedarikçi ile belge uyuşmuyor.');
      }
      if (input.amount > Number(doc.remaining_amount) + 0.001) {
        throw new PurchaseValidationError('Ödeme tutarı kalan tutardan fazla olamaz.');
      }
    }

    const run = this.db.transaction(() => this.recordPaymentInternal(input, userId));
    const result = run();
    return { paymentId: result.paymentId };
  }

  cancel(id: number, input: CancelPurchaseInput, userId: number): { cancelled: boolean } {
    if (!input.cancel_reason?.trim()) {
      throw new PurchaseValidationError('İptal nedeni zorunludur.');
    }

    const doc = this.db
      .prepare(`SELECT * FROM purchase_documents WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    if (!doc) throw new PurchaseValidationError('Alış belgesi bulunamadı.');
    if (doc.status === 'İptal') throw new PurchaseValidationError('Belge zaten iptal edilmiş.');

    const run = this.db.transaction(() => {
      const sourceType = String(doc.source_type);
      const items = this.db
        .prepare(`SELECT * FROM purchase_document_items WHERE purchase_document_id = ?`)
        .all(id) as Record<string, unknown>[];

      if (sourceType === 'direct') {
        const updateStock = this.db.prepare(
          `UPDATE products SET stock_quantity = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
        );
        const insertMovement = this.db.prepare(
          `INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, notes)
           VALUES (?, 'Alış İptali', ?, 'purchase_document', ?, ?)`
        );
        for (const item of items) {
          const product = this.db
            .prepare(`SELECT stock_quantity FROM products WHERE id = ?`)
            .get(item.product_id) as { stock_quantity: number };
          const current = Number(product.stock_quantity);
          const qty = Number(item.quantity);
          const newStock = Math.max(0, current - qty);
          updateStock.run(newStock, item.product_id);
          insertMovement.run(
            item.product_id,
            -qty,
            id,
            `İptal: ${doc.document_no} — ${input.cancel_reason.trim()}`
          );
        }
      }

      const total = Number(doc.total_amount);
      const paid = Number(doc.paid_amount);
      const supplierId = Number(doc.supplier_id);

      this.accountService.reversePurchaseDebt(
        supplierId,
        total,
        id,
        `Belge iptali: ${doc.document_no}`
      );

      if (paid > 0) {
        const payments = this.db
          .prepare(`SELECT * FROM supplier_payments WHERE purchase_document_id = ?`)
          .all(id) as Record<string, unknown>[];
        for (const pay of payments) {
          this.accountService.addMovement(supplierId, 'İptal', {
            debitAmount: Number(pay.amount),
            purchaseDocumentId: id,
            paymentId: Number(pay.id),
            description: `Ödeme iadesi (iptal): ${doc.document_no}`,
          });
          const cashId = pay.cash_movement_id as number | null;
          if (cashId) {
            this.db
              .prepare(
                `INSERT INTO cash_movements (movement_type, description, payment_type, amount, category, reference_type, reference_id, movement_date)
                 VALUES ('Giriş', ?, ?, ?, 'Tedarikçi İptal İadesi', 'supplier_payment_cancel', ?, datetime('now', 'localtime'))`
              )
              .run(
                `İptal iadesi: ${doc.document_no}`,
                pay.payment_type,
                Math.abs(Number(pay.amount)),
                pay.id
              );
          }
        }
      }

      this.db
        .prepare(
          `UPDATE purchase_documents SET status = 'İptal', payment_status = 'İptal',
           cancel_reason = ?, cancelled_at = datetime('now', 'localtime'),
           paid_amount = 0, remaining_amount = 0, updated_at = datetime('now', 'localtime')
           WHERE id = ?`
        )
        .run(input.cancel_reason.trim(), id);
    });

    run();
    return { cancelled: true };
  }

  buildPrintDocument(id: number): { html: string; title: string } {
    const detail = this.getById(id);
    if (!detail) throw new PurchaseValidationError('Alış belgesi bulunamadı.');

    const company = this.db.prepare(`SELECT name FROM companies WHERE is_default = 1 LIMIT 1`).get() as
      | { name: string }
      | undefined;
    const items = (detail.items as Record<string, unknown>[]) || [];
    const rows = items
      .map(
        (i) => `<tr>
        <td>${String(i.barcode || '-')}</td>
        <td>${String(i.product_name)}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${formatCurrency(Number(i.purchase_price))}</td>
        <td class="num">%${i.vat_rate}</td>
        <td class="num">${formatCurrency(Number(i.line_total))}</td>
      </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Alış Belgesi</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:12px;color:#222}
      h2{text-align:center;font-size:14px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #ccc;padding:4px 6px}
      th{background:#f5f5f5}
      .num{text-align:right}
    </style></head><body>
    <h2>ALIŞ FATURASI / İRSALİYE</h2>
    <div><strong>Firma:</strong> ${company?.name || 'Woontegra Optik'}</div>
    <div><strong>Belge No:</strong> ${detail.document_no}</div>
    <div><strong>Tedarikçi:</strong> ${detail.supplier_name}</div>
    <div><strong>Tarih:</strong> ${detail.document_date} | <strong>Tip:</strong> ${detail.document_type}</div>
    <table><thead><tr><th>Barkod</th><th>Ürün</th><th>Adet</th><th>Alış</th><th>KDV</th><th>Toplam</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div style="margin-top:10px;text-align:right">
      Ara Toplam: ${formatCurrency(Number(detail.subtotal_amount))}<br>
      KDV: ${formatCurrency(Number(detail.vat_amount))}<br>
      <strong>Genel Toplam: ${formatCurrency(Number(detail.total_amount))}</strong>
    </div>
    </body></html>`;

    return { html, title: `Alış Belgesi — ${detail.document_no}` };
  }

  buildSupplierStatement(supplierId: number): { html: string; title: string } {
    const supplier = this.db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(supplierId) as
      | Record<string, unknown>
      | undefined;
    if (!supplier) throw new PurchaseValidationError('Tedarikçi bulunamadı.');

    const movements = this.accountService.listMovements(supplierId);
    const rows = movements
      .map(
        (m) => `<tr>
        <td>${String(m.created_at)}</td>
        <td>${String(m.movement_type)}</td>
        <td>${String(m.document_no || '-')}</td>
        <td>${String(m.description || '')}</td>
        <td class="num">${Number(m.debit_amount) > 0 ? formatCurrency(Number(m.debit_amount)) : '-'}</td>
        <td class="num">${Number(m.credit_amount) > 0 ? formatCurrency(Number(m.credit_amount)) : '-'}</td>
        <td class="num">${formatCurrency(Number(m.balance_after))}</td>
      </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tedarikçi Ekstresi</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:12px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #ccc;padding:4px 6px}
      th{background:#f5f5f5}
      .num{text-align:right}
    </style></head><body>
    <h2>TEDARİKÇİ CARİ EKSTRESİ</h2>
    <div><strong>Tedarikçi:</strong> ${supplier.name}</div>
    <div><strong>Güncel Bakiye:</strong> ${formatCurrency(Number(supplier.balance ?? 0))}</div>
    <table><thead><tr><th>Tarih</th><th>İşlem</th><th>Belge</th><th>Açıklama</th><th>Borç</th><th>Alacak</th><th>Bakiye</th></tr></thead>
    <tbody>${rows}</tbody></table>
    </body></html>`;

    return { html, title: `Tedarikçi Ekstresi — ${supplier.name}` };
  }

  exportToExcel(id: number, filePath: string): { rowCount: number } {
    const detail = this.getById(id);
    if (!detail) throw new PurchaseValidationError('Alış belgesi bulunamadı.');
    const items = (detail.items as Record<string, unknown>[]) || [];
    const rows = items.map((i) => ({
      'Belge No': detail.document_no,
      Barkod: i.barcode || '',
      'Ürün Adı': i.product_name,
      Tip: i.product_type,
      Marka: i.brand || '',
      Adet: i.quantity,
      'Alış Fiyatı': i.purchase_price,
      'KDV %': i.vat_rate,
      'Satır Toplamı': i.line_total,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alış Belgesi');
    XLSX.writeFile(wb, filePath);
    return { rowCount: rows.length };
  }
}
