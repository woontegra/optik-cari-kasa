import type Database from 'better-sqlite3';

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ₺`;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('tr-TR');
  } catch {
    return dateStr;
  }
}

const RECEIPT_STYLE = `
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #222; margin: 0; padding: 16px; }
  .receipt { max-width: 420px; margin: 0 auto; }
  .company { text-align: center; border-bottom: 1px dashed #999; padding-bottom: 8px; margin-bottom: 10px; }
  .company h1 { font-size: 15px; margin: 0 0 4px; }
  .company p { margin: 2px 0; font-size: 10px; color: #555; }
  .title { font-size: 13px; font-weight: 700; text-align: center; margin: 8px 0; }
  .meta { margin-bottom: 10px; line-height: 1.5; }
  .meta span { display: inline-block; min-width: 110px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border-bottom: 1px solid #ddd; padding: 4px 6px; text-align: left; }
  th { font-size: 10px; color: #666; font-weight: 600; }
  .right { text-align: right; }
  .totals { margin-top: 10px; border-top: 1px dashed #999; padding-top: 8px; }
  .totals .row { display: flex; justify-content: space-between; margin: 3px 0; }
  .totals .grand { font-size: 13px; font-weight: 700; margin-top: 6px; }
  .footer { text-align: center; margin-top: 14px; font-size: 10px; color: #888; }
`;

export class PrintService {
  constructor(private db: Database.Database) {}

  private getCompany(): Record<string, unknown> {
    return (
      (this.db.prepare(`SELECT * FROM companies WHERE is_default = 1 LIMIT 1`).get() as
        | Record<string, unknown>
        | undefined) ?? { name: 'Woontegra Optik' }
    );
  }

  private logPrint(documentType: string, relatedId: number): void {
    this.db
      .prepare(`INSERT INTO print_logs (document_type, related_id) VALUES (?, ?)`)
      .run(documentType, relatedId);
  }

  private companyHeader(company: Record<string, unknown>): string {
    const cityDistrict = [company.city, company.district].filter(Boolean).join(' / ');
    const addressLine = [company.address, cityDistrict].filter(Boolean).join(' — ');
    const contact = [company.phone, company.email].filter(Boolean).join(' | ');
    const authorized = company.authorized_person ? `Yetkili: ${company.authorized_person}` : '';
    return `
      <div class="company">
        <h1>${company.name || 'Woontegra Optik'}</h1>
        ${authorized ? `<p>${authorized}</p>` : ''}
        ${addressLine ? `<p>${addressLine}</p>` : ''}
        ${contact ? `<p>${contact}</p>` : ''}
        ${company.tax_number ? `<p>VKN: ${company.tax_number}${company.tax_office ? ` — ${company.tax_office}` : ''}</p>` : ''}
      </div>`;
  }

  private companyFooter(company: Record<string, unknown>): string {
    const parts = [
      company.receipt_footer_note,
      company.support_phone ? `Destek: ${company.support_phone}` : '',
      company.support_email ? company.support_email : '',
    ].filter(Boolean);
    if (!parts.length) return '<div class="footer">Teşekkür ederiz.</div>';
    return `<div class="footer">${parts.join(' | ')}</div>`;
  }

  saleReceipt(saleId: number): { html: string; title: string } {
    const sale = this.db
      .prepare(
        `SELECT s.*, c.full_name as customer_name, pr.prescription_no, pr.e_prescription_no
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
         WHERE s.id = ?`
      )
      .get(saleId) as Record<string, unknown> | undefined;

    if (!sale) throw new Error('Satış bulunamadı.');

    const items = this.db
      .prepare(
        `SELECT si.*, p.name as product_name
         FROM sale_items si INNER JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?`
      )
      .all(saleId) as Array<Record<string, unknown>>;

    const payments = this.db
      .prepare(`SELECT payment_type, SUM(amount) as total FROM payments WHERE sale_id = ? GROUP BY payment_type`)
      .all(saleId) as Array<{ payment_type: string; total: number }>;

    const company = this.getCompany();
    const prescription = sale.prescription_no || sale.e_prescription_no || '-';
    const paymentTypes = payments.map((p) => p.payment_type).join(', ') || '-';

    const itemsHtml = items
      .map(
        (i) => {
          const orig = Number(i.original_unit_price || i.unit_price);
          const disc = Number(i.discount_amount || 0);
          return `<tr>
          <td>${i.product_name}</td>
          <td class="right">${i.quantity}</td>
          <td class="right">${formatCurrency(orig)}</td>
          <td class="right">${disc > 0 ? `-${formatCurrency(disc)}` : '-'}</td>
          <td class="right">${formatCurrency(i.total_price as number)}</td>
        </tr>`;
        }
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Satış Fişi</title>
      <style>${RECEIPT_STYLE}</style></head><body>
      <div class="receipt">
        ${this.companyHeader(company)}
        <div class="title">SATIŞ FİŞİ</div>
        <div class="meta">
          <div><span>Satış No:</span> <strong>${sale.sale_no}</strong></div>
          <div><span>Tarih:</span> ${formatDateTime(sale.sale_date as string)}</div>
          <div><span>Müşteri:</span> ${sale.customer_name || 'Perakende'}</div>
          <div><span>Reçete:</span> ${prescription}</div>
          <div><span>Ödeme Durumu:</span> ${sale.payment_status}</div>
        </div>
        <table>
          <thead><tr><th>Ürün</th><th class="right">Adet</th><th class="right">Birim</th><th class="right">İndirim</th><th class="right">Net</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div className="totals">
          <div class="row"><span>Ara Toplam</span><span>${formatCurrency((sale.total_amount as number) || sale.net_amount as number)}</span></div>
          ${Number(sale.campaign_discount_amount) > 0 ? `<div class="row"><span>Kampanya İndirimi</span><span>-${formatCurrency(sale.campaign_discount_amount as number)}</span></div>` : ''}
          ${Number(sale.manual_discount_amount) > 0 ? `<div class="row"><span>Manuel İndirim</span><span>-${formatCurrency(sale.manual_discount_amount as number)}</span></div>` : ''}
          ${Number(sale.discount_amount) > 0 && !sale.campaign_discount_amount ? `<div class="row"><span>İndirim</span><span>-${formatCurrency(sale.discount_amount as number)}</span></div>` : ''}
          <div class="row"><span>Genel Toplam</span><span>${formatCurrency(sale.net_amount as number)}</span></div>
          <div class="row"><span>Ödenen</span><span>${formatCurrency(sale.paid_amount as number)}</span></div>
          <div class="row"><span>Kalan</span><span>${formatCurrency(sale.remaining_amount as number)}</span></div>
          <div class="row"><span>Ödeme Türü</span><span>${paymentTypes}</span></div>
          ${sale.notes ? `<div class="row"><span>Not</span><span>${sale.notes}</span></div>` : ''}
        </div>
        ${this.companyFooter(company)}
      </div></body></html>`;

    this.logPrint('sale_receipt', saleId);
    return { html, title: `Satış Fişi — ${sale.sale_no}` };
  }

  paymentReceipt(paymentId: number): { html: string; title: string } {
    const payment = this.db
      .prepare(
        `SELECT p.*, s.sale_no, c.full_name as customer_name
         FROM payments p
         LEFT JOIN sales s ON s.id = p.sale_id
         LEFT JOIN customers c ON c.id = p.customer_id
         WHERE p.id = ?`
      )
      .get(paymentId) as Record<string, unknown> | undefined;

    if (!payment) throw new Error('Ödeme kaydı bulunamadı.');

    const company = this.getCompany();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tahsilat Makbuzu</title>
      <style>${RECEIPT_STYLE}</style></head><body>
      <div class="receipt">
        ${this.companyHeader(company)}
        <div class="title">TAHSİLAT MAKBUZU</div>
        <div class="meta">
          <div><span>Makbuz No:</span> <strong>MKB-${payment.id}</strong></div>
          <div><span>Tarih:</span> ${formatDateTime(payment.payment_date as string)}</div>
          <div><span>Müşteri:</span> ${payment.customer_name || '-'}</div>
          <div><span>Bağlı Satış:</span> ${payment.sale_no || '-'}</div>
          <div><span>Ödeme Türü:</span> ${payment.payment_type}</div>
          <div><span>Açıklama:</span> ${payment.description || payment.notes || '-'}</div>
        </div>
        <div class="totals">
          <div class="row grand"><span>Tahsilat Tutarı</span><span>${formatCurrency(payment.amount as number)}</span></div>
        </div>
        ${this.companyFooter(company)}
      </div></body></html>`;

    this.logPrint('payment_receipt', paymentId);
    return { html, title: `Tahsilat Makbuzu — MKB-${payment.id}` };
  }

  returnReceipt(returnId: number): { html: string; title: string } {
    const ret = this.db
      .prepare(
        `SELECT r.*, s.sale_no, c.full_name as customer_name
         FROM returns r
         LEFT JOIN sales s ON s.id = r.sale_id
         LEFT JOIN customers c ON c.id = r.customer_id
         WHERE r.id = ?`
      )
      .get(returnId) as Record<string, unknown> | undefined;

    if (!ret) throw new Error('İade kaydı bulunamadı.');

    const items = this.db
      .prepare(
        `SELECT ri.*, p.name as product_name
         FROM return_items ri INNER JOIN products p ON p.id = ri.product_id
         WHERE ri.return_id = ?`
      )
      .all(returnId) as Array<Record<string, unknown>>;

    const company = this.getCompany();
    const itemsHtml = items
      .map(
        (i) => `<tr>
          <td>${i.product_name}</td>
          <td class="right">${i.quantity}</td>
          <td class="right">${formatCurrency(i.total_amount as number)}</td>
        </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>İade Fişi</title>
      <style>${RECEIPT_STYLE}</style></head><body>
      <div class="receipt">
        ${this.companyHeader(company)}
        <div class="title">İADE FİŞİ</div>
        <div class="meta">
          <div><span>İade No:</span> <strong>${ret.return_no}</strong></div>
          <div><span>Tarih:</span> ${formatDateTime(ret.created_at as string)}</div>
          <div><span>Müşteri:</span> ${ret.customer_name || '-'}</div>
          <div><span>Bağlı Satış:</span> ${ret.sale_no || '-'}</div>
          <div><span>İade Tipi:</span> ${ret.return_type}</div>
          <div><span>Açıklama:</span> ${ret.reason || '-'}</div>
        </div>
        <table>
          <thead><tr><th>Ürün</th><th class="right">Adet</th><th class="right">Tutar</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="totals">
          <div class="row grand"><span>İade Tutarı</span><span>${formatCurrency(ret.total_amount as number)}</span></div>
        </div>
        ${this.companyFooter(company)}
      </div></body></html>`;

    this.logPrint('return_receipt', returnId);
    return { html, title: `İade Fişi — ${ret.return_no}` };
  }
}
