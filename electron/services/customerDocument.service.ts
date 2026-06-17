import type Database from 'better-sqlite3';
import type { CustomerDocumentType } from '../types/customerTracking';

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ₺`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR');
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('tr-TR');
  } catch {
    return dateStr;
  }
}

const DOC_STYLE = `
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #222; margin: 0; padding: 20px; }
  .doc { max-width: 800px; margin: 0 auto; }
  .company { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 16px; }
  .company h1 { font-size: 18px; margin: 0 0 4px; }
  .company p { margin: 2px 0; font-size: 11px; color: #555; }
  .title { font-size: 15px; font-weight: 700; text-align: center; margin: 12px 0; }
  .section { margin: 12px 0; }
  .section h3 { font-size: 13px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
  .grid span { color: #666; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  .right { text-align: right; }
  .footer { text-align: center; margin-top: 24px; font-size: 10px; color: #888; }
`;

export class CustomerDocumentService {
  constructor(private db: Database.Database) {}

  private getCompany(): Record<string, unknown> {
    return (
      (this.db.prepare(`SELECT * FROM companies WHERE is_default = 1 LIMIT 1`).get() as
        | Record<string, unknown>
        | undefined) ?? { name: 'Woontegra Optik' }
    );
  }

  private companyHeader(company: Record<string, unknown>): string {
    return `
      <div class="company">
        <h1>${company.name || 'Woontegra Optik'}</h1>
        ${company.address ? `<p>${company.address}</p>` : ''}
        ${company.phone ? `<p>Tel: ${company.phone}</p>` : ''}
        ${company.tax_number ? `<p>VKN: ${company.tax_number}</p>` : ''}
      </div>`;
  }

  private customerSection(customer: Record<string, unknown>): string {
    return `
      <div class="section">
        <h3>Müşteri Bilgileri</h3>
        <div class="grid">
          <div><span>Ad Soyad:</span> ${customer.full_name}</div>
          <div><span>T.C. Kimlik:</span> ${customer.tc_no || '-'}</div>
          <div><span>Telefon:</span> ${customer.phone || '-'}</div>
          <div><span>E-posta:</span> ${customer.email || '-'}</div>
          <div><span>Doğum Tarihi:</span> ${formatDate(customer.birth_date as string)}</div>
          <div><span>Kategori:</span> ${customer.customer_category || '-'}</div>
          <div><span>Kurum:</span> ${customer.institution_name || '-'}</div>
          <div><span>Cari Bakiye:</span> ${formatCurrency(Number(customer.balance || 0))}</div>
          <div style="grid-column: 1 / -1"><span>Adres:</span> ${customer.address || '-'}</div>
        </div>
      </div>`;
  }

  print(documentType: CustomerDocumentType, customerId: number): { html: string; title: string } {
    const customer = this.db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId) as
      | Record<string, unknown>
      | undefined;
    if (!customer) throw new Error('Müşteri bulunamadı.');

    const company = this.getCompany();
    let body = '';
    let title = documentType;

    if (documentType === 'Müşteri bilgi formu') {
      body = this.customerSection(customer);
      if (customer.notes) {
        body += `<div class="section"><h3>Notlar</h3><p>${customer.notes}</p></div>`;
      }
      if (customer.important_note) {
        body += `<div class="section"><h3>Önemli Not</h3><p>${customer.important_note}</p></div>`;
      }
    } else if (documentType === 'Satış geçmişi dökümü') {
      const sales = this.db
        .prepare(
          `SELECT s.sale_no, s.sale_date, s.net_amount, pr.prescription_no
           FROM sales s LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
           WHERE s.customer_id = ? AND s.status != 'İptal edildi' ORDER BY s.sale_date DESC`
        )
        .all(customerId) as Array<Record<string, unknown>>;
      body = this.customerSection(customer);
      body += `<div class="section"><h3>Satış Geçmişi</h3><table>
        <thead><tr><th>Satış No</th><th>Tarih</th><th>Reçete</th><th class="right">Tutar</th></tr></thead><tbody>`;
      for (const s of sales) {
        body += `<tr><td>${s.sale_no}</td><td>${formatDateTime(s.sale_date as string)}</td><td>${s.prescription_no || '-'}</td><td class="right">${formatCurrency(Number(s.net_amount))}</td></tr>`;
      }
      body += `</tbody></table></div>`;
    } else if (documentType === 'Reçete özeti') {
      const prescriptions = this.db
        .prepare(`SELECT * FROM prescriptions WHERE customer_id = ? ORDER BY prescription_date DESC`)
        .all(customerId) as Array<Record<string, unknown>>;
      body = this.customerSection(customer);
      body += `<div class="section"><h3>Reçete Özeti</h3><table>
        <thead><tr><th>No</th><th>Tarih</th><th>Doktor</th><th>Sağ</th><th>Sol</th><th>Durum</th></tr></thead><tbody>`;
      for (const p of prescriptions) {
        const right = [p.right_sph, p.right_cyl, p.right_ax].filter(Boolean).join(' / ') || '-';
        const left = [p.left_sph, p.left_cyl, p.left_ax].filter(Boolean).join(' / ') || '-';
        body += `<tr><td>${p.prescription_no || p.e_prescription_no || '-'}</td><td>${formatDate(p.prescription_date as string)}</td><td>${p.doctor || '-'}</td><td>${right}</td><td>${left}</td><td>${p.status}</td></tr>`;
      }
      body += `</tbody></table></div>`;
    } else if (documentType === 'Cari hesap dökümü') {
      const movements = this.db
        .prepare(
          `SELECT * FROM customer_account_movements WHERE customer_id = ? ORDER BY created_at`
        )
        .all(customerId) as Array<Record<string, unknown>>;
      body = this.customerSection(customer);
      body += `<div class="section"><h3>Cari Hesap Dökümü</h3><table>
        <thead><tr><th>Tarih</th><th>İşlem</th><th>Açıklama</th><th class="right">Borç</th><th class="right">Alacak</th><th class="right">Bakiye</th></tr></thead><tbody>`;
      for (const m of movements) {
        body += `<tr><td>${formatDateTime(m.created_at as string)}</td><td>${m.movement_type}</td><td>${m.description || '-'}</td>
          <td class="right">${Number(m.debit_amount) > 0 ? formatCurrency(Number(m.debit_amount)) : '-'}</td>
          <td class="right">${Number(m.credit_amount) > 0 ? formatCurrency(Number(m.credit_amount)) : '-'}</td>
          <td class="right">${formatCurrency(Number(m.balance_after))}</td></tr>`;
      }
      body += `</tbody></table></div>`;
    } else if (documentType === 'Teslim belgesi') {
      body = this.customerSection(customer);
      const lastSale = this.db
        .prepare(
          `SELECT s.*, pr.prescription_no FROM sales s
           LEFT JOIN prescriptions pr ON pr.id = s.prescription_id
           WHERE s.customer_id = ? AND s.status != 'İptal edildi' ORDER BY s.sale_date DESC LIMIT 1`
        )
        .get(customerId) as Record<string, unknown> | undefined;
      body += `<div class="section"><h3>Teslim Bilgileri</h3><div class="grid">
        <div><span>Teslim Tarihi:</span> ${formatDate(new Date().toISOString())}</div>
        <div><span>Satış No:</span> ${lastSale?.sale_no || '-'}</div>
        <div><span>Reçete No:</span> ${lastSale?.prescription_no || '-'}</div>
        <div><span>Tutar:</span> ${lastSale ? formatCurrency(Number(lastSale.net_amount)) : '-'}</div>
      </div>
      <p style="margin-top:16px">Yukarıda bilgileri bulunan ürün/ürünler eksiksiz teslim edilmiştir.</p>
      <div style="margin-top:40px;display:flex;justify-content:space-between">
        <div>Teslim Eden: _______________</div>
        <div>Teslim Alan: _______________</div>
      </div></div>`;
    }

    this.db
      .prepare(`INSERT INTO print_logs (document_type, related_id) VALUES (?, ?)`)
      .run(`Müşteri: ${documentType}`, customerId);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${DOC_STYLE}</style></head>
      <body><div class="doc">${this.companyHeader(company)}<div class="title">${title}</div>${body}
      <div class="footer">Yazdırma tarihi: ${formatDateTime(new Date().toISOString())}</div></div></body></html>`;

    return { html, title };
  }
}
