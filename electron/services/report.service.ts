import * as XLSX from 'xlsx';
import type Database from 'better-sqlite3';
import type {
  CashReportFilter,
  CustomerAccountReportFilter,
  DayEndFilter,
  PrescriptionMedulaReportFilter,
  PrintReportPayload,
  ReturnCancelReportFilter,
  SalesReportFilter,
  StockReportFilter,
} from '../types/report';
import { MedulaExportService } from './medulaExport.service';

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportValidationError';
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultRange30(): { date_from: string; date_to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) };
}

function resolveRange(filters: { date_from?: string; date_to?: string }, required = false) {
  const range = {
    date_from: filters.date_from || defaultRange30().date_from,
    date_to: filters.date_to || defaultRange30().date_to,
  };
  if (required && !filters.date_from && !filters.date_to) {
    // defaults applied
  }
  const from = new Date(range.date_from);
  const to = new Date(range.date_to);
  const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 366) {
    throw new ReportValidationError('Tarih aralığı en fazla 366 gün olabilir.');
  }
  return range;
}

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ₺`;
}

export class ReportService {
  private medulaService: MedulaExportService;

  constructor(private db: Database.Database) {
    this.medulaService = new MedulaExportService(db);
  }

  private getCompanyName(): string {
    const row = this.db
      .prepare(`SELECT name FROM companies WHERE is_default = 1 LIMIT 1`)
      .get() as { name: string } | undefined;
    return row?.name || 'Woontegra Optik';
  }

  getDayEnd(filter: DayEndFilter = {}): Record<string, unknown> {
    const date = filter.date || todayStr();

    const salesTotal = this.db
      .prepare(
        `SELECT COALESCE(SUM(net_amount), 0) as total, COUNT(*) as count
         FROM sales WHERE date(sale_date) = date(?) AND status != 'İptal edildi'`
      )
      .get(date) as { total: number; count: number };

    const collectionTotal = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
         WHERE date(movement_date) = date(?) AND amount > 0`
      )
      .get(date) as { total: number };

    const cashByType = (type: string) =>
      (
        this.db
          .prepare(
            `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
             WHERE date(movement_date) = date(?) AND amount > 0 AND payment_type = ?`
          )
          .get(date, type) as { total: number }
      ).total;

    const openAccountSales = this.db
      .prepare(
        `SELECT COALESCE(SUM(remaining_amount), 0) as total FROM sales
         WHERE date(sale_date) = date(?) AND status != 'İptal edildi' AND remaining_amount > 0`
      )
      .get(date) as { total: number };

    const expenseTotal = this.db
      .prepare(
        `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM cash_movements
         WHERE date(movement_date) = date(?) AND amount < 0`
      )
      .get(date) as { total: number };

    const returnTotal = this.db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM returns
         WHERE date(created_at) = date(?) AND status = 'Tamamlandı'`
      )
      .get(date) as { total: number };

    const cancelledCount = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM sales
         WHERE date(cancelled_at) = date(?) AND status = 'İptal edildi'`
      )
      .get(date) as { count: number };

    const productQty = this.db
      .prepare(
        `SELECT COALESCE(SUM(si.quantity), 0) as qty
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id
         WHERE date(s.sale_date) = date(?) AND s.status != 'İptal edildi'`
      )
      .get(date) as { qty: number };

    const netCash = collectionTotal.total - expenseTotal.total;

    const daySales = this.db
      .prepare(
        `SELECT s.*, c.full_name as customer_name
         FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
         WHERE date(s.sale_date) = date(?)
         ORDER BY s.sale_date DESC`
      )
      .all(date);

    const dayCash = this.db
      .prepare(
        `SELECT cm.*, c.full_name as customer_name, s.sale_no
         FROM cash_movements cm
         LEFT JOIN customers c ON c.id = cm.customer_id
         LEFT JOIN sales s ON s.id = cm.sale_id
         WHERE date(cm.movement_date) = date(?)
         ORDER BY cm.movement_date DESC`
      )
      .all(date);

    const dayOpenAccount = this.db
      .prepare(
        `SELECT s.*, c.full_name as customer_name
         FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
         WHERE date(s.sale_date) = date(?) AND s.remaining_amount > 0 AND s.status != 'İptal edildi'
         ORDER BY s.sale_date DESC`
      )
      .all(date);

    const dayReturns = this.db
      .prepare(
        `SELECT r.*, s.sale_no, c.full_name as customer_name
         FROM returns r
         LEFT JOIN sales s ON s.id = r.sale_id
         LEFT JOIN customers c ON c.id = r.customer_id
         WHERE date(r.created_at) = date(?)
         ORDER BY r.created_at DESC`
      )
      .all(date);

    const dayCancellations = this.db
      .prepare(
        `SELECT s.*, c.full_name as customer_name
         FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
         WHERE date(s.cancelled_at) = date(?) AND s.status = 'İptal edildi'
         ORDER BY s.cancelled_at DESC`
      )
      .all(date);

    return {
      date,
      summary: {
        totalSales: salesTotal.total,
        totalCollection: collectionTotal.total,
        cashCollection: cashByType('Nakit'),
        cardCollection: cashByType('Kredi Kartı'),
        transferCollection: cashByType('Havale/EFT'),
        openAccountSales: openAccountSales.total,
        expenseTotal: expenseTotal.total,
        netCash,
        returnTotal: returnTotal.total,
        cancelledCount: cancelledCount.count,
        saleCount: salesTotal.count,
        productQuantity: productQty.qty,
      },
      tables: {
        sales: daySales,
        cashMovements: dayCash,
        openAccountSales: dayOpenAccount,
        returns: dayReturns,
        cancellations: dayCancellations,
      },
    };
  }

  getSalesReport(filters: SalesReportFilter = {}): Record<string, unknown> {
    const range = resolveRange(filters);
    let sql = `
      SELECT s.*, c.full_name as customer_name,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count,
             (SELECT GROUP_CONCAT(DISTINCT p.payment_type) FROM payments p WHERE p.sale_id = s.id) as payment_types
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
    `;
    const params: unknown[] = [range.date_from, range.date_to];

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
      sql += ` AND EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.id AND p.payment_type = ?)`;
      params.push(filters.payment_type);
    }
    if (filters.product_type || filters.product_search?.trim()) {
      sql += ` AND EXISTS (
        SELECT 1 FROM sale_items si
        INNER JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = s.id`;
      if (filters.product_type) {
        sql += ` AND p.product_type = ?`;
        params.push(filters.product_type);
      }
      if (filters.product_search?.trim()) {
        sql += ` AND (p.name LIKE ? OR si.barcode LIKE ?)`;
        const term = `%${filters.product_search.trim()}%`;
        params.push(term, term);
      }
      sql += `)`;
    }

    sql += ` ORDER BY s.sale_date DESC, s.id DESC LIMIT 2000`;

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    const summaryRow = this.db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN status != 'İptal edildi' THEN net_amount ELSE 0 END), 0) as total_sales,
          COALESCE(SUM(CASE WHEN status != 'İptal edildi' THEN paid_amount ELSE 0 END), 0) as total_paid,
          COALESCE(SUM(CASE WHEN status != 'İptal edildi' THEN remaining_amount ELSE 0 END), 0) as total_remaining,
          COUNT(CASE WHEN status != 'İptal edildi' THEN 1 END) as sale_count
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)`
      )
      .get(range.date_from, range.date_to) as {
      total_sales: number;
      total_paid: number;
      total_remaining: number;
      sale_count: number;
    };

    const productQty = this.db
      .prepare(
        `SELECT COALESCE(SUM(si.quantity), 0) as qty
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id
         WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
         AND s.status != 'İptal edildi'`
      )
      .get(range.date_from, range.date_to) as { qty: number };

    const saleCount = summaryRow.sale_count || 0;
    return {
      dateRange: range,
      summary: {
        totalSales: summaryRow.total_sales,
        totalCollection: summaryRow.total_paid,
        openAccountRemaining: summaryRow.total_remaining,
        saleCount,
        productQuantity: productQty.qty,
        averageSale: saleCount > 0 ? summaryRow.total_sales / saleCount : 0,
      },
      rows,
    };
  }

  getCashReport(filters: CashReportFilter = {}): Record<string, unknown> {
    const range = resolveRange(filters);
    let sql = `
      SELECT cm.*, c.full_name as customer_name, s.sale_no
      FROM cash_movements cm
      LEFT JOIN customers c ON c.id = cm.customer_id
      LEFT JOIN sales s ON s.id = cm.sale_id
      WHERE date(cm.movement_date) >= date(?) AND date(cm.movement_date) <= date(?)
    `;
    const params: unknown[] = [range.date_from, range.date_to];

    if (filters.payment_type) {
      sql += ` AND cm.payment_type = ?`;
      params.push(filters.payment_type);
    }
    if (filters.movement_type) {
      sql += ` AND cm.movement_type = ?`;
      params.push(filters.movement_type);
    }
    if (filters.customer_search?.trim()) {
      sql += ` AND c.full_name LIKE ?`;
      params.push(`%${filters.customer_search.trim()}%`);
    }
    if (filters.description?.trim()) {
      sql += ` AND cm.description LIKE ?`;
      params.push(`%${filters.description.trim()}%`);
    }

    sql += ` ORDER BY cm.movement_date DESC LIMIT 2000`;
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    const income = rows.reduce((s, r) => s + Math.max(0, Number(r.amount)), 0);
    const expense = rows.reduce((s, r) => s + Math.abs(Math.min(0, Number(r.amount))), 0);

    const sumByType = (type: string) =>
      rows
        .filter((r) => r.payment_type === type && Number(r.amount) > 0)
        .reduce((s, r) => s + Number(r.amount), 0);

    const mapped = rows.map((r) => {
      const amount = Number(r.amount);
      return {
        ...r,
        income: amount > 0 ? amount : 0,
        expense: amount < 0 ? Math.abs(amount) : 0,
        net: amount,
      };
    });

    return {
      dateRange: range,
      summary: {
        totalIncome: income,
        totalExpense: expense,
        netCash: income - expense,
        cashTotal: sumByType('Nakit'),
        cardTotal: sumByType('Kredi Kartı'),
        transferTotal: sumByType('Havale/EFT'),
      },
      rows: mapped,
    };
  }

  private appendStockProductFilters(
    sql: string,
    params: unknown[],
    filters: StockReportFilter,
    options: { includeDateRange?: boolean; expiryField?: string } = {}
  ): string {
    const expiryField = options.expiryField || 'p.uts_expiry_date';

    if (filters.product_type) {
      sql += ` AND p.product_type = ?`;
      params.push(filters.product_type);
    }
    if (filters.group_id) {
      sql += ` AND p.group_id = ?`;
      params.push(filters.group_id);
    }
    if (filters.subgroup_id) {
      sql += ` AND p.subgroup_id = ?`;
      params.push(filters.subgroup_id);
    }
    if (filters.brand_id) {
      sql += ` AND p.brand_id = ?`;
      params.push(filters.brand_id);
    }
    if (filters.model_id) {
      sql += ` AND p.model_id = ?`;
      params.push(filters.model_id);
    }
    if (filters.color_id) {
      sql += ` AND p.color_id = ?`;
      params.push(filters.color_id);
    }
    if (filters.lens_type_id) {
      sql += ` AND (p.lens_type_id = ? OR p.contact_lens_type_id = ?)`;
      params.push(filters.lens_type_id, filters.lens_type_id);
    }
    if (filters.lens_material_id) {
      sql += ` AND p.lens_material_id = ?`;
      params.push(filters.lens_material_id);
    }
    if (filters.lens_coating_id) {
      sql += ` AND p.lens_coating_id = ?`;
      params.push(filters.lens_coating_id);
    }
    if (filters.brand?.trim()) {
      sql += ` AND (p.brand LIKE ? OR b.name LIKE ?)`;
      const term = `%${filters.brand.trim()}%`;
      params.push(term, term);
    }
    if (filters.category?.trim()) {
      sql += ` AND p.category LIKE ?`;
      params.push(`%${filters.category.trim()}%`);
    }
    if (filters.status) {
      sql += ` AND p.status = ?`;
      params.push(filters.status);
    }
    if (filters.shelf_location?.trim()) {
      sql += ` AND p.shelf_location LIKE ?`;
      params.push(`%${filters.shelf_location.trim()}%`);
    }
    if (filters.search?.trim()) {
      sql += ` AND (
        p.name LIKE ? OR pb.barcode LIKE ? OR p.stock_code LIKE ? OR
        p.brand LIKE ? OR p.model LIKE ? OR b.name LIKE ? OR m.name LIKE ?
      )`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term, term, term, term);
    }
    if (filters.critical_only) {
      sql += ` AND p.status = 'Aktif' AND p.stock_quantity <= p.min_stock`;
    }
    if (filters.lot_no?.trim()) {
      sql += ` AND p.lot_no LIKE ?`;
      params.push(`%${filters.lot_no.trim()}%`);
    }
    if (options.includeDateRange && filters.date_from) {
      sql += ` AND date(${expiryField}) >= date(?)`;
      params.push(filters.date_from);
    }
    if (options.includeDateRange && filters.date_to) {
      sql += ` AND date(${expiryField}) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.expiry_days_max != null && Number.isFinite(filters.expiry_days_max)) {
      sql += ` AND CAST(julianday(date(${expiryField})) - julianday(date('now')) AS INTEGER) <= ?`;
      params.push(filters.expiry_days_max);
    }
    if (filters.sph_from?.trim()) {
      sql += ` AND CAST(NULLIF(p.sph, '') AS REAL) >= ?`;
      params.push(Number(filters.sph_from));
    }
    if (filters.sph_to?.trim()) {
      sql += ` AND CAST(NULLIF(p.sph, '') AS REAL) <= ?`;
      params.push(Number(filters.sph_to));
    }
    if (filters.cyl_from?.trim()) {
      sql += ` AND CAST(NULLIF(p.cyl, '') AS REAL) >= ?`;
      params.push(Number(filters.cyl_from));
    }
    if (filters.cyl_to?.trim()) {
      sql += ` AND CAST(NULLIF(p.cyl, '') AS REAL) <= ?`;
      params.push(Number(filters.cyl_to));
    }
    if (filters.axis_from?.trim()) {
      sql += ` AND CAST(NULLIF(p.axis, '') AS REAL) >= ?`;
      params.push(Number(filters.axis_from));
    }
    if (filters.axis_to?.trim()) {
      sql += ` AND CAST(NULLIF(p.axis, '') AS REAL) <= ?`;
      params.push(Number(filters.axis_to));
    }
    if (filters.add_from?.trim()) {
      sql += ` AND CAST(NULLIF(p.addition, '') AS REAL) >= ?`;
      params.push(Number(filters.add_from));
    }
    if (filters.add_to?.trim()) {
      sql += ` AND CAST(NULLIF(p.addition, '') AS REAL) <= ?`;
      params.push(Number(filters.add_to));
    }
    if (filters.diameter?.trim()) {
      sql += ` AND p.diameter LIKE ?`;
      params.push(`%${filters.diameter.trim()}%`);
    }
    if (filters.base_curve?.trim()) {
      sql += ` AND p.base_curve LIKE ?`;
      params.push(`%${filters.base_curve.trim()}%`);
    }

    return sql;
  }

  private summarizeStockRows(rows: Record<string, unknown>[]): Record<string, number> {
    return {
      productCount: rows.length,
      totalQuantity: rows.reduce((sum, row) => sum + Number(row.stock_quantity || row.total_qty || 0), 0),
      criticalCount: rows.reduce((sum, row) => {
        if (row.min_stock == null) return sum;
        return sum + (Number(row.stock_quantity || 0) <= Number(row.min_stock || 0) ? 1 : 0);
      }, 0),
      stockSaleValue: rows.reduce(
        (sum, row) => sum + Number(row.stock_sale_value || Number(row.stock_quantity || 0) * Number(row.sale_price || 0)),
        0
      ),
      stockPurchaseValue: rows.reduce(
        (sum, row) => sum + Number(row.stock_purchase_value || Number(row.stock_quantity || 0) * Number(row.purchase_price || 0)),
        0
      ),
    };
  }

  getStockReport(filters: StockReportFilter = {}): Record<string, unknown> {
    const reportType = filters.report_type || 'current';
    const range = filters.date_from && filters.date_to ? resolveRange(filters) : defaultRange30();
    const baseJoins = `
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
      LEFT JOIN optical_lookup_values g ON g.id = p.group_id
      LEFT JOIN optical_lookup_values sg ON sg.id = p.subgroup_id
      LEFT JOIN optical_lookup_values b ON b.id = p.brand_id
      LEFT JOIN optical_lookup_values m ON m.id = p.model_id
      LEFT JOIN optical_lookup_values c ON c.id = p.color_id
      LEFT JOIN optical_lookup_values lt ON lt.id = p.lens_type_id
      LEFT JOIN optical_lookup_values clt ON clt.id = p.contact_lens_type_id
      LEFT JOIN optical_lookup_values lm ON lm.id = p.lens_material_id
      LEFT JOIN optical_lookup_values lc ON lc.id = p.lens_coating_id
    `;

    if (reportType === 'countDifferences') {
      let sql = `
        SELECT c.count_no, c.name as count_name, c.count_date, c.status as count_status,
               c.count_type, c.product_type_filter, c.category_filter, c.brand_filter, c.location_filter,
               ici.barcode, p.name as product_name, p.product_type, p.brand, p.model, p.shelf_location,
               ici.expected_quantity, ici.counted_quantity, ici.difference_quantity,
               ici.status as item_status, ici.last_scanned_at, ici.notes
        FROM inventory_count_items ici
        INNER JOIN inventory_counts c ON c.id = ici.count_id
        INNER JOIN products p ON p.id = ici.product_id
        WHERE c.status IN ('Tamamlandı', 'Farklar İşlendi')
        AND ici.difference_quantity != 0
      `;
      const params: unknown[] = [];
      sql += ` AND date(c.count_date) >= date(?) AND date(c.count_date) <= date(?)`;
      params.push(range.date_from, range.date_to);
      if (filters.product_type) {
        sql += ` AND p.product_type = ?`;
        params.push(filters.product_type);
      }
      sql += ` ORDER BY c.count_date DESC, p.name LIMIT 2000`;
      const rows = this.db.prepare(sql).all(...params);
      return { reportType, dateRange: range, rows, summary: { rowCount: rows.length } };
    }

    if (reportType === 'movements') {
      let sql = `
        SELECT sm.*, p.name as product_name, p.product_type, pb.barcode,
               seb.batch_no, seb.document_no, sup.name as supplier_name,
               ic.count_no as inventory_count_no
        FROM stock_movements sm
        INNER JOIN products p ON p.id = sm.product_id
        LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
        LEFT JOIN stock_entry_batches seb ON sm.reference_type = 'stock_entry_batch' AND sm.reference_id = seb.id
        LEFT JOIN suppliers sup ON seb.supplier_id = sup.id
        LEFT JOIN inventory_counts ic ON sm.reference_type = 'inventory_count' AND sm.reference_id = ic.id
        WHERE date(sm.created_at) >= date(?) AND date(sm.created_at) <= date(?)
      `;
      const params: unknown[] = [range.date_from, range.date_to];
      if (filters.product_type) {
        sql += ` AND p.product_type = ?`;
        params.push(filters.product_type);
      }
      sql += ` ORDER BY sm.created_at DESC LIMIT 2000`;
      const rows = this.db.prepare(sql).all(...params);
      return { reportType, dateRange: range, rows, summary: { rowCount: rows.length } };
    }

    if (reportType === 'topSelling') {
      const rows = this.db
        .prepare(
          `SELECT p.id, pb.barcode, p.name as product_name, p.product_type, p.brand, p.model,
                  SUM(si.quantity) as sold_qty, SUM(si.total_price) as sold_total
           FROM sale_items si
           INNER JOIN products p ON p.id = si.product_id
           LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
           INNER JOIN sales s ON s.id = si.sale_id
           WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
           AND s.status != 'İptal edildi'
           GROUP BY p.id
           ORDER BY sold_qty DESC
           LIMIT 100`
        )
        .all(range.date_from, range.date_to);
      return { reportType, dateRange: range, rows, summary: { rowCount: rows.length } };
    }

    if (reportType === 'inactive') {
      const rows = this.db
        .prepare(
          `SELECT p.*, pb.barcode,
                  COALESCE(MAX(s.sale_date), '') as last_sale_date
           FROM products p
           LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
           LEFT JOIN sale_items si ON si.product_id = p.id
           LEFT JOIN sales s ON s.id = si.sale_id AND s.status != 'İptal edildi'
           WHERE p.status = 'Aktif'
           GROUP BY p.id
           HAVING last_sale_date = '' OR date(last_sale_date) < date(?)
           ORDER BY p.name
           LIMIT 500`
        )
        .all(range.date_from);
      return { reportType, dateRange: range, rows, summary: { rowCount: rows.length } };
    }

    if (reportType === 'opticalDistribution' || reportType === 'brandStock') {
      let sql = `
        SELECT
          g.name as group_name,
          sg.name as subgroup_name,
          COALESCE(b.name, p.brand) as brand_name,
          COALESCE(m.name, p.model) as model_name,
          COUNT(*) as product_count,
          COALESCE(SUM(p.stock_quantity), 0) as total_qty,
          COALESCE(SUM(p.stock_quantity * p.sale_price), 0) as stock_sale_value
        FROM products p
        ${baseJoins}
        WHERE p.status = 'Aktif'
      `;
      const params: unknown[] = [];
      sql = this.appendStockProductFilters(sql, params, { ...filters, status: 'Aktif' });
      sql += `
        GROUP BY p.group_id, p.subgroup_id, p.brand_id, p.model_id, p.brand, p.model
        ORDER BY total_qty DESC, brand_name, model_name
        LIMIT 2000
      `;
      const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
      return {
        reportType,
        dateRange: range,
        rows,
        summary: {
          rowCount: rows.length,
          productCount: rows.reduce((sum, row) => sum + Number(row.product_count || 0), 0),
          totalQuantity: rows.reduce((sum, row) => sum + Number(row.total_qty || 0), 0),
          stockSaleValue: rows.reduce((sum, row) => sum + Number(row.stock_sale_value || 0), 0),
        },
      };
    }

    if (reportType === 'lensExpiry') {
      let sql = `
        SELECT
          p.name,
          pb.barcode,
          COALESCE(b.name, p.brand) as brand_name,
          COALESCE(m.name, p.model) as model_name,
          COALESCE(lt.name, clt.name) as lens_type_name,
          p.lot_no,
          p.uts_expiry_date,
          CAST(julianday(date(p.uts_expiry_date)) - julianday(date('now')) AS INTEGER) as remaining_days,
          p.stock_quantity,
          p.shelf_location
        FROM products p
        ${baseJoins}
        WHERE p.uts_expiry_date IS NOT NULL AND p.uts_expiry_date != ''
          AND p.status = 'Aktif'
      `;
      const params: unknown[] = [];
      sql = this.appendStockProductFilters(sql, params, { ...filters, status: 'Aktif' }, { includeDateRange: true });
      if (filters.expiry_days_max == null) {
        sql += ` AND date(p.uts_expiry_date) <= date('now', '+90 days')`;
      }
      sql += ` ORDER BY date(p.uts_expiry_date), p.name LIMIT 1000`;
      const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
      return {
        reportType,
        dateRange: range,
        rows,
        summary: {
          rowCount: rows.length,
          totalQuantity: rows.reduce((sum, row) => sum + Number(row.stock_quantity || 0), 0),
        },
      };
    }

    if (reportType === 'opticalValues') {
      let sql = `
        SELECT
          p.name,
          p.sph,
          p.cyl,
          p.axis,
          p.addition,
          p.diameter,
          p.base_curve,
          COALESCE(lt.name, clt.name, p.category) as lens_type_name,
          lm.name as lens_material_name,
          lc.name as lens_coating_name,
          p.stock_quantity,
          p.shelf_location,
          p.purchase_price,
          p.sale_price
        FROM products p
        ${baseJoins}
        WHERE p.status = 'Aktif'
      `;
      const params: unknown[] = [];
      sql = this.appendStockProductFilters(sql, params, { ...filters, status: 'Aktif' });
      sql += ` ORDER BY p.name LIMIT 2000`;
      const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
      return {
        reportType,
        dateRange: range,
        rows,
        summary: this.summarizeStockRows(rows),
      };
    }

    let sql = `
      SELECT
        p.*, pb.barcode,
        g.name as group_name,
        sg.name as subgroup_name,
        COALESCE(b.name, p.brand) as brand_name,
        COALESCE(m.name, p.model) as model_name,
        c.name as color_name,
        COALESCE(lt.name, clt.name, p.category) as lens_type_name,
        lm.name as lens_material_name,
        lc.name as lens_coating_name,
        (p.stock_quantity * p.sale_price) as stock_sale_value,
        (p.stock_quantity * p.purchase_price) as stock_purchase_value
      FROM products p
      ${baseJoins}
      WHERE 1=1
    `;
    const params: unknown[] = [];
    sql = this.appendStockProductFilters(
      sql,
      params,
      reportType === 'critical' ? { ...filters, critical_only: true, status: 'Aktif' } : filters
    );
    sql += ` ORDER BY p.name LIMIT 2000`;
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    return {
      reportType,
      dateRange: range,
      summary: this.summarizeStockRows(rows),
      rows,
    };
  }

  getCustomerAccountReport(filters: CustomerAccountReportFilter = {}): Record<string, unknown> {
    const range = filters.date_from && filters.date_to ? resolveRange(filters) : defaultRange30();

    let sql = `
      SELECT c.id, c.full_name, c.phone, c.tc_no, c.balance,
             COALESCE(SUM(CASE WHEN s.status != 'İptal edildi' THEN s.net_amount ELSE 0 END), 0) as total_sales,
             COALESCE((
               SELECT SUM(cam.credit_amount) FROM customer_account_movements cam
               WHERE cam.customer_id = c.id
               AND date(cam.created_at) >= date(?) AND date(cam.created_at) <= date(?)
             ), 0) as total_paid,
             MAX(COALESCE(s.sale_date, c.updated_at)) as last_transaction
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
        AND date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
      WHERE (c.is_active = 1 OR c.is_active IS NULL)
    `;
    const params: unknown[] = [range.date_from, range.date_to, range.date_from, range.date_to];

    if (filters.customer_search?.trim()) {
      sql += ` AND (c.full_name LIKE ? OR c.phone LIKE ? OR c.tc_no LIKE ?)`;
      const term = `%${filters.customer_search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` GROUP BY c.id`;

    const status = filters.balance_status || 'all';
    if (status === 'debt') sql += ` HAVING c.balance > 0`;
    else if (status === 'credit') sql += ` HAVING c.balance < 0`;
    else if (status === 'zero') sql += ` HAVING c.balance = 0`;

    sql += ` ORDER BY c.balance DESC, c.full_name LIMIT 1000`;

    const rows = this.db.prepare(sql).all(...params);

    return {
      dateRange: range,
      summary: {
        customerCount: rows.length,
        totalDebt: rows.reduce((s: number, r: Record<string, unknown>) => s + Math.max(0, Number(r.balance)), 0),
        totalCredit: rows.reduce((s: number, r: Record<string, unknown>) => s + Math.abs(Math.min(0, Number(r.balance))), 0),
      },
      rows,
    };
  }

  getPrescriptionMedulaReport(filters: PrescriptionMedulaReportFilter = {}): Record<string, unknown> {
    const range = resolveRange(filters);
    let sql = `
      SELECT pr.*, c.full_name as customer_name, c.tc_no as customer_tc,
             s.sale_no, s.id as sale_id
      FROM prescriptions pr
      LEFT JOIN customers c ON c.id = pr.customer_id
      LEFT JOIN sales s ON s.prescription_id = pr.id AND s.status != 'İptal edildi'
      WHERE date(pr.prescription_date) >= date(?) AND date(pr.prescription_date) <= date(?)
    `;
    const params: unknown[] = [range.date_from, range.date_to];

    if (filters.prescription_type) {
      sql += ` AND pr.prescription_type = ?`;
      params.push(filters.prescription_type);
    }
    if (filters.medula_status) {
      sql += ` AND pr.medula_status = ?`;
      params.push(filters.medula_status);
    }
    if (filters.customer_search?.trim()) {
      sql += ` AND (c.full_name LIKE ? OR c.tc_no LIKE ?)`;
      const term = `%${filters.customer_search.trim()}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY pr.prescription_date DESC LIMIT 1000`;
    const rawRows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    const rows = rawRows.map((r) => {
      let missingCount = 0;
      if (r.sale_id) {
        const v = this.medulaService.validateRecord(r.sale_id as number);
        missingCount = v.errors.length + v.warnings.length;
      }
      return { ...r, missing_count: missingCount };
    }).filter((r) => {
      if (filters.has_missing_fields === true) return (r.missing_count as number) > 0;
      if (filters.has_missing_fields === false) return (r.missing_count as number) === 0;
      return true;
    });

    const countBy = (field: string, val: string) =>
      rows.filter((r) => r[field] === val).length;

    return {
      dateRange: range,
      summary: {
        total: rows.length,
        sgkCount: countBy('prescription_type', 'SGK'),
        privateCount: countBy('prescription_type', 'Özel'),
        pending: rows.filter((r) => ['Hazırlanmadı', 'Hazır'].includes(String(r.medula_status))).length,
        exported: countBy('medula_status', 'Dışa Aktarıldı'),
        uploaded: countBy('medula_status', 'Manuel Yüklendi'),
        error: countBy('medula_status', 'Hatalı'),
      },
      rows,
    };
  }

  getReturnCancelReport(filters: ReturnCancelReportFilter = {}): Record<string, unknown> {
    const range = resolveRange(filters);
    const rows: Record<string, unknown>[] = [];

    if (!filters.operation_type || filters.operation_type === 'İade') {
      let sql = `
        SELECT r.created_at as event_date, 'İade' as operation_type, s.sale_no,
               c.full_name as customer_name, p.name as product_name,
               ri.quantity, ri.total_amount as amount, r.reason, r.notes
        FROM returns r
        LEFT JOIN return_items ri ON ri.return_id = r.id
        LEFT JOIN products p ON p.id = ri.product_id
        LEFT JOIN sales s ON s.id = r.sale_id
        LEFT JOIN customers c ON c.id = r.customer_id
        WHERE date(r.created_at) >= date(?) AND date(r.created_at) <= date(?)
      `;
      const params: unknown[] = [range.date_from, range.date_to];
      if (filters.customer_search?.trim()) {
        sql += ` AND c.full_name LIKE ?`;
        params.push(`%${filters.customer_search.trim()}%`);
      }
      if (filters.product_search?.trim()) {
        sql += ` AND p.name LIKE ?`;
        params.push(`%${filters.product_search.trim()}%`);
      }
      if (filters.reason?.trim()) {
        sql += ` AND r.reason LIKE ?`;
        params.push(`%${filters.reason.trim()}%`);
      }
      sql += ` ORDER BY r.created_at DESC LIMIT 1000`;
      rows.push(...(this.db.prepare(sql).all(...params) as Record<string, unknown>[]));
    }

    if (!filters.operation_type || filters.operation_type === 'İptal') {
      let sql = `
        SELECT s.cancelled_at as event_date, 'İptal' as operation_type, s.sale_no,
               c.full_name as customer_name, '' as product_name,
               0 as quantity, s.net_amount as amount, s.cancel_reason as reason, s.cancel_note as notes
        FROM sales s
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.status = 'İptal edildi'
        AND date(s.cancelled_at) >= date(?) AND date(s.cancelled_at) <= date(?)
      `;
      const params: unknown[] = [range.date_from, range.date_to];
      if (filters.customer_search?.trim()) {
        sql += ` AND c.full_name LIKE ?`;
        params.push(`%${filters.customer_search.trim()}%`);
      }
      if (filters.reason?.trim()) {
        sql += ` AND s.cancel_reason LIKE ?`;
        params.push(`%${filters.reason.trim()}%`);
      }
      sql += ` ORDER BY s.cancelled_at DESC LIMIT 500`;
      rows.push(...(this.db.prepare(sql).all(...params) as Record<string, unknown>[]));
    }

    rows.sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)));

    const returnRows = rows.filter((r) => r.operation_type === 'İade');
    const cancelRows = rows.filter((r) => r.operation_type === 'İptal');

    return {
      dateRange: range,
      summary: {
        returnTotal: returnRows.reduce((s, r) => s + Number(r.amount || 0), 0),
        returnCount: returnRows.length,
        cancelCount: cancelRows.length,
        cancelTotal: cancelRows.reduce((s, r) => s + Number(r.amount || 0), 0),
      },
      rows: rows.slice(0, 2000),
    };
  }

  getPurchaseReport(filters: import('../types/report').PurchaseReportFilter = {}): Record<string, unknown> {
    const range = filters.date_from && filters.date_to ? resolveRange(filters) : defaultRange30();
    let sql = `
      SELECT pd.*, s.name as supplier_name
      FROM purchase_documents pd
      INNER JOIN suppliers s ON s.id = pd.supplier_id
      WHERE pd.status != 'İptal'
      AND date(pd.document_date) >= date(?) AND date(pd.document_date) <= date(?)
    `;
    const params: unknown[] = [range.date_from, range.date_to];
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
    sql += ` ORDER BY pd.document_date DESC LIMIT 2000`;
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    const summary = {
      totalAmount: rows.reduce((s, r) => s + Number(r.total_amount || 0), 0),
      totalVat: rows.reduce((s, r) => s + Number(r.vat_amount || 0), 0),
      totalQty: rows.reduce((s, r) => s + Number(r.total_quantity || 0), 0),
      totalPaid: rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0),
      totalRemaining: rows.reduce((s, r) => s + Number(r.remaining_amount || 0), 0),
      rowCount: rows.length,
    };
    return { reportType: 'purchase', dateRange: range, rows, summary };
  }

  getSupplierAccountReport(filters: import('../types/report').SupplierAccountReportFilter = {}): Record<string, unknown> {
    let sql = `
      SELECT s.id, s.name, s.phone, s.tax_no, s.balance,
        COALESCE((SELECT SUM(debit_amount) FROM supplier_account_movements WHERE supplier_id = s.id), 0) as total_purchases,
        COALESCE((SELECT SUM(credit_amount) FROM supplier_account_movements WHERE supplier_id = s.id), 0) as total_payments,
        (SELECT MAX(created_at) FROM supplier_account_movements WHERE supplier_id = s.id) as last_transaction_at
      FROM suppliers s
      WHERE s.is_active = 1
    `;
    const params: unknown[] = [];
    if (filters.supplier_id) {
      sql += ` AND s.id = ?`;
      params.push(filters.supplier_id);
    }
    if (filters.search?.trim()) {
      sql += ` AND s.name LIKE ?`;
      params.push(`%${filters.search.trim()}%`);
    }
    sql += ` ORDER BY s.balance DESC, s.name`;
    const rows = this.db.prepare(sql).all(...params);
    return {
      reportType: 'supplierAccount',
      rows,
      summary: {
        supplierCount: rows.length,
        totalBalance: rows.reduce((s, r) => s + Number((r as Record<string, unknown>).balance || 0), 0),
      },
    };
  }

  exportExcel(filePath: string, rows: Record<string, unknown>[], sheetName = 'Rapor'): void {
    if (!rows.length) {
      throw new ReportValidationError('Dışa aktarılacak veri yok.');
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filePath);
  }

  buildPrintHtml(payload: PrintReportPayload): { html: string; title: string } {
    const company = this.getCompanyName();
    const now = new Date().toLocaleString('tr-TR');

    const summaryHtml = payload.summary
      .map((s) => `<div class="summary-item"><span>${s.label}</span><strong>${s.value}</strong></div>`)
      .join('');

    const headerHtml = payload.columns.map((c) => `<th>${c}</th>`).join('');
    const bodyHtml = payload.rows
      .slice(0, 500)
      .map((row) => {
        const cells = payload.columns
          .map((col) => {
            const val = row[col] ?? row[this.columnKeyFromLabel(col)] ?? '';
            return `<td>${val}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${payload.title}</title>
      <style>
        body { font-family: Segoe UI, Arial, sans-serif; font-size: 11px; padding: 16px; }
        h1 { font-size: 16px; margin: 0 0 4px; }
        .meta { color: #666; margin-bottom: 12px; font-size: 10px; }
        .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .summary-item { border: 1px solid #ddd; padding: 4px 8px; min-width: 120px; }
        .summary-item span { display: block; font-size: 9px; color: #666; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 3px 6px; text-align: left; }
        th { background: #f5f5f5; font-size: 10px; }
        .footer { margin-top: 12px; font-size: 9px; color: #888; }
      </style></head><body>
      <h1>${company}</h1>
      <h2 style="font-size:14px;margin:4px 0">${payload.title}</h2>
      <div class="meta">${payload.dateRange || ''}</div>
      <div class="summary">${summaryHtml}</div>
      <table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
      <div class="footer">Oluşturulma: ${now}</div>
      </body></html>`;

    return { html, title: payload.title };
  }

  private columnKeyFromLabel(label: string): string {
    return label;
  }

  formatMoney(amount: number): string {
    return formatCurrency(amount);
  }
}
