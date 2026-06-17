import type Database from 'better-sqlite3';
import JsBarcode from 'jsbarcode';
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import type { LabelPreviewInput, LabelPrintDocument, LabelSettings, LabelTemplate } from '../types/label';
import { LABEL_TEMPLATES } from '../types/label';

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ₺`;
}

function generateBarcodeSvg(value: string): string {
  const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);
  const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svgNode, value, {
    format: 'CODE128',
    width: 1.2,
    height: 36,
    displayValue: true,
    fontSize: 10,
    margin: 2,
  });
  return new XMLSerializer().serializeToString(svgNode);
}

const LABEL_CSS = `
  @page { margin: 4mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 8px; }
  .labels { display: flex; flex-wrap: wrap; gap: 6px; }
  .label { border: 1px dashed #bbb; box-sizing: border-box; page-break-inside: avoid; overflow: hidden; }
  .label.small { width: 48mm; height: 28mm; padding: 3px 4px; font-size: 8px; }
  .label.standard { width: 58mm; height: 38mm; padding: 4px 5px; font-size: 9px; }
  .label.shelf { width: 70mm; height: 45mm; padding: 5px 6px; font-size: 10px; }
  .company { font-size: 7px; color: #666; text-align: center; margin-bottom: 2px; }
  .name { font-weight: 700; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; }
  .brand-model { color: #444; margin: 2px 0; }
  .shelf { font-size: 8px; color: #555; }
  .price { font-weight: 700; margin-top: 2px; }
  .label.shelf .price { font-size: 16px; text-align: center; margin: 4px 0; }
  .barcode { text-align: center; margin-top: 2px; }
  .barcode svg { max-width: 100%; height: auto; }
  .no-barcode { color: #c00; font-size: 8px; text-align: center; margin-top: 4px; }
`;

export class LabelService {
  constructor(private db: Database.Database) {}

  getSettings(): LabelSettings {
    const rows = this.db.prepare(`SELECT key, value FROM app_settings`).all() as Array<{ key: string; value: string }>;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    const template = (map.label_template_default || 'standard') as LabelTemplate;
    return {
      defaultTemplate: LABEL_TEMPLATES.includes(template) ? template : 'standard',
      showPrice: map.label_show_price !== '0',
      showBarcode: map.label_show_barcode !== '0',
      showCompany: map.label_show_company === '1',
      previewBeforePrint: map.label_preview_before_print !== '0',
    };
  }

  updateSettings(settings: Partial<LabelSettings>): void {
    const upsert = this.db.prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
    if (settings.defaultTemplate) upsert.run('label_template_default', settings.defaultTemplate);
    if (settings.showPrice !== undefined) upsert.run('label_show_price', settings.showPrice ? '1' : '0');
    if (settings.showBarcode !== undefined) upsert.run('label_show_barcode', settings.showBarcode ? '1' : '0');
    if (settings.showCompany !== undefined) upsert.run('label_show_company', settings.showCompany ? '1' : '0');
    if (settings.previewBeforePrint !== undefined) {
      upsert.run('label_preview_before_print', settings.previewBeforePrint ? '1' : '0');
    }
  }

  private getCompanyName(): string {
    const row = this.db
      .prepare(`SELECT name FROM companies WHERE is_default = 1 LIMIT 1`)
      .get() as { name: string } | undefined;
    return row?.name || 'Woontegra Optik';
  }

  private renderLabel(
    product: Record<string, unknown>,
    template: LabelTemplate,
    settings: LabelSettings,
    companyName: string,
    allowNoBarcode: boolean
  ): string {
    const barcode = String(product.barcode || '').trim();
    const name = String(product.name || '');
    const brand = String(product.brand || product.brand_lookup_name || '');
    const model = String(product.model || product.model_lookup_name || '');
    const shelf = String(product.shelf_location || '');
    const price = formatCurrency(Number(product.sale_price || 0));
    const colorName = String(product.color_name || product.frame_color || '');
    const eyeSize = String(product.eye_size || '');
    const sph = String(product.sph || '');
    const cyl = String(product.cyl || '');
    const axis = String(product.axis || '');
    const addVal = String(product.addition || '');
    const lot = String(product.lot_no || '');
    const skt = String(product.uts_expiry_date || '');
    const ubb = String(product.ubb_code || '');
    const utsNo = String(product.uts_product_no || '');

    const opticalLine = [sph && `SPH ${sph}`, cyl && `CYL ${cyl}`, axis && `AX ${axis}`, addVal && `ADD ${addVal}`]
      .filter(Boolean)
      .join(' ');

    const nameClass = template === 'small' ? 'name' : 'name';
    const displayName = template === 'small' && name.length > 28 ? `${name.slice(0, 26)}…` : name;

    let barcodeHtml = '';
    if (settings.showBarcode) {
      if (barcode) {
        barcodeHtml = `<div class="barcode">${generateBarcodeSvg(barcode)}</div>`;
      } else if (allowNoBarcode) {
        barcodeHtml = `<div class="no-barcode">Barkodsuz etiket</div>`;
      } else {
        barcodeHtml = `<div class="no-barcode">Barkod yok</div>`;
      }
    }

    return `
      <div class="label ${template}">
        ${settings.showCompany ? `<div class="company">${companyName}</div>` : ''}
        ${template === 'shelf' && settings.showPrice ? `<div class="price">${price}</div>` : ''}
        <div class="${nameClass}">${displayName}</div>
        ${template !== 'small' && (brand || model) ? `<div class="brand-model">${[brand, model].filter(Boolean).join(' ')}</div>` : ''}
        ${template !== 'small' && colorName ? `<div class="shelf">Renk: ${colorName}${eyeSize ? ` | Ekartman: ${eyeSize}` : ''}</div>` : ''}
        ${template !== 'small' && opticalLine ? `<div class="shelf">${opticalLine}</div>` : ''}
        ${template !== 'small' && (lot || skt) ? `<div class="shelf">${[lot && `Lot: ${lot}`, skt && `SKT: ${skt}`].filter(Boolean).join(' | ')}</div>` : ''}
        ${template !== 'small' && (ubb || utsNo) ? `<div class="shelf" style="font-size:7px">${[ubb && `UBB: ${ubb}`, utsNo && `ÜTS: ${utsNo}`].filter(Boolean).join(' | ')}</div>` : ''}
        ${shelf && template !== 'small' ? `<div class="shelf">Raf: ${shelf}</div>` : ''}
        ${template !== 'shelf' && settings.showPrice ? `<div class="price">${price}</div>` : ''}
        ${barcodeHtml}
      </div>`;
  }

  preview(input: LabelPreviewInput): LabelPrintDocument {
    const settings = this.getSettings();
    const template = input.template || settings.defaultTemplate;
    const companyName = this.getCompanyName();
    const labels: string[] = [];

    for (const item of input.items) {
      const product = this.db
        .prepare(
          `SELECT p.*, pb.barcode FROM products p
           LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
           WHERE p.id = ?`
        )
        .get(item.productId) as Record<string, unknown> | undefined;

      if (!product) continue;

      const barcode = String(product.barcode || '').trim();
      if (!barcode && !input.allowNoBarcode && settings.showBarcode) {
        throw new Error(`"${product.name}" ürününde barkod yok. Etiket basılamaz.`);
      }

      const labelHtml = this.renderLabel(product, template, settings, companyName, !!input.allowNoBarcode);
      for (let i = 0; i < item.quantity; i++) {
        labels.push(labelHtml);
      }
    }

    if (!labels.length) {
      throw new Error('Etiket oluşturulacak ürün bulunamadı.');
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiketler</title>
      <style>${LABEL_CSS}</style></head><body>
      <div class="labels">${labels.join('')}</div>
      </body></html>`;

    return { html, title: 'Ürün Etiketleri' };
  }

  print(input: LabelPreviewInput): LabelPrintDocument {
    const doc = this.preview(input);
    this.db
      .prepare(`INSERT INTO print_logs (document_type, related_id) VALUES ('product_label', ?)`)
      .run(input.items[0]?.productId ?? null);
    return doc;
  }
}
