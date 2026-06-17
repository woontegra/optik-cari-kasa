import type Database from 'better-sqlite3';
import type { SaleItemInput, PaymentType, CashPaymentType } from '../types/product';
import type { AddPaymentInput, SaleListFilters, CancelSaleInput } from '../types/sale';
import { CASH_PAYMENT_TYPES } from '../types/sale';
import { ProductService } from './product.service';
import { CustomerAccountService } from './customerAccount.service';
import { CashService } from './cash.service';
import { PosService } from './pos.service';
import { CampaignService } from './campaign.service';
import type { ManualDiscountInput } from '../types/campaign';

export interface CompleteSaleOptions {
  items: SaleItemInput[];
  paymentMode: PaymentType;
  paymentType?: CashPaymentType;
  paidAmount?: number;
  customerId?: number | null;
  prescriptionId?: number | null;
  posAccountId?: number | null;
  campaignCode?: string | null;
  manualDiscount?: ManualDiscountInput | null;
}

export class SaleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaleValidationError';
  }
}

function resolvePaymentAmounts(
  total: number,
  paymentMode: PaymentType,
  paidAmount?: number
): { paid: number; remaining: number; paymentStatus: string } {
  if (paymentMode === 'Açık Hesap') {
    return { paid: 0, remaining: total, paymentStatus: 'Açık hesap' };
  }
  if (paymentMode === 'Parçalı Ödeme') {
    const paid = paidAmount ?? 0;
    if (paid >= total) {
      return { paid: total, remaining: 0, paymentStatus: 'Ödendi' };
    }
    if (paid <= 0) {
      return { paid: 0, remaining: total, paymentStatus: 'Açık hesap' };
    }
    return { paid, remaining: total - paid, paymentStatus: 'Kısmi ödendi' };
  }
  return { paid: total, remaining: 0, paymentStatus: 'Ödendi' };
}

export class SaleService {
  private productService: ProductService;
  private accountService: CustomerAccountService;
  private cashService: CashService;
  private posService: PosService;
  private campaignService: CampaignService;

  constructor(private db: Database.Database) {
    this.productService = new ProductService(db);
    this.accountService = new CustomerAccountService(db);
    this.cashService = new CashService(db);
    this.posService = new PosService(db);
    this.campaignService = new CampaignService(db);
  }

  list(filters: SaleListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT s.*, c.full_name as customer_name,
             pr.prescription_no, pr.e_prescription_no,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.date_from) {
      sql += ` AND date(s.sale_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(s.sale_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.customer_search?.trim()) {
      sql += ` AND (c.full_name LIKE ? OR c.phone LIKE ? OR c.tc_no LIKE ?)`;
      const term = `%${filters.customer_search.trim()}%`;
      params.push(term, term, term);
    }
    if (filters.payment_status) {
      sql += ` AND s.payment_status = ?`;
      params.push(filters.payment_status);
    }
    if (filters.status) {
      sql += ` AND s.status = ?`;
      params.push(filters.status);
    }
    if (filters.payment_type) {
      sql += ` AND EXISTS (
        SELECT 1 FROM payments p WHERE p.sale_id = s.id AND p.payment_type = ?
      )`;
      params.push(filters.payment_type);
    }

    sql += ` ORDER BY s.sale_date DESC, s.id DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  getById(id: number): Record<string, unknown> | null {
    const sale = this.db
      .prepare(
        `SELECT s.*, c.full_name as customer_name, c.phone as customer_phone, c.tc_no as customer_tc,
                pr.prescription_no, pr.e_prescription_no, pr.doctor, pr.institution
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
         WHERE s.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!sale) return null;

    const items = this.db
      .prepare(
        `SELECT si.*, p.name as product_name, p.product_type, p.id as product_id,
                COALESCE(si.returned_quantity, 0) as returned_quantity
         FROM sale_items si
         INNER JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?
         ORDER BY si.id`
      )
      .all(id);

    const payments = this.db
      .prepare(`SELECT * FROM payments WHERE sale_id = ? ORDER BY payment_date`)
      .all(id);

    const returns = this.db
      .prepare(
        `SELECT r.*, ri.product_id, ri.quantity, ri.unit_price, ri.total_amount as item_total,
                p.name as product_name
         FROM returns r
         LEFT JOIN return_items ri ON ri.return_id = r.id
         LEFT JOIN products p ON p.id = ri.product_id
         WHERE r.sale_id = ?
         ORDER BY r.created_at DESC`
      )
      .all(id);

    return { ...sale, items, payments, returns };
  }

  listByCustomer(customerId: number): Record<string, unknown>[] {
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

  completeSale(options: CompleteSaleOptions): { saleId: number; saleNo: string } {
    const {
      items,
      paymentMode,
      paymentType,
      paidAmount,
      customerId,
      prescriptionId,
      posAccountId,
      campaignCode,
      manualDiscount,
    } = options;

    if (!items.length) {
      throw new SaleValidationError('Satış listesi boş.');
    }

    if (paymentMode === 'Açık Hesap' || paymentMode === 'Parçalı Ödeme') {
      if (!customerId) {
        throw new SaleValidationError('Açık hesap ve parçalı ödeme için müşteri seçimi zorunludur.');
      }
    }

    if (paymentMode === 'Parçalı Ödeme') {
      const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      if ((paidAmount ?? 0) > total) {
        throw new SaleValidationError('Alınan tutar toplam tutardan fazla olamaz.');
      }
      if (!paymentType || !CASH_PAYMENT_TYPES.includes(paymentType)) {
        throw new SaleValidationError('Parçalı ödeme için ödeme türü seçilmelidir.');
      }
    }

    const cashPaymentType =
      paymentMode === 'Parçalı Ödeme'
        ? paymentType!
        : paymentMode === 'Açık Hesap'
          ? null
          : (paymentMode as CashPaymentType);

    if (customerId) {
      const customer = this.db
        .prepare(`SELECT id FROM customers WHERE id = ? AND (is_active = 1 OR is_active IS NULL)`)
        .get(customerId);
      if (!customer) {
        throw new SaleValidationError('Seçilen müşteri bulunamadı veya pasif.');
      }
    }

    if (prescriptionId) {
      const prescription = this.db
        .prepare(
          `SELECT id, customer_id FROM prescriptions
           WHERE id = ? AND status = 'Aktif' AND (is_active = 1 OR is_active IS NULL)`
        )
        .get(prescriptionId) as { id: number; customer_id: number } | undefined;
      if (!prescription) {
        throw new SaleValidationError('Seçilen reçete bulunamadı veya aktif değil.');
      }
      if (customerId && prescription.customer_id !== customerId) {
        throw new SaleValidationError('Reçete seçilen müşteriye ait değil.');
      }
    }

    for (const item of items) {
      const product = this.productService.getById(item.productId);
      if (!product) {
        throw new SaleValidationError(`Ürün bulunamadı (ID: ${item.productId}).`);
      }
      if (product.status !== 'Aktif') {
        throw new SaleValidationError(`"${product.name}" pasif durumda, satılamaz.`);
      }
      const stock = product.stock_quantity as number;
      if (item.quantity > stock) {
        throw new SaleValidationError(
          `"${product.name}" için yetersiz stok. Mevcut: ${stock}, İstenen: ${item.quantity}`
        );
      }
    }

    const calc = this.campaignService.calculateForSale({
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.originalUnitPrice ?? i.unitPrice })),
      customerId,
      campaignCode,
      manualDiscount,
    });

    const grossTotal = calc.subtotal;
    const totalDiscount = calc.campaignDiscountTotal + calc.manualDiscountAmount;
    const netAmount = calc.netTotal;
    const { paid, remaining, paymentStatus } = resolvePaymentAmounts(netAmount, paymentMode, paidAmount);
    const saleNo = `SAT-${Date.now()}`;

    const completeTx = this.db.transaction(() => {
      const saleResult = this.db
        .prepare(
          `INSERT INTO sales (
            sale_no, customer_id, prescription_id, total_amount, discount_amount, net_amount,
            total_discount_amount, manual_discount_amount, campaign_discount_amount, manual_discount_note,
            paid_amount, remaining_amount, payment_status, status, sale_date, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Tamamlandı', datetime('now', 'localtime'), datetime('now', 'localtime'))`
        )
        .run(
          saleNo,
          customerId || null,
          prescriptionId || null,
          grossTotal,
          totalDiscount,
          netAmount,
          totalDiscount,
          calc.manualDiscountAmount,
          calc.campaignDiscountTotal,
          manualDiscount?.description || null,
          paid,
          remaining,
          paymentStatus
        );

      const saleId = Number(saleResult.lastInsertRowid);

      const insertItem = this.db.prepare(
        `INSERT INTO sale_items (
          sale_id, product_id, barcode, quantity, unit_price, total_price, line_note,
          discount_amount, campaign_id, original_unit_price, final_unit_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertMovement = this.db.prepare(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, unit_price, reference_type, reference_id, notes)
         VALUES (?, 'Satış', ?, ?, 'sale', ?, ?)`
      );
      const updateStock = this.db.prepare(
        `UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      );

      const saleItemIds: number[] = [];

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const calcLine = calc.items[idx];
        const finalUnit = calcLine?.unitPrice ?? item.unitPrice;
        const totalPrice = calcLine?.lineTotal ?? item.quantity * finalUnit;
        const originalUnit = calcLine?.originalUnitPrice ?? item.originalUnitPrice ?? item.unitPrice;
        const lineDiscount = calcLine?.discountAmount ?? 0;
        const campaignId = calcLine?.campaignId ?? item.campaignId ?? null;

        const itemResult = insertItem.run(
          saleId,
          item.productId,
          item.barcode || null,
          item.quantity,
          finalUnit,
          totalPrice,
          item.lineNote || null,
          lineDiscount,
          campaignId,
          originalUnit,
          finalUnit
        );
        saleItemIds.push(Number(itemResult.lastInsertRowid));
        insertMovement.run(item.productId, -item.quantity, finalUnit, saleId, `Satış: ${saleNo}`);
        updateStock.run(item.quantity, item.productId);
      }

      this.campaignService.recordSaleDiscounts(saleId, saleItemIds, calc, manualDiscount?.description);

      if (paid > 0 && cashPaymentType) {
        const payResult = this.db
          .prepare(
            `INSERT INTO payments (sale_id, customer_id, amount, payment_type, description, payment_date, pos_account_id)
             VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?)`
          )
          .run(saleId, customerId || null, paid, cashPaymentType, `Satış tahsilatı: ${saleNo}`, posAccountId ?? null);

        if (cashPaymentType === 'Kredi Kartı') {
          const posId = posAccountId ?? (this.posService.getDefaultAccount()?.id as number | undefined);
          if (posId) {
            const posMove = this.posService.recordSalePayment(saleId, posId, paid);
            this.db.prepare(`UPDATE payments SET pos_movement_id = ? WHERE id = ?`).run(posMove.id, payResult.lastInsertRowid);
          }
        } else {
          this.cashService.recordSalePayment(
            saleId,
            customerId || null,
            paid,
            cashPaymentType,
            `Satış: ${saleNo}`
          );
        }
      }

      if (remaining > 0 && customerId) {
        this.accountService.addDebt(customerId, remaining, saleId, `Satış borcu: ${saleNo}`);
      }

      if (customerId) {
        this.db
          .prepare(
            `UPDATE customers SET last_sale_date = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`
          )
          .run(customerId);
      }

      return { saleId, saleNo };
    });

    return completeTx();
  }

  addPayment(input: AddPaymentInput): { paymentId: number } {
    const sale = this.db
      .prepare(`SELECT * FROM sales WHERE id = ?`)
      .get(input.saleId) as Record<string, unknown> | undefined;

    if (!sale) {
      throw new SaleValidationError('Satış bulunamadı.');
    }
    if (sale.status === 'İptal edildi') {
      throw new SaleValidationError('İptal edilmiş satışa tahsilat eklenemez.');
    }
    if (input.amount <= 0) {
      throw new SaleValidationError('Tahsilat tutarı 0\'dan büyük olmalıdır.');
    }

    const remaining = Number(sale.remaining_amount ?? 0);
    if (input.amount > remaining) {
      throw new SaleValidationError(`Tahsilat tutarı kalan tutardan (${remaining}) fazla olamaz.`);
    }

    const customerId = sale.customer_id as number | null;
    if (!customerId) {
      throw new SaleValidationError('Müşterisi olmayan satışa tahsilat eklenemez.');
    }

    const saleNo = String(sale.sale_no || input.saleId);

    const tx = this.db.transaction(() => {
      const payResult = this.db
        .prepare(
          `INSERT INTO payments (sale_id, customer_id, amount, payment_type, description, payment_date)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.saleId,
          customerId,
          input.amount,
          input.paymentType,
          input.description || 'Satış tahsilatı',
          input.paymentDate || new Date().toISOString().slice(0, 19).replace('T', ' ')
        );

      const newPaid = Number(sale.paid_amount ?? 0) + input.amount;
      const newRemaining = remaining - input.amount;
      const newStatus = newRemaining <= 0 ? 'Ödendi' : 'Kısmi ödendi';

      this.db
        .prepare(
          `UPDATE sales SET paid_amount = ?, remaining_amount = ?, payment_status = ?,
           updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(newPaid, Math.max(0, newRemaining), newStatus, input.saleId);

      this.cashService.recordSalePayment(
        input.saleId,
        customerId,
        input.amount,
        input.paymentType,
        input.description || `Satış tahsilatı: ${saleNo}`
      );

      this.accountService.addCollection(customerId, input.amount, {
        saleId: input.saleId,
        description: input.description || `Satış tahsilatı: ${saleNo}`,
      });

      return { paymentId: Number(payResult.lastInsertRowid) };
    });

    return tx();
  }

  cancelSale(input: CancelSaleInput): { cancelled: boolean; message: string } {
    const { saleId, reason, note } = input;

    if (!reason?.trim()) {
      throw new SaleValidationError('İptal nedeni zorunludur.');
    }

    const sale = this.db.prepare(`SELECT * FROM sales WHERE id = ?`).get(saleId) as
      | Record<string, unknown>
      | undefined;

    if (!sale) {
      throw new SaleValidationError('Satış bulunamadı.');
    }
    if (sale.status === 'İptal edildi') {
      throw new SaleValidationError('Satış zaten iptal edilmiş.');
    }
    if (sale.status !== 'Tamamlandı') {
      throw new SaleValidationError('Sadece tamamlanmış satışlar iptal edilebilir.');
    }

    const saleNo = String(sale.sale_no || saleId);
    const customerId = sale.customer_id as number | null;
    const remaining = Number(sale.remaining_amount ?? 0);

    const saleItems = this.db
      .prepare(`SELECT * FROM sale_items WHERE sale_id = ?`)
      .all(saleId) as Array<{
      id: number;
      product_id: number;
      quantity: number;
      unit_price: number;
      returned_quantity?: number;
    }>;

    const payments = this.db
      .prepare(`SELECT * FROM payments WHERE sale_id = ?`)
      .all(saleId) as Array<{
      amount: number;
      payment_type: CashPaymentType;
    }>;

    const tx = this.db.transaction(() => {
      for (const item of saleItems) {
        const returned = Number(item.returned_quantity ?? 0);
        const restoreQty = item.quantity - returned;
        if (restoreQty <= 0) continue;

        this.db
          .prepare(
            `INSERT INTO stock_movements (product_id, movement_type, quantity, unit_price, reference_type, reference_id, notes)
             VALUES (?, 'Satış iptali', ?, ?, 'sale_cancel', ?, ?)`
          )
          .run(
            item.product_id,
            restoreQty,
            item.unit_price,
            saleId,
            `Satış iptali: ${saleNo}`
          );

        this.db
          .prepare(
            `UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
          )
          .run(restoreQty, item.product_id);
      }

      for (const payment of payments) {
        this.cashService.recordSaleRefund(
          saleId,
          customerId,
          payment.amount,
          payment.payment_type,
          `Satış iptali: ${saleNo}`
        );
      }

      if (customerId && remaining > 0) {
        this.accountService.reverseDebt(
          customerId,
          remaining,
          saleId,
          `Satış iptali: ${saleNo}`
        );
      }

      this.db
        .prepare(
          `UPDATE sales SET status = 'İptal edildi', payment_status = 'İptal',
           paid_amount = 0, remaining_amount = 0,
           cancel_reason = ?, cancel_note = ?, cancelled_at = datetime('now', 'localtime'),
           updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(reason.trim(), note?.trim() || null, saleId);

      this.campaignService.cancelSaleUsages(saleId);
    });

    tx();

    return { cancelled: true, message: `Satış ${saleNo} iptal edildi.` };
  }

  searchForReturn(query: string): Record<string, unknown>[] {
    const term = query.trim();
    if (!term) return [];

    let sql = `
      SELECT DISTINCT s.*, c.full_name as customer_name, c.phone as customer_phone
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'Tamamlandı'
    `;
    const params: unknown[] = [];

    if (/^\d+$/.test(term)) {
      sql += ` AND (s.id = ? OR s.sale_no LIKE ? OR si.barcode = ?)`;
      params.push(Number(term), `%${term}%`, term);
    } else {
      sql += ` AND (s.sale_no LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR si.barcode = ?)`;
      const like = `%${term}%`;
      params.push(like, like, like, term);
    }

    sql += ` ORDER BY s.sale_date DESC LIMIT 20`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }
}
