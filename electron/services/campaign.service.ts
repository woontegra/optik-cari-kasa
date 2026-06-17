import type Database from 'better-sqlite3';
import type {
  CalculateSaleInput,
  CalculateSaleResult,
  CalculatedSaleLine,
  CampaignInput,
  CampaignReportFilter,
  CampaignTargetInput,
} from '../types/campaign';

export class CampaignValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignValidationError';
  }
}

interface ProductRow {
  id: number;
  sale_price: number;
  group_id: number | null;
  subgroup_id: number | null;
  brand_id: number | null;
  model_id: number | null;
}

interface CampaignRow {
  id: number;
  name: string;
  code: string | null;
  campaign_type: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  min_sale_amount: number | null;
  min_quantity: number | null;
  priority: number;
  usage_limit: number | null;
  per_customer_limit: number | null;
  status: string;
  start_date: string;
  end_date: string;
}

const TYPE_MAP: Record<string, string> = {
  'Ürün bazlı': 'PRODUCT',
  'Ana grup bazlı': 'PRODUCT_GROUP',
  'Alt grup bazlı': 'PRODUCT_SUBGROUP',
  'Marka bazlı': 'BRAND',
  'Model bazlı': 'MODEL',
  'Sepet toplamı bazlı': 'CART_TOTAL',
  'Müşteri kategorisi bazlı': 'CUSTOMER_CATEGORY',
  'Manuel indirim kuponu': 'COUPON',
};

export class CampaignService {
  constructor(private db: Database.Database) {}

  list(filters: { status?: string; activeOnly?: boolean } = {}): Record<string, unknown>[] {
    let sql = `
      SELECT c.*,
        (SELECT COUNT(*) FROM campaign_usages cu WHERE cu.campaign_id = c.id AND cu.status = 'Aktif') as usage_count,
        (SELECT COALESCE(SUM(cu.discount_amount), 0) FROM campaign_usages cu WHERE cu.campaign_id = c.id AND cu.status = 'Aktif') as total_discount
      FROM campaigns c WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters.status) {
      sql += ` AND c.status = ?`;
      params.push(filters.status);
    }
    if (filters.activeOnly) {
      sql += ` AND c.status = 'Aktif' AND date(c.start_date) <= date('now', 'localtime') AND date(c.end_date) >= date('now', 'localtime')`;
    }
    sql += ` ORDER BY c.priority ASC, c.start_date DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  listActive(): Record<string, unknown>[] {
    return this.list({ activeOnly: true });
  }

  getById(id: number): Record<string, unknown> | null {
    const row = this.db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    const targets = this.db
      .prepare(`SELECT * FROM campaign_targets WHERE campaign_id = ?`)
      .all(id) as Record<string, unknown>[];
    return { ...row, targets };
  }

  create(input: CampaignInput, userId: number): { id: number } {
    this.validateInput(input);
    const run = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO campaigns (
            name, code, description, campaign_type, discount_type, discount_value,
            max_discount_amount, min_sale_amount, min_quantity, start_date, end_date,
            priority, usage_limit, per_customer_limit, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.name.trim(),
          input.code?.trim() || null,
          input.description?.trim() || null,
          input.campaign_type,
          input.discount_type,
          input.discount_value,
          input.max_discount_amount ?? null,
          input.min_sale_amount ?? null,
          input.min_quantity ?? null,
          input.start_date,
          input.end_date,
          input.priority ?? 100,
          input.usage_limit ?? null,
          input.per_customer_limit ?? null,
          input.status || 'Taslak',
          userId
        );
      const id = Number(result.lastInsertRowid);
      this.saveTargets(id, input.targets || []);
      return { id };
    });
    return run();
  }

  update(id: number, input: Partial<CampaignInput>): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new CampaignValidationError('Kampanya bulunamadı.');
    const merged = { ...existing, ...input } as CampaignInput;
    this.validateInput(merged, id);
    const run = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE campaigns SET
            name = ?, code = ?, description = ?, campaign_type = ?, discount_type = ?,
            discount_value = ?, max_discount_amount = ?, min_sale_amount = ?, min_quantity = ?,
            start_date = ?, end_date = ?, priority = ?, usage_limit = ?, per_customer_limit = ?,
            status = ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?`
        )
        .run(
          merged.name.trim(),
          merged.code?.trim() || null,
          merged.description?.trim() || null,
          merged.campaign_type,
          merged.discount_type,
          merged.discount_value,
          merged.max_discount_amount ?? null,
          merged.min_sale_amount ?? null,
          merged.min_quantity ?? null,
          merged.start_date,
          merged.end_date,
          merged.priority ?? 100,
          merged.usage_limit ?? null,
          merged.per_customer_limit ?? null,
          merged.status || 'Taslak',
          id
        );
      if (input.targets) {
        this.db.prepare(`DELETE FROM campaign_targets WHERE campaign_id = ?`).run(id);
        this.saveTargets(id, input.targets);
      }
      return { id };
    });
    return run();
  }

  activate(id: number): { id: number } {
    const c = this.getById(id);
    if (!c) throw new CampaignValidationError('Kampanya bulunamadı.');
    const targets = (c.targets as Record<string, unknown>[]) || [];
    const type = String(c.campaign_type);
    if (!['Sepet toplamı bazlı', 'Manuel indirim kuponu'].includes(type) && targets.length === 0) {
      throw new CampaignValidationError('Kapsam seçilmeden kampanya aktif edilemez.');
    }
    this.db
      .prepare(`UPDATE campaigns SET status = 'Aktif', updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(id);
    return { id };
  }

  deactivate(id: number): { id: number } {
    this.db
      .prepare(`UPDATE campaigns SET status = 'Pasif', updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(id);
    return { id };
  }

  validateCode(
    code: string,
    input: CalculateSaleInput
  ): { valid: boolean; message?: string; campaign?: Record<string, unknown> } {
    const trimmed = code.trim();
    if (!trimmed) return { valid: false, message: 'Kampanya kodu girin.' };

    const campaign = this.db
      .prepare(`SELECT * FROM campaigns WHERE UPPER(code) = UPPER(?)`)
      .get(trimmed) as CampaignRow | undefined;

    if (!campaign) return { valid: false, message: 'Geçersiz kampanya kodu.' };
    if (campaign.status !== 'Aktif') return { valid: false, message: 'Kampanya aktif değil.' };

    const today = new Date().toISOString().slice(0, 10);
    if (campaign.start_date > today) return { valid: false, message: 'Kampanya henüz başlamadı.' };
    if (campaign.end_date < today) return { valid: false, message: 'Kampanya süresi dolmuş.' };

    const limitErr = this.checkUsageLimits(campaign, input.customerId ?? null);
    if (limitErr) return { valid: false, message: limitErr };

    const preview = this.calculateForSale({ ...input, campaignCode: trimmed });
    if (preview.campaignDiscountTotal <= 0 && preview.netTotal >= preview.subtotal) {
      const min = Number(campaign.min_sale_amount || 0);
      if (min > 0 && preview.subtotal < min) {
        return { valid: false, message: `Minimum sepet tutarı ${min.toFixed(2)} ₺ olmalıdır.` };
      }
      return { valid: false, message: 'Kampanya şartları sağlanmıyor.' };
    }

    return { valid: true, campaign: campaign as unknown as Record<string, unknown> };
  }

  calculateForSale(input: CalculateSaleInput): CalculateSaleResult {
    const warnings: string[] = [];
    const activeCampaigns = this.getRunnableCampaigns(input.campaignCode);
    const customerCategory = input.customerId
      ? ((this.db.prepare(`SELECT customer_category FROM customers WHERE id = ?`).get(input.customerId) as
          | { customer_category: string | null }
          | undefined)?.customer_category ?? null)
      : null;

    const lines: CalculatedSaleLine[] = [];
    let subtotal = 0;
    let campaignDiscountTotal = 0;
    const appliedCampaignIds = new Set<number>();

    for (const item of input.items) {
      const product = this.db
        .prepare(
          `SELECT id, sale_price, group_id, subgroup_id, brand_id, model_id FROM products WHERE id = ?`
        )
        .get(item.productId) as ProductRow | undefined;
      if (!product) continue;

      const listPrice = item.unitPrice ?? Number(product.sale_price);
      const lineSubtotal = listPrice * item.quantity;
      subtotal += lineSubtotal;

      const match = this.findBestLineCampaign(
        activeCampaigns,
        product,
        item.quantity,
        listPrice,
        customerCategory,
        input.customerId ?? null
      );

      let discountAmount = 0;
      let finalUnit = listPrice;
      if (match) {
        discountAmount = this.calcLineDiscount(match.campaign, listPrice, item.quantity);
        finalUnit = Math.max(0, listPrice - discountAmount / item.quantity);
        campaignDiscountTotal += discountAmount;
        appliedCampaignIds.add(match.campaign.id);
      }

      lines.push({
        productId: item.productId,
        quantity: item.quantity,
        originalUnitPrice: listPrice,
        unitPrice: finalUnit,
        discountAmount,
        lineTotal: finalUnit * item.quantity,
        campaignId: match?.campaign.id ?? null,
        campaignName: match?.campaign.name ?? null,
      });
    }

    let afterLineDiscount = subtotal - campaignDiscountTotal;

    const cartCampaign = this.findCartCampaign(
      activeCampaigns.filter((c) => c.campaign_type === 'Sepet toplamı bazlı'),
      afterLineDiscount,
      input.customerId ?? null
    );
    if (cartCampaign) {
      const cartDiscount = this.calcCartDiscount(cartCampaign, afterLineDiscount);
      if (cartDiscount > 0) {
        campaignDiscountTotal += cartDiscount;
        afterLineDiscount -= cartDiscount;
        appliedCampaignIds.add(cartCampaign.id);
      }
    }

    let manualDiscountAmount = 0;
    if (input.manualDiscount && input.manualDiscount.value > 0) {
      if (input.manualDiscount.type === 'percent') {
        manualDiscountAmount = (afterLineDiscount * input.manualDiscount.value) / 100;
      } else {
        manualDiscountAmount = input.manualDiscount.value;
      }
      manualDiscountAmount = Math.min(manualDiscountAmount, afterLineDiscount);
      manualDiscountAmount = Math.max(0, manualDiscountAmount);
    }

    const netTotal = Math.max(0, afterLineDiscount - manualDiscountAmount);

    return {
      items: lines,
      subtotal,
      campaignDiscountTotal,
      manualDiscountAmount,
      netTotal,
      appliedCampaignIds: [...appliedCampaignIds],
      warnings,
    };
  }

  recordSaleDiscounts(
    saleId: number,
    saleItemIds: number[],
    calc: CalculateSaleResult,
    manualNote?: string
  ): void {
    const insertDiscount = this.db.prepare(
      `INSERT INTO sale_discounts (sale_id, sale_item_id, campaign_id, discount_type, discount_value, discount_amount, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertUsage = this.db.prepare(
      `INSERT INTO campaign_usages (campaign_id, sale_id, customer_id, discount_amount, status)
       VALUES (?, ?, ?, ?, 'Aktif')`
    );

    const customerId = (
      this.db.prepare(`SELECT customer_id FROM sales WHERE id = ?`).get(saleId) as { customer_id: number | null }
    )?.customer_id;

    const usageByCampaign = new Map<number, number>();

    calc.items.forEach((line, idx) => {
      if (line.discountAmount > 0 && line.campaignId) {
        insertDiscount.run(
          saleId,
          saleItemIds[idx] ?? null,
          line.campaignId,
          'campaign',
          line.discountAmount,
          line.discountAmount,
          line.campaignName
        );
        usageByCampaign.set(
          line.campaignId,
          (usageByCampaign.get(line.campaignId) || 0) + line.discountAmount
        );
      }
    });

    if (calc.manualDiscountAmount > 0) {
      insertDiscount.run(
        saleId,
        null,
        null,
        'manual',
        calc.manualDiscountAmount,
        calc.manualDiscountAmount,
        manualNote || 'Manuel indirim'
      );
    }

    for (const [campaignId, amount] of usageByCampaign) {
      insertUsage.run(campaignId, saleId, customerId, amount);
    }
  }

  cancelSaleUsages(saleId: number): void {
    this.db
      .prepare(`UPDATE campaign_usages SET status = 'İptal' WHERE sale_id = ?`)
      .run(saleId);
  }

  getReport(filter: CampaignReportFilter = {}): Record<string, unknown> {
    const range = {
      date_from: filter.date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      date_to: filter.date_to || new Date().toISOString().slice(0, 10),
    };

    let usageSql = `
      SELECT cu.campaign_id, c.name as campaign_name,
             COUNT(DISTINCT cu.sale_id) as usage_count,
             COALESCE(SUM(cu.discount_amount), 0) as discount_total,
             COALESCE(SUM(s.net_amount), 0) as sales_total
      FROM campaign_usages cu
      INNER JOIN campaigns c ON c.id = cu.campaign_id
      INNER JOIN sales s ON s.id = cu.sale_id AND s.status != 'İptal edildi'
      WHERE cu.status = 'Aktif'
      AND date(cu.used_at) >= date(?) AND date(cu.used_at) <= date(?)
    `;
    const params: unknown[] = [range.date_from, range.date_to];
    if (filter.campaign_id) {
      usageSql += ` AND cu.campaign_id = ?`;
      params.push(filter.campaign_id);
    }
    if (filter.customer_id) {
      usageSql += ` AND cu.customer_id = ?`;
      params.push(filter.customer_id);
    }
    usageSql += ` GROUP BY cu.campaign_id ORDER BY usage_count DESC`;

    const rows = this.db.prepare(usageSql).all(...params) as Array<Record<string, unknown>>;

    const summary = {
      campaignSaleCount: rows.reduce((s, r) => s + Number(r.usage_count), 0),
      totalSales: rows.reduce((s, r) => s + Number(r.sales_total), 0),
      totalDiscount: rows.reduce((s, r) => s + Number(r.discount_total), 0),
      avgDiscount: 0,
      topCampaign: rows[0]?.campaign_name || '-',
    };
    summary.avgDiscount =
      summary.campaignSaleCount > 0 ? summary.totalDiscount / summary.campaignSaleCount : 0;

    const table = rows.map((r) => ({
      campaign_name: r.campaign_name,
      usage_count: r.usage_count,
      sales_total: r.sales_total,
      discount_total: r.discount_total,
      avg_basket:
        Number(r.usage_count) > 0 ? Number(r.sales_total) / Number(r.usage_count) : 0,
    }));

    return { dateRange: range, summary, rows: table };
  }

  listCampaignSales(filter: CampaignReportFilter = {}): Record<string, unknown>[] {
    let sql = `
      SELECT s.id, s.sale_no, s.sale_date, s.net_amount, s.campaign_discount_amount,
             c.full_name as customer_name,
             GROUP_CONCAT(DISTINCT camp.name) as campaigns
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN campaign_usages cu ON cu.sale_id = s.id AND cu.status = 'Aktif'
      LEFT JOIN campaigns camp ON camp.id = cu.campaign_id
      WHERE s.status != 'İptal edildi' AND COALESCE(s.campaign_discount_amount, 0) > 0
    `;
    const params: unknown[] = [];
    if (filter.date_from) {
      sql += ` AND date(s.sale_date) >= date(?)`;
      params.push(filter.date_from);
    }
    if (filter.date_to) {
      sql += ` AND date(s.sale_date) <= date(?)`;
      params.push(filter.date_to);
    }
    if (filter.campaign_id) {
      sql += ` AND cu.campaign_id = ?`;
      params.push(filter.campaign_id);
    }
    sql += ` GROUP BY s.id ORDER BY s.sale_date DESC LIMIT 200`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  private saveTargets(campaignId: number, targets: CampaignTargetInput[]): void {
    const insert = this.db.prepare(
      `INSERT INTO campaign_targets (campaign_id, target_type, target_id, target_value) VALUES (?, ?, ?, ?)`
    );
    for (const t of targets) {
      insert.run(campaignId, t.target_type, t.target_id ?? null, t.target_value ?? null);
    }
  }

  private validateInput(input: CampaignInput, id?: number): void {
    if (!input.name?.trim()) throw new CampaignValidationError('Kampanya adı zorunludur.');
    if (!input.start_date || !input.end_date) throw new CampaignValidationError('Tarih aralığı zorunludur.');
    if (input.end_date < input.start_date) throw new CampaignValidationError('Bitiş tarihi başlangıçtan önce olamaz.');
    if (input.discount_value < 0) throw new CampaignValidationError('İndirim değeri geçersiz.');

    const needsTargets = !['Sepet toplamı bazlı', 'Manuel indirim kuponu'].includes(input.campaign_type);
    if (needsTargets && (!input.targets || input.targets.length === 0)) {
      throw new CampaignValidationError('Kampanya kapsamı seçilmelidir.');
    }

    if (input.code?.trim()) {
      const dup = this.db
        .prepare(`SELECT id FROM campaigns WHERE UPPER(code) = UPPER(?) AND id != ?`)
        .get(input.code.trim(), id ?? 0) as { id: number } | undefined;
      if (dup) throw new CampaignValidationError('Bu kampanya kodu zaten kullanılıyor.');
    }
  }

  private getRunnableCampaigns(code?: string | null): CampaignRow[] {
    const today = new Date().toISOString().slice(0, 10);
    let rows = this.db
      .prepare(
        `SELECT * FROM campaigns
         WHERE status = 'Aktif'
         AND date(start_date) <= date(?)
         AND date(end_date) >= date(?)
         ORDER BY priority ASC, id ASC`
      )
      .all(today, today) as CampaignRow[];

    if (code?.trim()) {
      const coupon = rows.filter(
        (c) => c.campaign_type === 'Manuel indirim kuponu' && c.code?.toUpperCase() === code.trim().toUpperCase()
      );
      if (coupon.length) return coupon;
    }

    return rows.filter((c) => c.campaign_type !== 'Manuel indirim kuponu');
  }

  private checkUsageLimits(campaign: CampaignRow, customerId: number | null): string | null {
    if (campaign.usage_limit != null) {
      const used = this.db
        .prepare(`SELECT COUNT(*) as c FROM campaign_usages WHERE campaign_id = ? AND status = 'Aktif'`)
        .get(campaign.id) as { c: number };
      if (used.c >= campaign.usage_limit) return 'Kampanya kullanım limiti dolmuş.';
    }
    if (campaign.per_customer_limit != null && customerId) {
      const used = this.db
        .prepare(
          `SELECT COUNT(*) as c FROM campaign_usages WHERE campaign_id = ? AND customer_id = ? AND status = 'Aktif'`
        )
        .get(campaign.id, customerId) as { c: number };
      if (used.c >= campaign.per_customer_limit) return 'Müşteri kullanım limiti dolmuş.';
    }
    return null;
  }

  private getTargets(campaignId: number): CampaignTargetInput[] {
    return this.db
      .prepare(`SELECT target_type, target_id, target_value FROM campaign_targets WHERE campaign_id = ?`)
      .all(campaignId) as CampaignTargetInput[];
  }

  private matchesLine(
    campaign: CampaignRow,
    product: ProductRow,
    quantity: number,
    customerCategory: string | null
  ): boolean {
    const limitErr = this.checkUsageLimits(campaign, null);
    if (limitErr) return false;
    if (campaign.min_quantity && quantity < campaign.min_quantity) return false;

    const targets = this.getTargets(campaign.id);
    if (!targets.length && campaign.campaign_type !== 'Sepet toplamı bazlı') return false;

    switch (campaign.campaign_type) {
      case 'Ürün bazlı':
        return targets.some((t) => t.target_type === 'PRODUCT' && t.target_id === product.id);
      case 'Ana grup bazlı':
        return targets.some((t) => t.target_type === 'PRODUCT_GROUP' && t.target_id === product.group_id);
      case 'Alt grup bazlı':
        return targets.some((t) => t.target_type === 'PRODUCT_SUBGROUP' && t.target_id === product.subgroup_id);
      case 'Marka bazlı':
        return targets.some((t) => t.target_type === 'BRAND' && t.target_id === product.brand_id);
      case 'Model bazlı':
        return targets.some((t) => t.target_type === 'MODEL' && t.target_id === product.model_id);
      case 'Müşteri kategorisi bazlı':
        return (
          !!customerCategory &&
          targets.some(
            (t) =>
              t.target_type === 'CUSTOMER_CATEGORY' &&
              (t.target_value === customerCategory || t.target_id === null)
          )
        );
      default:
        return false;
    }
  }

  private findBestLineCampaign(
    campaigns: CampaignRow[],
    product: ProductRow,
    quantity: number,
    listPrice: number,
    customerCategory: string | null,
    customerId: number | null
  ): { campaign: CampaignRow; discount: number } | null {
    const lineTypes = [
      'Ürün bazlı',
      'Ana grup bazlı',
      'Alt grup bazlı',
      'Marka bazlı',
      'Model bazlı',
      'Müşteri kategorisi bazlı',
      'Manuel indirim kuponu',
    ];
    let best: { campaign: CampaignRow; discount: number } | null = null;

    for (const campaign of campaigns) {
      if (!lineTypes.includes(campaign.campaign_type)) continue;
      if (this.checkUsageLimits(campaign, customerId)) continue;
      if (!this.matchesLine(campaign, product, quantity, customerCategory)) continue;

      const discount = this.calcLineDiscount(campaign, listPrice, quantity);
      if (discount <= 0) continue;

      if (
        !best ||
        discount > best.discount ||
        (discount === best.discount && campaign.priority < best.campaign.priority)
      ) {
        best = { campaign, discount };
      }
    }
    return best;
  }

  private findCartCampaign(
    campaigns: CampaignRow[],
    subtotal: number,
    customerId: number | null
  ): CampaignRow | null {
    for (const campaign of campaigns) {
      if (this.checkUsageLimits(campaign, customerId)) continue;
      const min = Number(campaign.min_sale_amount || 0);
      if (subtotal < min) continue;
      return campaign;
    }
    return null;
  }

  private calcLineDiscount(campaign: CampaignRow, unitPrice: number, quantity: number): number {
    const lineTotal = unitPrice * quantity;
    let discount = 0;
    switch (campaign.discount_type) {
      case 'Yüzde indirim':
        discount = (lineTotal * Number(campaign.discount_value)) / 100;
        break;
      case 'Sabit tutar indirimi':
        discount = Number(campaign.discount_value);
        break;
      case 'Birim fiyat sabitleme':
        discount = Math.max(0, (unitPrice - Number(campaign.discount_value)) * quantity);
        break;
    }
    if (campaign.max_discount_amount != null) {
      discount = Math.min(discount, Number(campaign.max_discount_amount));
    }
    return Math.min(discount, lineTotal);
  }

  private calcCartDiscount(campaign: CampaignRow, subtotal: number): number {
    let discount = 0;
    switch (campaign.discount_type) {
      case 'Yüzde indirim':
        discount = (subtotal * Number(campaign.discount_value)) / 100;
        break;
      case 'Sabit tutar indirimi':
        discount = Number(campaign.discount_value);
        break;
      default:
        discount = 0;
    }
    if (campaign.max_discount_amount != null) {
      discount = Math.min(discount, Number(campaign.max_discount_amount));
    }
    return Math.min(discount, subtotal);
  }
}
