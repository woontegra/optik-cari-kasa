import type Database from 'better-sqlite3';
import type { CashPaymentType } from '../types/sale';
import type { CreateReturnInput, ReturnListFilters } from '../types/return';
import { ProductService } from './product.service';
import { CashService } from './cash.service';
import { CustomerAccountService } from './customerAccount.service';

export class ReturnValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReturnValidationError';
  }
}

export class ReturnService {
  private productService: ProductService;
  private cashService: CashService;
  private accountService: CustomerAccountService;

  constructor(private db: Database.Database) {
    this.productService = new ProductService(db);
    this.cashService = new CashService(db);
    this.accountService = new CustomerAccountService(db);
  }

  list(filters: ReturnListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT r.*, s.sale_no, c.full_name as customer_name
      FROM returns r
      LEFT JOIN sales s ON s.id = r.sale_id
      LEFT JOIN customers c ON c.id = r.customer_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.date_from) {
      sql += ` AND date(r.created_at) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(r.created_at) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.customer_search?.trim()) {
      sql += ` AND (c.full_name LIKE ? OR c.phone LIKE ?)`;
      const term = `%${filters.customer_search.trim()}%`;
      params.push(term, term);
    }
    if (filters.return_type) {
      sql += ` AND r.return_type = ?`;
      params.push(filters.return_type);
    }
    if (filters.sale_no?.trim()) {
      sql += ` AND s.sale_no LIKE ?`;
      params.push(`%${filters.sale_no.trim()}%`);
    }

    sql += ` ORDER BY r.created_at DESC, r.id DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  getById(id: number): Record<string, unknown> | null {
    const ret = this.db
      .prepare(
        `SELECT r.*, s.sale_no, c.full_name as customer_name, c.phone as customer_phone
         FROM returns r
         LEFT JOIN sales s ON s.id = r.sale_id
         LEFT JOIN customers c ON c.id = r.customer_id
         WHERE r.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!ret) return null;

    const items = this.db
      .prepare(
        `SELECT ri.*, p.name as product_name, p.product_type, p.barcode
         FROM return_items ri
         INNER JOIN products p ON p.id = ri.product_id
         WHERE ri.return_id = ?`
      )
      .all(id);

    const exchangeItems = this.db
      .prepare(
        `SELECT ei.*, p.name as product_name, p.product_type
         FROM exchange_items ei
         INNER JOIN products p ON p.id = ei.product_id
         WHERE ei.return_id = ?`
      )
      .all(id);

    return { ...ret, items, exchangeItems };
  }

  listBySale(saleId: number): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT r.*, ri.quantity, ri.unit_price, ri.total_amount as item_total,
                p.name as product_name
         FROM returns r
         LEFT JOIN return_items ri ON ri.return_id = r.id
         LEFT JOIN products p ON p.id = ri.product_id
         WHERE r.sale_id = ?
         ORDER BY r.created_at DESC`
      )
      .all(saleId) as Record<string, unknown>[];
  }

  create(input: CreateReturnInput): { returnId: number; returnNo: string } {
    if (!input.items.length) {
      throw new ReturnValidationError('İade edilecek ürün seçilmelidir.');
    }
    if (!input.reason?.trim()) {
      throw new ReturnValidationError('İade nedeni zorunludur.');
    }

    const sale = this.db
      .prepare(`SELECT * FROM sales WHERE id = ?`)
      .get(input.saleId) as Record<string, unknown> | undefined;

    if (!sale) {
      throw new ReturnValidationError('Satış bulunamadı.');
    }
    if (sale.status === 'İptal edildi') {
      throw new ReturnValidationError('İptal edilmiş satışa iade yapılamaz.');
    }

    const customerId = sale.customer_id as number | null;
    const saleNo = String(sale.sale_no || input.saleId);

    if (input.returnType === 'Cari hesaba alacak' && !customerId) {
      throw new ReturnValidationError('Cari alacak iadesi için müşteri zorunludur.');
    }

    if (input.returnType === 'Değişim' && (!input.exchangeItems || !input.exchangeItems.length)) {
      throw new ReturnValidationError('Değişim için yeni ürün seçilmelidir.');
    }

    for (const item of input.items) {
      const saleItem = this.db
        .prepare(`SELECT * FROM sale_items WHERE id = ? AND sale_id = ?`)
        .get(item.saleItemId, input.saleId) as
        | { quantity: number; returned_quantity?: number; product_id: number }
        | undefined;

      if (!saleItem) {
        throw new ReturnValidationError('Satış kalemi bulunamadı.');
      }

      const productId = saleItem.product_id;

      const alreadyReturned = Number(saleItem.returned_quantity ?? 0);
      const available = saleItem.quantity - alreadyReturned;

      if (item.quantity <= 0) {
        throw new ReturnValidationError('İade adedi 0\'dan büyük olmalıdır.');
      }
      if (item.quantity > available) {
        throw new ReturnValidationError(
          `İade adedi satılan adetten fazla olamaz. Kalan: ${available}`
        );
      }
    }

    if (input.exchangeItems) {
      for (const ex of input.exchangeItems) {
        const product = this.productService.getById(ex.productId);
        if (!product) {
          throw new ReturnValidationError(`Ürün bulunamadı (ID: ${ex.productId}).`);
        }
        if (product.status !== 'Aktif') {
          throw new ReturnValidationError(`"${product.name}" pasif durumda.`);
        }
        const stock = product.stock_quantity as number;
        if (ex.quantity > stock) {
          throw new ReturnValidationError(
            `"${product.name}" için yetersiz stok. Mevcut: ${stock}`
          );
        }
      }
    }

    const returnTotal = input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const exchangeTotal =
      input.exchangeItems?.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) ?? 0;
    const exchangeDiff = input.returnType === 'Değişim' ? exchangeTotal - returnTotal : 0;
    const returnNo = `IAD-${Date.now()}`;

    const tx = this.db.transaction(() => {
      const retResult = this.db
        .prepare(
          `INSERT INTO returns (return_no, sale_id, customer_id, return_type, refund_method, total_amount, exchange_diff, reason, notes, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Tamamlandı')`
        )
        .run(
          returnNo,
          input.saleId,
          customerId,
          input.returnType,
          input.refundMethod ?? null,
          returnTotal,
          exchangeDiff,
          input.reason.trim(),
          input.notes?.trim() || null
        );

      const returnId = Number(retResult.lastInsertRowid);

      const insertReturnItem = this.db.prepare(
        `INSERT INTO return_items (return_id, sale_item_id, product_id, quantity, unit_price, total_amount)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      const insertStockMovement = this.db.prepare(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, unit_price, reference_type, reference_id, notes)
         VALUES (?, 'İade', ?, ?, 'return', ?, ?)`
      );
      const updateStock = this.db.prepare(
        `UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      );
      const updateReturnedQty = this.db.prepare(
        `UPDATE sale_items SET returned_quantity = COALESCE(returned_quantity, 0) + ? WHERE id = ?`
      );

      for (const item of input.items) {
        const itemTotal = item.quantity * item.unitPrice;
        insertReturnItem.run(
          returnId,
          item.saleItemId,
          productId,
          item.quantity,
          item.unitPrice,
          itemTotal
        );
        insertStockMovement.run(
          productId,
          item.quantity,
          item.unitPrice,
          returnId,
          `Ürün iadesi: ${saleNo}`
        );
        updateStock.run(item.quantity, productId);
        updateReturnedQty.run(item.quantity, item.saleItemId);
      }

      if (input.returnType === 'Para iadesi' && input.refundMethod && input.refundMethod !== 'Cari') {
        this.cashService.recordReturnRefund(
          returnId,
          input.saleId,
          customerId,
          returnTotal,
          input.refundMethod,
          `Ürün iadesi: ${saleNo}`
        );
      }

      if (input.returnType === 'Cari hesaba alacak' && customerId) {
        this.accountService.addCredit(customerId, returnTotal, {
          saleId: input.saleId,
          description: `Ürün iadesi: ${saleNo}`,
        });
      }

      if (input.returnType === 'Değişim' && input.exchangeItems) {
        const insertExchangeItem = this.db.prepare(
          `INSERT INTO exchange_items (return_id, product_id, barcode, quantity, unit_price, total_amount)
           VALUES (?, ?, ?, ?, ?, ?)`
        );
        const insertSaleMovement = this.db.prepare(
          `INSERT INTO stock_movements (product_id, movement_type, quantity, unit_price, reference_type, reference_id, notes)
           VALUES (?, 'Değişim', ?, ?, 'exchange', ?, ?)`
        );
        const decreaseStock = this.db.prepare(
          `UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
        );

        for (const ex of input.exchangeItems) {
          const exTotal = ex.quantity * ex.unitPrice;
          insertExchangeItem.run(
            returnId,
            ex.productId,
            ex.barcode || null,
            ex.quantity,
            ex.unitPrice,
            exTotal
          );
          insertSaleMovement.run(
            ex.productId,
            -ex.quantity,
            ex.unitPrice,
            returnId,
            `Değişim: ${saleNo}`
          );
          decreaseStock.run(ex.quantity, ex.productId);
        }

        if (exchangeDiff > 0 && input.refundMethod && input.refundMethod !== 'Cari') {
          this.cashService.recordExchangeCollection(
            returnId,
            input.saleId,
            customerId,
            exchangeDiff,
            input.refundMethod as CashPaymentType,
            `Değişim fark tahsilatı: ${saleNo}`
          );
        } else if (exchangeDiff < 0) {
          const refundAmount = Math.abs(exchangeDiff);
          if (input.refundMethod === 'Cari' && customerId) {
            this.accountService.addCredit(customerId, refundAmount, {
              saleId: input.saleId,
              description: `Değişim fark iadesi: ${saleNo}`,
            });
          } else if (input.refundMethod && input.refundMethod !== 'Cari') {
            this.cashService.recordReturnRefund(
              returnId,
              input.saleId,
              customerId,
              refundAmount,
              input.refundMethod,
              `Değişim fark iadesi: ${saleNo}`
            );
          }
        }
      }

      return { returnId, returnNo };
    });

    return tx();
  }
}
