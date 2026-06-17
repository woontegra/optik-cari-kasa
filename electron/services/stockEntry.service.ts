import type Database from 'better-sqlite3';
import * as XLSX from 'xlsx';
import type { CompleteStockEntryInput, StockEntryBatchListFilters } from '../types/stockEntry';

export class StockEntryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockEntryValidationError';
  }
}

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ₺`;
}

export class StockEntryService {
  constructor(private db: Database.Database) {}

  private generateBatchNo(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const prefix = `SGE-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const row = this.db
      .prepare(`SELECT batch_no FROM stock_entry_batches WHERE batch_no LIKE ? ORDER BY id DESC LIMIT 1`)
      .get(`${prefix}%`) as { batch_no: string } | undefined;
    let seq = 1;
    if (row?.batch_no) {
      const parts = row.batch_no.split('-');
      const last = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(last)) seq = last + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  completeBatch(input: CompleteStockEntryInput, userId: number): {
    batchId: number;
    batchNo: string;
    totalItems: number;
    totalQuantity: number;
    totalCost: number;
    productIds: number[];
  } {
    if (!input.items?.length) {
      throw new StockEntryValidationError('Giriş listesi boş. En az bir ürün ekleyin.');
    }
    for (const item of input.items) {
      if (!item.product_id || item.quantity <= 0) {
        throw new StockEntryValidationError('Geçersiz ürün veya adet.');
      }
    }

    const batchNo = this.generateBatchNo();
    const entryDate = input.entry_date || new Date().toISOString().slice(0, 10);
    const notes = input.notes?.trim() || null;
    const documentNo = input.document_no?.trim() || null;
    const supplierId = input.supplier_id ?? null;

    const run = this.db.transaction(() => {
      let totalQuantity = 0;
      let totalCost = 0;
      const productIds: number[] = [];

      const batchResult = this.db
        .prepare(
          `INSERT INTO stock_entry_batches (
            batch_no, supplier_id, document_no, entry_date,
            total_items, total_quantity, total_cost, notes, created_by
          ) VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)`
        )
        .run(batchNo, supplierId, documentNo, entryDate, notes, userId);
      const batchId = Number(batchResult.lastInsertRowid);

      const getProduct = this.db.prepare(`SELECT * FROM products WHERE id = ?`);
      const updateStock = this.db.prepare(
        `UPDATE products SET stock_quantity = ?, purchase_price = ?, sale_price = ?, shelf_location = COALESCE(?, shelf_location), updated_at = datetime('now', 'localtime') WHERE id = ?`
      );
      const updateStockQtyOnly = this.db.prepare(
        `UPDATE products SET stock_quantity = ?, shelf_location = COALESCE(?, shelf_location), updated_at = datetime('now', 'localtime') WHERE id = ?`
      );
      const insertMovement = this.db.prepare(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, unit_price, reference_type, reference_id, notes)
         VALUES (?, 'Mal Kabul', ?, ?, 'stock_entry_batch', ?, ?)`
      );
      const insertItem = this.db.prepare(
        `INSERT INTO stock_entry_items (batch_id, product_id, barcode, quantity, purchase_price, sale_price, previous_stock, new_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const item of input.items) {
        const product = getProduct.get(item.product_id) as Record<string, unknown> | undefined;
        if (!product) {
          throw new StockEntryValidationError(`Ürün bulunamadı (ID: ${item.product_id}).`);
        }

        const prevStock = Number(product.stock_quantity ?? 0);
        const newStock = prevStock + item.quantity;
        const purchasePrice = item.purchase_price ?? Number(product.purchase_price ?? 0);
        const salePrice = item.sale_price ?? Number(product.sale_price ?? 0);
        const shelf = item.shelf_location?.trim() || null;

        if (item.update_prices) {
          updateStock.run(newStock, purchasePrice, salePrice, shelf, item.product_id);
        } else {
          updateStockQtyOnly.run(newStock, shelf, item.product_id);
        }

        const movementNote = [
          `Fiş: ${batchNo}`,
          documentNo ? `Belge: ${documentNo}` : null,
          supplierId ? `Tedarikçi ID: ${supplierId}` : null,
        ]
          .filter(Boolean)
          .join(' | ');

        insertMovement.run(item.product_id, item.quantity, purchasePrice, batchId, movementNote);
        insertItem.run(
          batchId,
          item.product_id,
          item.barcode?.trim() || null,
          item.quantity,
          purchasePrice,
          salePrice,
          prevStock,
          newStock
        );

        totalQuantity += item.quantity;
        totalCost += item.quantity * purchasePrice;
        productIds.push(item.product_id);
      }

      this.db
        .prepare(
          `UPDATE stock_entry_batches SET total_items = ?, total_quantity = ?, total_cost = ? WHERE id = ?`
        )
        .run(input.items.length, totalQuantity, totalCost, batchId);

      return {
        batchId,
        batchNo,
        totalItems: input.items.length,
        totalQuantity,
        totalCost,
        productIds,
      };
    });

    return run();
  }

  listBatches(filters: StockEntryBatchListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT b.*, s.name as supplier_name, u.full_name as created_by_name
      FROM stock_entry_batches b
      LEFT JOIN suppliers s ON s.id = b.supplier_id
      LEFT JOIN users u ON u.id = b.created_by
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.date_from) {
      sql += ` AND date(b.entry_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(b.entry_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.supplier_id) {
      sql += ` AND b.supplier_id = ?`;
      params.push(filters.supplier_id);
    }
    if (filters.search?.trim()) {
      sql += ` AND (b.batch_no LIKE ? OR b.document_no LIKE ? OR s.name LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY b.created_at DESC LIMIT 500`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  getBatchDetail(batchId: number): Record<string, unknown> | null {
    const batch = this.db
      .prepare(
        `SELECT b.*, s.name as supplier_name, s.phone as supplier_phone,
                u.full_name as created_by_name
         FROM stock_entry_batches b
         LEFT JOIN suppliers s ON s.id = b.supplier_id
         LEFT JOIN users u ON u.id = b.created_by
         WHERE b.id = ?`
      )
      .get(batchId) as Record<string, unknown> | undefined;
    if (!batch) return null;

    const items = this.db
      .prepare(
        `SELECT sei.*, p.name as product_name, p.product_type, p.brand, p.model, p.shelf_location
         FROM stock_entry_items sei
         INNER JOIN products p ON p.id = sei.product_id
         WHERE sei.batch_id = ?
         ORDER BY sei.id`
      )
      .all(batchId) as Record<string, unknown>[];

    return { ...batch, items };
  }

  buildPrintDocument(batchId: number): { html: string; title: string } {
    const detail = this.getBatchDetail(batchId);
    if (!detail) {
      throw new StockEntryValidationError('Giriş fişi bulunamadı.');
    }

    const company = this.db.prepare(`SELECT name FROM companies WHERE is_default = 1 LIMIT 1`).get() as
      | { name: string }
      | undefined;
    const companyName = company?.name || 'Woontegra Optik';

    const items = (detail.items as Record<string, unknown>[]) || [];
    const rows = items
      .map(
        (i) => `
      <tr>
        <td>${String(i.barcode || '-')}</td>
        <td>${String(i.product_name)}</td>
        <td>${String(i.product_type || '-')}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${formatCurrency(Number(i.purchase_price))}</td>
        <td class="num">${formatCurrency(Number(i.sale_price))}</td>
      </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Stok Giriş Fişi</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 12px; color: #222; }
      h2 { text-align: center; margin: 4px 0 12px; font-size: 14px; }
      .meta { margin-bottom: 10px; }
      .meta div { margin: 2px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
      th { background: #f5f5f5; }
      .num { text-align: right; }
      .totals { margin-top: 10px; font-weight: 600; }
    </style></head><body>
      <h2>STOK GİRİŞ / MAL KABUL FİŞİ</h2>
      <div class="meta">
        <div><strong>Firma:</strong> ${companyName}</div>
        <div><strong>Fiş No:</strong> ${String(detail.batch_no)}</div>
        <div><strong>Tarih:</strong> ${String(detail.entry_date)}</div>
        <div><strong>Tedarikçi:</strong> ${String(detail.supplier_name || '-')}</div>
        <div><strong>Belge No:</strong> ${String(detail.document_no || '-')}</div>
        ${detail.notes ? `<div><strong>Açıklama:</strong> ${String(detail.notes)}</div>` : ''}
      </div>
      <table>
        <thead><tr><th>Barkod</th><th>Ürün</th><th>Tip</th><th>Adet</th><th>Alış</th><th>Satış</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        Ürün çeşidi: ${String(detail.total_items)} |
        Toplam adet: ${String(detail.total_quantity)} |
        Toplam maliyet: ${formatCurrency(Number(detail.total_cost))}
      </div>
    </body></html>`;

    return { html, title: `Stok Giriş Fişi — ${String(detail.batch_no)}` };
  }

  exportBatchToExcel(batchId: number, filePath: string): { exported: boolean; rowCount: number } {
    const detail = this.getBatchDetail(batchId);
    if (!detail) {
      throw new StockEntryValidationError('Giriş fişi bulunamadı.');
    }
    const items = (detail.items as Record<string, unknown>[]) || [];
    const rows = items.map((i) => ({
      Barkod: i.barcode || '',
      'Ürün Adı': i.product_name,
      Tip: i.product_type,
      Marka: i.brand || '',
      Model: i.model || '',
      'Giriş Adedi': i.quantity,
      'Önceki Stok': i.previous_stock,
      'Yeni Stok': i.new_stock,
      'Alış Fiyatı': i.purchase_price,
      'Satış Fiyatı': i.sale_price,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stok Girişi');
    XLSX.writeFile(wb, filePath);
    return { exported: true, rowCount: rows.length };
  }
}
