import type Database from 'better-sqlite3';
import type { StatementFilter } from '../types/finance';

export interface StatementRow {
  movement_date: string;
  movement_type: string;
  document_no: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export class StatementService {
  constructor(private db: Database.Database) {}

  private getCompanyName(): string {
    const row = this.db.prepare(`SELECT name FROM companies WHERE is_default = 1 LIMIT 1`).get() as { name: string } | undefined;
    return row?.name || 'Woontegra Optik';
  }

  private withRunningBalance(rows: Array<Omit<StatementRow, 'balance'>>): StatementRow[] {
    let balance = 0;
    return rows.map((row) => {
      balance += row.credit - row.debit;
      return { ...row, balance };
    });
  }

  getCustomer(customerId: number, filter: StatementFilter = {}): { rows: StatementRow[]; openingBalance: number } {
    const customer = this.db.prepare(`SELECT full_name, balance FROM customers WHERE id = ?`).get(customerId) as
      | { full_name: string; balance: number }
      | undefined;
    if (!customer) throw new Error('Müşteri bulunamadı.');

    let sql = `
      SELECT cam.created_at as movement_date, cam.movement_type, COALESCE(s.sale_no, '') as document_no,
             cam.description, cam.debit_amount as debit, cam.credit_amount as credit
      FROM customer_account_movements cam
      LEFT JOIN sales s ON s.id = cam.sale_id
      WHERE cam.customer_id = ?
    `;
    const params: unknown[] = [customerId];
    if (filter.date_from) {
      sql += ` AND date(cam.created_at) >= date(?)`;
      params.push(filter.date_from);
    }
    if (filter.date_to) {
      sql += ` AND date(cam.created_at) <= date(?)`;
      params.push(filter.date_to);
    }
    sql += ` ORDER BY cam.created_at, cam.id`;
    const raw = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    const rows = this.withRunningBalance(
      raw.map((r) => ({
        movement_date: String(r.movement_date),
        movement_type: String(r.movement_type),
        document_no: String(r.document_no || '-'),
        description: String(r.description || customer.full_name),
        debit: Number(r.debit || 0),
        credit: Number(r.credit || 0),
      }))
    );
    return { rows, openingBalance: 0 };
  }

  getSupplier(supplierId: number, filter: StatementFilter = {}): { rows: StatementRow[] } {
    let sql = `
      SELECT sam.created_at as movement_date, sam.movement_type,
             COALESCE(pd.document_no, '') as document_no, sam.description,
             sam.debit_amount as debit, sam.credit_amount as credit
      FROM supplier_account_movements sam
      LEFT JOIN purchase_documents pd ON pd.id = sam.purchase_document_id
      WHERE sam.supplier_id = ?
    `;
    const params: unknown[] = [supplierId];
    if (filter.date_from) {
      sql += ` AND date(sam.created_at) >= date(?)`;
      params.push(filter.date_from);
    }
    if (filter.date_to) {
      sql += ` AND date(sam.created_at) <= date(?)`;
      params.push(filter.date_to);
    }
    sql += ` ORDER BY sam.created_at, sam.id`;
    const raw = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return {
      rows: this.withRunningBalance(
        raw.map((r) => ({
          movement_date: String(r.movement_date),
          movement_type: String(r.movement_type),
          document_no: String(r.document_no || '-'),
          description: String(r.description || '-'),
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
        }))
      ),
    };
  }

  getCash(filter: StatementFilter = {}): { rows: StatementRow[] } {
    let sql = `
      SELECT movement_date, movement_type, COALESCE(sale_no, CAST(id AS TEXT)) as document_no,
             description, CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END as debit,
             CASE WHEN amount > 0 THEN amount ELSE 0 END as credit
      FROM (
        SELECT cm.*, s.sale_no FROM cash_movements cm LEFT JOIN sales s ON s.id = cm.sale_id
      ) WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filter.date_from) {
      sql += ` AND date(movement_date) >= date(?)`;
      params.push(filter.date_from);
    }
    if (filter.date_to) {
      sql += ` AND date(movement_date) <= date(?)`;
      params.push(filter.date_to);
    }
    if (filter.movement_type) {
      sql += ` AND movement_type = ?`;
      params.push(filter.movement_type);
    }
    sql += ` ORDER BY movement_date, id`;
    const raw = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return {
      rows: this.withRunningBalance(
        raw.map((r) => ({
          movement_date: String(r.movement_date),
          movement_type: String(r.movement_type),
          document_no: String(r.document_no || '-'),
          description: String(r.description || '-'),
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
        }))
      ),
    };
  }

  getBank(bankAccountId: number, filter: StatementFilter = {}): { rows: StatementRow[]; accountName: string } {
    const account = this.db
      .prepare(`SELECT account_name FROM bank_accounts WHERE id = ?`)
      .get(bankAccountId) as { account_name: string } | undefined;
    if (!account) throw new Error('Banka hesabı bulunamadı.');

    let sql = `SELECT movement_date, movement_type, CAST(id AS TEXT) as document_no, description,
               CASE WHEN direction = 'out' THEN amount ELSE 0 END as debit,
               CASE WHEN direction = 'in' THEN amount ELSE 0 END as credit
               FROM bank_movements WHERE bank_account_id = ?`;
    const params: unknown[] = [bankAccountId];
    if (filter.date_from) {
      sql += ` AND date(movement_date) >= date(?)`;
      params.push(filter.date_from);
    }
    if (filter.date_to) {
      sql += ` AND date(movement_date) <= date(?)`;
      params.push(filter.date_to);
    }
    sql += ` ORDER BY movement_date, id`;
    const raw = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return {
      accountName: account.account_name,
      rows: this.withRunningBalance(
        raw.map((r) => ({
          movement_date: String(r.movement_date),
          movement_type: String(r.movement_type),
          document_no: String(r.document_no || '-'),
          description: String(r.description || '-'),
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
        }))
      ),
    };
  }

  getPos(posAccountId: number, filter: StatementFilter = {}): { rows: StatementRow[]; posName: string } {
    const pos = this.db.prepare(`SELECT name FROM pos_accounts WHERE id = ?`).get(posAccountId) as { name: string } | undefined;
    if (!pos) throw new Error('POS hesabı bulunamadı.');

    let sql = `
      SELECT pm.created_at as movement_date, pm.status as movement_type,
             COALESCE(s.sale_no, CAST(pm.id AS TEXT)) as document_no,
             'POS tahsilat' as description, 0 as debit, pm.net_amount as credit
      FROM pos_movements pm
      LEFT JOIN sales s ON s.id = pm.sale_id
      WHERE pm.pos_account_id = ?
    `;
    const params: unknown[] = [posAccountId];
    if (filter.date_from) {
      sql += ` AND date(pm.created_at) >= date(?)`;
      params.push(filter.date_from);
    }
    if (filter.date_to) {
      sql += ` AND date(pm.created_at) <= date(?)`;
      params.push(filter.date_to);
    }
    sql += ` ORDER BY pm.created_at, pm.id`;
    const raw = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return {
      posName: pos.name,
      rows: this.withRunningBalance(
        raw.map((r) => ({
          movement_date: String(r.movement_date),
          movement_type: String(r.movement_type),
          document_no: String(r.document_no || '-'),
          description: String(r.description || '-'),
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
        }))
      ),
    };
  }

  buildPrintHtml(title: string, subtitle: string, rows: StatementRow[]): { html: string; title: string } {
    const company = this.getCompanyName();
    const body = rows
      .map(
        (r) =>
          `<tr><td>${r.movement_date}</td><td>${r.movement_type}</td><td>${r.document_no}</td><td>${r.description}</td>` +
          `<td class="text-right">${r.debit > 0 ? r.debit.toFixed(2) : '-'}</td>` +
          `<td class="text-right">${r.credit > 0 ? r.credit.toFixed(2) : '-'}</td>` +
          `<td class="text-right">${r.balance.toFixed(2)}</td></tr>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:Segoe UI,Arial;font-size:11px;padding:16px}
      h1{font-size:16px;margin:0}h2{font-size:13px;margin:8px 0}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
      th{background:#f5f5f5}.text-right{text-align:right}</style></head><body>
      <h1>${company}</h1><h2>${title}</h2><div>${subtitle}</div>
      <table><thead><tr><th>Tarih</th><th>İşlem</th><th>Belge No</th><th>Açıklama</th><th>Borç</th><th>Alacak</th><th>Bakiye</th></tr></thead>
      <tbody>${body || '<tr><td colspan="7">Kayıt yok</td></tr>'}</tbody></table></body></html>`;
    return { html, title };
  }
}
