import type Database from 'better-sqlite3';
import type { ProfitLossFilter } from '../types/finance';

function defaultRange(): { date_from: string; date_to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) };
}

export class ProfitLossService {
  constructor(private db: Database.Database) {}

  getSummary(filter: ProfitLossFilter = {}): Record<string, unknown> {
    const range = {
      date_from: filter.date_from || defaultRange().date_from,
      date_to: filter.date_to || defaultRange().date_to,
    };

    const salesTotal = this.db
      .prepare(
        `SELECT COALESCE(SUM(net_amount), 0) as total FROM sales
         WHERE date(sale_date) >= date(?) AND date(sale_date) <= date(?)
         AND status != 'İptal edildi'`
      )
      .get(range.date_from, range.date_to) as { total: number };

    const returnsTotal = this.db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM returns
         WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
         AND status = 'Tamamlandı'`
      )
      .get(range.date_from, range.date_to) as { total: number };

    const expenseTotal = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
         WHERE date(expense_date) >= date(?) AND date(expense_date) <= date(?)
         AND status = 'Aktif'`
      )
      .get(range.date_from, range.date_to) as { total: number };

    const campaignDiscountTotal = this.db
      .prepare(
        `SELECT COALESCE(SUM(campaign_discount_amount), 0) as total FROM sales
         WHERE date(sale_date) >= date(?) AND date(sale_date) <= date(?)
         AND status != 'İptal edildi'`
      )
      .get(range.date_from, range.date_to) as { total: number };

    const manualDiscountTotal = this.db
      .prepare(
        `SELECT COALESCE(SUM(manual_discount_amount), 0) as total FROM sales
         WHERE date(sale_date) >= date(?) AND date(sale_date) <= date(?)
         AND status != 'İptal edildi'`
      )
      .get(range.date_from, range.date_to) as { total: number };

    const collected = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
         WHERE date(movement_date) >= date(?) AND date(movement_date) <= date(?)
         AND amount > 0`
      )
      .get(range.date_from, range.date_to) as { total: number };

    const openAccount = this.db
      .prepare(
        `SELECT COALESCE(SUM(remaining_amount), 0) as total FROM sales
         WHERE remaining_amount > 0 AND status != 'İptal edildi'`
      )
      .get() as { total: number };

    let costSql = `
      SELECT si.quantity, si.total_price, p.purchase_price, p.last_purchase_price, p.average_cost
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      INNER JOIN products p ON p.id = si.product_id
      WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
      AND s.status != 'İptal edildi'
    `;
    const costParams: unknown[] = [range.date_from, range.date_to];
    if (filter.group_id) {
      costSql += ` AND p.group_id = ?`;
      costParams.push(filter.group_id);
    }
    if (filter.brand_id) {
      costSql += ` AND p.brand_id = ?`;
      costParams.push(filter.brand_id);
    }

    const costRows = this.db.prepare(costSql).all(...costParams) as Array<Record<string, unknown>>;
    let costTotal = 0;
    let missingCostCount = 0;
    for (const row of costRows) {
      const qty = Number(row.quantity || 0);
      const unitCost =
        Number(row.average_cost) ||
        Number(row.last_purchase_price) ||
        Number(row.purchase_price) ||
        0;
      if (!unitCost) missingCostCount += 1;
      costTotal += qty * unitCost;
    }

    const revenue = Number(salesTotal.total);
    const grossProfit = revenue - costTotal;
    const netProfit = grossProfit - Number(expenseTotal.total) - Number(returnsTotal.total);
    const profitRate = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      dateRange: range,
      totalSales: revenue,
      costOfGoods: costTotal,
      grossProfit,
      returnTotal: Number(returnsTotal.total),
      expenseTotal: Number(expenseTotal.total),
      campaignDiscountTotal: Number(campaignDiscountTotal.total),
      manualDiscountTotal: Number(manualDiscountTotal.total),
      netProfit,
      profitRate,
      collectedTotal: Number(collected.total),
      openAccountTotal: Number(openAccount.total),
      missingCostCount,
      costWarning:
        missingCostCount > 0
          ? 'Bazı ürünlerde alış maliyeti eksik olduğu için kâr hesabı yaklaşık olabilir.'
          : null,
    };
  }

  getDetail(filter: ProfitLossFilter = {}): Record<string, unknown> {
    const range = {
      date_from: filter.date_from || defaultRange().date_from,
      date_to: filter.date_to || defaultRange().date_to,
    };

    const daily = this.db
      .prepare(
        `SELECT date(s.sale_date) as period,
                COALESCE(SUM(s.net_amount), 0) as sales_total,
                COUNT(*) as sale_count
         FROM sales s
         WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
         AND s.status != 'İptal edildi'
         GROUP BY date(s.sale_date)
         ORDER BY period`
      )
      .all(range.date_from, range.date_to);

    const byGroup = this.db
      .prepare(
        `SELECT COALESCE(g.name, p.product_type) as group_name,
                COALESCE(SUM(si.total_price), 0) as sales_total,
                COALESCE(SUM(si.quantity * COALESCE(p.average_cost, p.last_purchase_price, p.purchase_price, 0)), 0) as cost_total
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id
         INNER JOIN products p ON p.id = si.product_id
         LEFT JOIN optical_lookup_values g ON g.id = p.group_id
         WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
         AND s.status != 'İptal edildi'
         GROUP BY p.group_id, p.product_type
         ORDER BY sales_total DESC`
      )
      .all(range.date_from, range.date_to) as Array<Record<string, unknown>>;

    const byBrand = this.db
      .prepare(
        `SELECT COALESCE(b.name, p.brand, '-') as brand_name,
                COALESCE(SUM(si.total_price), 0) as sales_total,
                COALESCE(SUM(si.quantity * COALESCE(p.average_cost, p.last_purchase_price, p.purchase_price, 0)), 0) as cost_total
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id
         INNER JOIN products p ON p.id = si.product_id
         LEFT JOIN optical_lookup_values b ON b.id = p.brand_id
         WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
         AND s.status != 'İptal edildi'
         GROUP BY p.brand_id, p.brand
         ORDER BY sales_total DESC
         LIMIT 50`
      )
      .all(range.date_from, range.date_to);

    const topProducts = this.db
      .prepare(
        `SELECT p.name as product_name,
                COALESCE(SUM(si.quantity), 0) as qty,
                COALESCE(SUM(si.total_price), 0) as sales_total,
                COALESCE(SUM(si.quantity * COALESCE(p.average_cost, p.last_purchase_price, p.purchase_price, 0)), 0) as cost_total
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id
         INNER JOIN products p ON p.id = si.product_id
         WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
         AND s.status != 'İptal edildi'
         GROUP BY p.id
         ORDER BY (sales_total - cost_total) DESC
         LIMIT 20`
      )
      .all(range.date_from, range.date_to);

    const lossProducts = this.db
      .prepare(
        `SELECT p.name as product_name,
                COALESCE(SUM(si.total_price), 0) as sales_total,
                COALESCE(SUM(si.quantity * COALESCE(p.average_cost, p.last_purchase_price, p.purchase_price, 0)), 0) as cost_total
         FROM sale_items si
         INNER JOIN sales s ON s.id = si.sale_id
         INNER JOIN products p ON p.id = si.product_id
         WHERE date(s.sale_date) >= date(?) AND date(s.sale_date) <= date(?)
         AND s.status != 'İptal edildi'
         GROUP BY p.id
         HAVING sales_total < cost_total
         ORDER BY (sales_total - cost_total) ASC
         LIMIT 20`
      )
      .all(range.date_from, range.date_to);

    return {
      dateRange: range,
      daily,
      byGroup: byGroup.map((r) => ({
        ...r,
        profit: Number(r.sales_total) - Number(r.cost_total),
      })),
      byBrand,
      topProducts,
      lossProducts,
    };
  }
}
