import fs from 'fs';
import * as XLSX from 'xlsx';
import type Database from 'better-sqlite3';
import { EinvoiceSettingsService } from './einvoiceSettings.service';
import type {
  CreateFromPurchaseInput,
  CreateFromSaleInput,
  CreateFromSgkBatchInput,
  CreateFromStockEntryInput,
  InvoiceDraftListFilters,
  InvoiceDraftReportFilters,
  InvoiceDraftValidation,
  MarkOfficialInput,
} from '../types/invoiceDraft';

export class InvoiceDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceDraftError';
  }
}

function nextDraftNo(prefix = 'FTS'): string {
  return `${prefix}-${Date.now()}`;
}

export class InvoiceDraftService {
  private settingsService: EinvoiceSettingsService;

  constructor(private db: Database.Database) {
    this.settingsService = new EinvoiceSettingsService(db);
  }

  private getCompanySettings(): Record<string, unknown> {
    return this.db.prepare(`SELECT * FROM companies LIMIT 1`).get() as Record<string, unknown> || {};
  }

  private log(draftId: number, status: string, description: string, userId?: number): void {
    this.db
      .prepare(
        `INSERT INTO invoice_draft_logs (invoice_draft_id, status, description, created_by) VALUES (?, ?, ?, ?)`
      )
      .run(draftId, status, description, userId || null);
  }

  validateDraftContext(ctx: {
    partyTitle?: string;
    taxNo?: string;
    taxOffice?: string;
    address?: string;
    isCorporate?: boolean;
    items: unknown[];
    totalAmount: number;
  }): InvoiceDraftValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const company = this.getCompanySettings();
    const settings = this.settingsService.get();

    if (!ctx.partyTitle?.trim()) errors.push('Cari unvan / müşteri adı eksik');
    if (ctx.isCorporate) {
      if (!ctx.taxNo?.trim()) errors.push('VKN/TCKN eksik');
      if (!ctx.taxOffice?.trim()) errors.push('Vergi dairesi eksik');
    } else if (!ctx.taxNo?.trim()) {
      warnings.push('T.C. kimlik no eksik (bireysel)');
    }
    if (!ctx.address?.trim()) warnings.push('Fatura adresi eksik');
    if (!ctx.items.length) errors.push('Ürün kalemi yok');
    if (ctx.totalAmount <= 0) errors.push('Toplam tutar geçersiz');

    const issuerTax = String(company.tax_number || settings.tax_no || '').trim();
    const issuerTitle = String(company.name || settings.company_title || '').trim();
    if (!issuerTax) warnings.push('Firma VKN/TCKN ayarı eksik');
    if (!issuerTitle) warnings.push('Firma unvanı ayarı eksik');

    return { isValid: errors.length === 0, errors, warnings };
  }

  list(filters: InvoiceDraftListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT d.*, c.full_name as customer_name, s.name as supplier_name, sl.sale_no, pd.document_no as purchase_no
      FROM invoice_drafts d
      LEFT JOIN customers c ON c.id = d.customer_id
      LEFT JOIN suppliers s ON s.id = d.supplier_id
      LEFT JOIN sales sl ON sl.id = d.sale_id
      LEFT JOIN purchase_documents pd ON pd.id = d.purchase_document_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters.date_from) {
      sql += ` AND date(d.issue_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(d.issue_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.document_type) {
      sql += ` AND d.document_type = ?`;
      params.push(filters.document_type);
    }
    if (filters.status) {
      sql += ` AND d.status = ?`;
      params.push(filters.status);
    }
    if (filters.source_type) {
      sql += ` AND d.source_type = ?`;
      params.push(filters.source_type);
    }
    if (filters.customer_search?.trim()) {
      sql += ` AND c.full_name LIKE ?`;
      params.push(`%${filters.customer_search.trim()}%`);
    }
    if (filters.supplier_search?.trim()) {
      sql += ` AND s.name LIKE ?`;
      params.push(`%${filters.supplier_search.trim()}%`);
    }
    sql += ` ORDER BY d.issue_date DESC, d.id DESC`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  getById(id: number): Record<string, unknown> | null {
    const draft = this.db
      .prepare(
        `SELECT d.*, c.full_name as customer_name, c.invoice_title, c.tax_no as customer_tax_no,
                c.tax_office as customer_tax_office, c.invoice_address, c.invoice_city, c.invoice_district,
                c.tc_no, c.email as customer_email, c.invoice_party_type,
                s.name as supplier_name, s.tax_no as supplier_tax_no, s.tax_office as supplier_tax_office,
                sl.sale_no, pd.document_no as purchase_no, sb.batch_no as sgk_batch_no
         FROM invoice_drafts d
         LEFT JOIN customers c ON c.id = d.customer_id
         LEFT JOIN suppliers s ON s.id = d.supplier_id
         LEFT JOIN sales sl ON sl.id = d.sale_id
         LEFT JOIN purchase_documents pd ON pd.id = d.purchase_document_id
         LEFT JOIN sgk_invoice_batches sb ON sb.id = d.sgk_invoice_batch_id
         WHERE d.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!draft) return null;
    const items = this.db
      .prepare(`SELECT * FROM invoice_draft_items WHERE invoice_draft_id = ? ORDER BY id`)
      .all(id);
    const logs = this.db
      .prepare(`SELECT * FROM invoice_draft_logs WHERE invoice_draft_id = ? ORDER BY created_at DESC`)
      .all(id);
    return { ...draft, items, logs };
  }

  private insertDraftWithItems(
    header: Record<string, unknown>,
    items: Array<Record<string, unknown>>,
    userId?: number
  ): number {
    const result = this.db
      .prepare(
        `INSERT INTO invoice_drafts (
          draft_no, source_type, source_id, sale_id, purchase_document_id, sgk_invoice_batch_id,
          stock_entry_batch_id, customer_id, supplier_id, document_type, scenario_type,
          issue_date, due_date, currency, subtotal_amount, discount_amount, vat_amount, total_amount,
          status, status_note, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        header.draft_no,
        header.source_type,
        header.source_id || null,
        header.sale_id || null,
        header.purchase_document_id || null,
        header.sgk_invoice_batch_id || null,
        header.stock_entry_batch_id || null,
        header.customer_id || null,
        header.supplier_id || null,
        header.document_type,
        header.scenario_type || null,
        header.issue_date,
        header.due_date || null,
        header.currency || 'TRY',
        header.subtotal_amount,
        header.discount_amount,
        header.vat_amount,
        header.total_amount,
        header.status,
        header.status_note || null,
        header.notes || null,
        userId || null
      );
    const draftId = Number(result.lastInsertRowid);
    const insertItem = this.db.prepare(
      `INSERT INTO invoice_draft_items (
        invoice_draft_id, product_id, description, barcode, quantity, unit_price,
        discount_amount, vat_rate, vat_amount, line_total, serial_no, lot_no, expiry_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of items) {
      insertItem.run(
        draftId,
        item.product_id || null,
        item.description,
        item.barcode || null,
        item.quantity,
        item.unit_price,
        item.discount_amount || 0,
        item.vat_rate || 18,
        item.vat_amount || 0,
        item.line_total,
        item.serial_no || null,
        item.lot_no || null,
        item.expiry_date || null
      );
    }
    this.log(draftId, String(header.status), 'Taslak oluşturuldu', userId);
    return draftId;
  }

  createFromSale(input: CreateFromSaleInput, userId?: number): { draftId: number; warning?: string } {
    const existing = this.db
      .prepare(`SELECT id, draft_no FROM invoice_drafts WHERE sale_id = ? AND status != 'İptal'`)
      .get(input.sale_id) as { id: number; draft_no: string } | undefined;
    if (existing && !input.force) {
      throw new InvoiceDraftError(
        `Bu satış için zaten fatura taslağı var (${existing.draft_no}). Yine de oluşturmak için onaylayın.`
      );
    }

    const sale = this.db
      .prepare(
        `SELECT s.*, c.full_name, c.invoice_title, c.tax_no, c.tc_no, c.tax_office,
                c.invoice_address, c.address, c.invoice_city, c.city, c.invoice_district, c.district,
                c.invoice_party_type, c.is_einvoice_registered
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE s.id = ? AND s.status != 'İptal edildi'`
      )
      .get(input.sale_id) as Record<string, unknown> | undefined;
    if (!sale) throw new InvoiceDraftError('Satış bulunamadı.');

    const saleItems = this.db
      .prepare(
        `SELECT si.*, p.name as product_name, p.vat_rate,
                COALESCE(si.barcode, pb.barcode) as barcode, p.serial_no, p.lot_no, p.uts_expiry_date
         FROM sale_items si
         INNER JOIN products p ON p.id = si.product_id
         LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
         WHERE si.sale_id = ?`
      )
      .all(input.sale_id) as Array<Record<string, unknown>>;

    const settings = this.settingsService.get();
    const defaultVat = Number(settings.default_vat_rate) || 18;
    let subtotal = 0;
    let vatTotal = 0;
    let discountTotal = Number(sale.total_discount_amount) || Number(sale.discount_amount) || 0;
    const lineItems: Array<Record<string, unknown>> = [];

    for (const si of saleItems) {
      const qty = Number(si.quantity) || 1;
      const unit = Number(si.unit_price) || 0;
      const lineDisc = Number(si.discount_amount) || 0;
      const lineSub = qty * unit - lineDisc;
      const vatRate = Number(si.vat_rate) || defaultVat;
      const vatAmt = lineSub * (vatRate / (100 + vatRate));
      const lineTotal = lineSub;
      subtotal += lineSub - vatAmt;
      vatTotal += vatAmt;
      lineItems.push({
        product_id: si.product_id,
        description: si.product_name,
        barcode: si.barcode,
        quantity: qty,
        unit_price: unit,
        discount_amount: lineDisc,
        vat_rate: vatRate,
        vat_amount: vatAmt,
        line_total: lineTotal,
        serial_no: si.serial_no,
        lot_no: si.lot_no,
        expiry_date: si.uts_expiry_date,
      });
    }

    const total = Number(sale.net_amount) || subtotal + vatTotal;
    const partyTitle = String(sale.invoice_title || sale.full_name || '');
    const taxNo = String(sale.tax_no || sale.tc_no || '');
    const isCorporate = sale.invoice_party_type === 'Kurumsal';
    const validation = this.validateDraftContext({
      partyTitle,
      taxNo,
      taxOffice: String(sale.tax_office || ''),
      address: String(sale.invoice_address || sale.address || ''),
      isCorporate,
      items: lineItems,
      totalAmount: total,
    });

    let status = validation.isValid ? 'Hazır' : 'Eksik Bilgi';
    let statusNote = [...validation.errors, ...validation.warnings].join('; ');
    if (!validation.isValid && input.force) status = 'Eksik Bilgi';

    let notes = input.notes || '';
    if (Number(sale.institution_amount) > 0) {
      notes += ` | Hasta payı: ${sale.patient_amount}, Kurum payı: ${sale.institution_amount}`;
    }
    if (sale.manual_discount_note) notes += ` | ${sale.manual_discount_note}`;

    const draftId = this.insertDraftWithItems(
      {
        draft_no: nextDraftNo('SAT'),
        source_type: 'SALE',
        source_id: input.sale_id,
        sale_id: input.sale_id,
        customer_id: sale.customer_id,
        document_type: input.document_type,
        scenario_type: settings.default_scenario,
        issue_date: String(sale.sale_date).slice(0, 10),
        subtotal_amount: subtotal,
        discount_amount: discountTotal,
        vat_amount: vatTotal,
        total_amount: total,
        status,
        status_note: statusNote || null,
        notes: notes.trim() || null,
      },
      lineItems,
      userId
    );

    return { draftId, warning: statusNote || undefined };
  }

  createFromPurchase(input: CreateFromPurchaseInput, userId?: number): { draftId: number } {
    const doc = this.db
      .prepare(
        `SELECT pd.*, s.name as supplier_name, s.tax_no, s.tax_office, s.address, s.invoice_address, s.city, s.district
         FROM purchase_documents pd
         INNER JOIN suppliers s ON s.id = pd.supplier_id
         WHERE pd.id = ?`
      )
      .get(input.purchase_document_id) as Record<string, unknown> | undefined;
    if (!doc) throw new InvoiceDraftError('Alış belgesi bulunamadı.');

    const items = this.db
      .prepare(
        `SELECT pdi.*, p.name as product_name, pb.barcode
         FROM purchase_document_items pdi
         INNER JOIN products p ON p.id = pdi.product_id
         LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
         WHERE pdi.document_id = ?`
      )
      .all(input.purchase_document_id) as Array<Record<string, unknown>>;

    const lineItems = items.map((i) => ({
      product_id: i.product_id,
      description: i.product_name,
      barcode: i.barcode,
      quantity: Number(i.quantity),
      unit_price: Number(i.purchase_price),
      discount_amount: 0,
      vat_rate: Number(i.vat_rate) || 18,
      vat_amount: Number(i.vat_amount) || 0,
      line_total: Number(i.line_total),
    }));

    const validation = this.validateDraftContext({
      partyTitle: String(doc.supplier_name),
      taxNo: String(doc.tax_no || ''),
      taxOffice: String(doc.tax_office || ''),
      address: String(doc.invoice_address || doc.address || ''),
      isCorporate: true,
      items: lineItems,
      totalAmount: Number(doc.total_amount) || 0,
    });

    const draftId = this.insertDraftWithItems(
      {
        draft_no: nextDraftNo('ALS'),
        source_type: 'PURCHASE',
        source_id: input.purchase_document_id,
        purchase_document_id: input.purchase_document_id,
        supplier_id: doc.supplier_id,
        document_type: input.document_type,
        issue_date: String(doc.document_date).slice(0, 10),
        due_date: doc.due_date || null,
        subtotal_amount: Number(doc.subtotal_amount) || 0,
        discount_amount: 0,
        vat_amount: Number(doc.vat_amount) || 0,
        total_amount: Number(doc.total_amount) || 0,
        status: validation.isValid ? 'Hazır' : 'Eksik Bilgi',
        status_note: [...validation.errors, ...validation.warnings].join('; ') || null,
        notes: input.notes || null,
      },
      lineItems,
      userId
    );
    return { draftId };
  }

  createFromSgkBatch(input: CreateFromSgkBatchInput, userId?: number): { draftId: number } {
    const batch = this.db
      .prepare(`SELECT * FROM sgk_invoice_batches WHERE id = ?`)
      .get(input.sgk_invoice_batch_id) as Record<string, unknown> | undefined;
    if (!batch) throw new InvoiceDraftError('SGK fatura batch bulunamadı.');

    const batchItems = this.db
      .prepare(
        `SELECT bi.*, c.full_name, pr.prescription_no, s.sale_no
         FROM sgk_invoice_batch_items bi
         LEFT JOIN customers c ON c.id = bi.customer_id
         LEFT JOIN prescriptions pr ON pr.id = bi.prescription_id
         LEFT JOIN sales s ON s.id = bi.sale_id
         WHERE bi.batch_id = ?`
      )
      .all(input.sgk_invoice_batch_id) as Array<Record<string, unknown>>;

    const lineItems = batchItems.map((i) => ({
      product_id: null,
      description: `SGK Reçete ${i.prescription_no || ''} / ${i.customer_name || ''} (${i.sale_no || ''})`,
      barcode: null,
      quantity: 1,
      unit_price: Number(i.institution_amount) || 0,
      discount_amount: 0,
      vat_rate: 0,
      vat_amount: 0,
      line_total: Number(i.institution_amount) || 0,
    }));

    const draftId = this.insertDraftWithItems(
      {
        draft_no: nextDraftNo('SGK'),
        source_type: 'SGK_BATCH',
        source_id: input.sgk_invoice_batch_id,
        sgk_invoice_batch_id: input.sgk_invoice_batch_id,
        document_type: input.document_type || 'E-Fatura',
        issue_date: new Date().toISOString().slice(0, 10),
        subtotal_amount: Number(batch.total_institution_amount) || 0,
        discount_amount: 0,
        vat_amount: 0,
        total_amount: Number(batch.total_institution_amount) || 0,
        status: 'Hazır',
        notes: `SGK Batch: ${batch.batch_no} | ${batch.institution_name || ''} | ${input.notes || ''}`.trim(),
      },
      lineItems,
      userId
    );
    return { draftId };
  }

  createFromStockEntry(input: CreateFromStockEntryInput, userId?: number): { draftId: number } {
    const batch = this.db
      .prepare(
        `SELECT b.*, s.name as supplier_name, s.tax_no, s.tax_office, s.address, s.id as supplier_id
         FROM stock_entry_batches b
         LEFT JOIN suppliers s ON s.id = b.supplier_id
         WHERE b.id = ?`
      )
      .get(input.stock_entry_batch_id) as Record<string, unknown> | undefined;
    if (!batch) throw new InvoiceDraftError('Mal kabul kaydı bulunamadı.');

    const items = this.db
      .prepare(
        `SELECT sei.*, p.name as product_name, pb.barcode, p.serial_no, p.lot_no, p.uts_expiry_date
         FROM stock_entry_items sei
         INNER JOIN products p ON p.id = sei.product_id
         LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
         WHERE sei.batch_id = ?`
      )
      .all(input.stock_entry_batch_id) as Array<Record<string, unknown>>;

    const lineItems = items.map((i) => ({
      product_id: i.product_id,
      description: i.product_name,
      barcode: i.barcode,
      quantity: Number(i.quantity),
      unit_price: Number(i.purchase_price) || 0,
      discount_amount: 0,
      vat_rate: 18,
      vat_amount: 0,
      line_total: Number(i.quantity) * Number(i.purchase_price || 0),
      serial_no: i.serial_no,
      lot_no: i.lot_no,
      expiry_date: i.uts_expiry_date,
    }));

    const draftId = this.insertDraftWithItems(
      {
        draft_no: nextDraftNo('IRS'),
        source_type: 'STOCK_ENTRY',
        source_id: input.stock_entry_batch_id,
        stock_entry_batch_id: input.stock_entry_batch_id,
        supplier_id: batch.supplier_id,
        document_type: 'E-İrsaliye',
        issue_date: String(batch.entry_date).slice(0, 10),
        subtotal_amount: Number(batch.total_cost) || 0,
        discount_amount: 0,
        vat_amount: 0,
        total_amount: Number(batch.total_cost) || 0,
        status: 'Hazır',
        notes: `Mal kabul: ${batch.batch_no} | ${batch.document_no || ''} | ${input.notes || ''}`.trim(),
      },
      lineItems,
      userId
    );
    return { draftId };
  }

  updateStatus(id: number, status: string, userId?: number): { id: number } {
    const draft = this.db.prepare(`SELECT id FROM invoice_drafts WHERE id = ?`).get(id);
    if (!draft) throw new InvoiceDraftError('Taslak bulunamadı.');
    this.db
      .prepare(
        `UPDATE invoice_drafts SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(status, id);
    this.log(id, status, `Durum güncellendi: ${status}`, userId);
    return { id };
  }

  markOfficial(input: MarkOfficialInput, userId?: number): { id: number } {
    const status = input.status || 'Gönderildi İşaretlendi';
    this.db
      .prepare(
        `UPDATE invoice_drafts SET
          official_invoice_no = ?, official_uuid = ?, official_date = ?,
          status = ?, status_note = ?, processed_at = datetime('now', 'localtime'),
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.official_invoice_no || null,
        input.official_uuid || null,
        input.official_date || null,
        status,
        input.status_note || null,
        input.draft_id
      );
    this.log(input.draft_id, status, 'Resmi belge bilgisi girildi', userId);
    return { id: input.draft_id };
  }

  markExported(id: number, userId?: number): { id: number } {
    this.db
      .prepare(
        `UPDATE invoice_drafts SET status = 'Dışa Aktarıldı', exported_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(id);
    this.log(id, 'Dışa Aktarıldı', 'Dışa aktarıldı', userId);
    return { id };
  }

  cancel(id: number, userId?: number): { id: number } {
    return this.updateStatus(id, 'İptal', userId);
  }

  getReport(filters: InvoiceDraftReportFilters = {}): Record<string, unknown> {
    const rows = this.list(filters);
    const summary = {
      total: rows.length,
      ready: rows.filter((r) => r.status === 'Hazır').length,
      exported: rows.filter((r) => r.status === 'Dışa Aktarıldı').length,
      sent: rows.filter((r) => r.status === 'Gönderildi İşaretlendi').length,
      cancelled: rows.filter((r) => r.status === 'İptal').length,
      missing: rows.filter((r) => r.status === 'Eksik Bilgi').length,
      totalAmount: rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
      vatTotal: rows.reduce((s, r) => s + (Number(r.vat_amount) || 0), 0),
    };
    return { rows, summary };
  }

  getDashboardStats(): Record<string, number> {
    const draftCount = this.db
      .prepare(`SELECT COUNT(*) as c FROM invoice_drafts WHERE status IN ('Taslak', 'Hazır', 'Eksik Bilgi')`)
      .get() as { c: number };
    const exportPending = this.db
      .prepare(`SELECT COUNT(*) as c FROM invoice_drafts WHERE status IN ('Hazır', 'Eksik Bilgi')`)
      .get() as { c: number };
    const missing = this.db
      .prepare(`SELECT COUNT(*) as c FROM invoice_drafts WHERE status = 'Eksik Bilgi'`)
      .get() as { c: number };
    const sgkReady = this.db
      .prepare(`SELECT COUNT(*) as c FROM sgk_invoice_batches WHERE status IN ('Hazırlandı', 'Faturaya Hazır')`)
      .get() as { c: number };
    return {
      invoiceDraftCount: draftCount.c,
      invoiceExportPending: exportPending.c,
      invoiceMissingInfo: missing.c,
      sgkInvoiceReadyForEdonusum: sgkReady.c,
    };
  }
}
