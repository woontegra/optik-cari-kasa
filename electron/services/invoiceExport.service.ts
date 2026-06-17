import fs from 'fs';
import * as XLSX from 'xlsx';
import type Database from 'better-sqlite3';
import { InvoiceDraftService } from './invoiceDraft.service';
import { EinvoiceSettingsService } from './einvoiceSettings.service';

export class InvoiceExportService {
  private draftService: InvoiceDraftService;

  constructor(private db: Database.Database) {
    this.draftService = new InvoiceDraftService(db);
  }

  exportExcel(draftId: number, filePath: string): { recordCount: number } {
    const detail = this.draftService.getById(draftId);
    if (!detail) throw new Error('Taslak bulunamadı.');
    const items = (detail.items as Array<Record<string, unknown>>) || [];
    const partyTitle =
      detail.invoice_title || detail.customer_name || detail.supplier_name || '';
    const taxNo = detail.customer_tax_no || detail.supplier_tax_no || detail.tc_no || '';
    const taxOffice = detail.customer_tax_office || detail.supplier_tax_office || '';
    const address = detail.invoice_address || '';

    const rows = items.map((item) => ({
      'Belge Türü': detail.document_type,
      'Belge Tarihi': detail.issue_date,
      'Cari Unvan': partyTitle,
      'VKN/TCKN': taxNo,
      'Vergi Dairesi': taxOffice,
      Adres: address,
      'Ürün Adı': item.description,
      Barkod: item.barcode || '',
      Miktar: item.quantity,
      'Birim Fiyat': item.unit_price,
      İndirim: item.discount_amount,
      'KDV Oranı': item.vat_rate,
      'KDV Tutarı': item.vat_amount,
      'Satır Toplamı': item.line_total,
      'Genel Toplam': detail.total_amount,
      Not: detail.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fatura Taslağı');
    XLSX.writeFile(wb, filePath);
    return { recordCount: rows.length };
  }

  exportXml(draftId: number, filePath: string): { filePath: string } {
    const detail = this.draftService.getById(draftId);
    if (!detail) throw new Error('Taslak bulunamadı.');
    const items = (detail.items as Array<Record<string, unknown>>) || [];
    const settings = new EinvoiceSettingsService(this.db).get();
    const company = this.db.prepare(`SELECT * FROM companies LIMIT 1`).get() as Record<string, unknown> || {};

    const lines = items
      .map(
        (item, idx) => `    <Line id="${idx + 1}">
      <Description>${escapeXml(String(item.description))}</Description>
      <Barcode>${escapeXml(String(item.barcode || ''))}</Barcode>
      <Quantity>${item.quantity}</Quantity>
      <UnitPrice>${item.unit_price}</UnitPrice>
      <VatRate>${item.vat_rate}</VatRate>
      <LineTotal>${item.line_total}</LineTotal>
    </Line>`
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Taslak veri XML'i — resmi UBL değildir -->
<InvoiceDraft xmlns="urn:woontegra:invoice-draft:1">
  <DraftNo>${escapeXml(String(detail.draft_no))}</DraftNo>
  <DocumentType>${escapeXml(String(detail.document_type))}</DocumentType>
  <IssueDate>${escapeXml(String(detail.issue_date))}</IssueDate>
  <Issuer>
    <Title>${escapeXml(String(company.name || settings.company_title || ''))}</Title>
    <TaxNo>${escapeXml(String(company.tax_number || settings.tax_no || ''))}</TaxNo>
    <TaxOffice>${escapeXml(String(company.tax_office || settings.tax_office || ''))}</TaxOffice>
  </Issuer>
  <Customer>
    <Title>${escapeXml(String(detail.invoice_title || detail.customer_name || detail.supplier_name || ''))}</Title>
    <TaxNo>${escapeXml(String(detail.customer_tax_no || detail.supplier_tax_no || detail.tc_no || ''))}</TaxNo>
  </Customer>
  <Totals>
    <Subtotal>${detail.subtotal_amount}</Subtotal>
    <Vat>${detail.vat_amount}</Vat>
    <Discount>${detail.discount_amount}</Discount>
    <Total>${detail.total_amount}</Total>
  </Totals>
  <Lines>
${lines}
  </Lines>
  <Note>${escapeXml(String(detail.notes || ''))}</Note>
</InvoiceDraft>`;

    fs.writeFileSync(filePath, '\uFEFF' + xml, 'utf8');
    return { filePath };
  }

  getPrintHtml(draftId: number): string {
    const detail = this.draftService.getById(draftId);
    if (!detail) return '<p>Taslak bulunamadı.</p>';
    const company = this.db.prepare(`SELECT * FROM companies LIMIT 1`).get() as Record<string, unknown> || {};
    const items = (detail.items as Array<Record<string, unknown>>) || [];
    const party = detail.invoice_title || detail.customer_name || detail.supplier_name || '-';

    const rows = items
      .map(
        (i) =>
          `<tr><td>${i.description}</td><td>${i.barcode || '-'}</td><td class="r">${i.quantity}</td><td class="r">${i.unit_price}</td><td class="r">${i.line_total}</td></tr>`
      )
      .join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fatura Taslağı ${detail.draft_no}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;padding:16px}
.hdr{border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:12px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 6px}
th{background:#f0f0f0}.r{text-align:right}.note{font-size:11px;color:#666;margin-top:12px}
.disclaimer{background:#fff8e1;border:1px solid #e6c200;padding:8px;margin-bottom:12px;font-size:11px}
</style></head><body>
<div class="disclaimer">Bu belge e-fatura/e-arşiv hazırlık taslağıdır. Resmi gönderim entegratör sisteminiz üzerinden yapılır.</div>
<div class="hdr"><h2>${company.name || 'Firma'}</h2><p>${company.address || ''} ${company.phone || ''}</p></div>
<h3>${detail.document_type} Taslağı — ${detail.draft_no}</h3>
<p><strong>Cari:</strong> ${party} | <strong>Tarih:</strong> ${detail.issue_date} | <strong>Durum:</strong> ${detail.status}</p>
<table><thead><tr><th>Ürün</th><th>Barkod</th><th>Miktar</th><th>Birim Fiyat</th><th>Toplam</th></tr></thead>
<tbody>${rows}</tbody></table>
<p class="r"><strong>Ara Toplam:</strong> ${detail.subtotal_amount} | <strong>KDV:</strong> ${detail.vat_amount} | <strong>Genel Toplam:</strong> ${detail.total_amount}</p>
<p class="note">${detail.notes || ''}</p>
</body></html>`;
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
