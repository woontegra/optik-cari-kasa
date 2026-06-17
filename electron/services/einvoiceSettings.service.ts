import type Database from 'better-sqlite3';
import type { EinvoiceSettingsInput } from '../types/invoiceDraft';

export class EinvoiceSettingsService {
  constructor(private db: Database.Database) {}

  get(): Record<string, unknown> {
    const row = this.db.prepare(`SELECT * FROM einvoice_settings ORDER BY id LIMIT 1`).get() as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      this.db.prepare(`INSERT INTO einvoice_settings (provider_name, usage_mode) VALUES ('Diğer', 'Manuel aktarım')`).run();
      return this.db.prepare(`SELECT * FROM einvoice_settings ORDER BY id LIMIT 1`).get() as Record<string, unknown>;
    }
    return {
      ...row,
      is_einvoice_taxpayer: row.is_einvoice_taxpayer === 1,
      api_enabled: row.api_enabled === 1,
    };
  }

  update(input: EinvoiceSettingsInput): Record<string, unknown> {
    const existing = this.get();
    const id = Number(existing.id);
    this.db
      .prepare(
        `UPDATE einvoice_settings SET
          provider_name = ?, usage_mode = ?, company_title = ?, tax_no = ?, tax_office = ?,
          is_einvoice_taxpayer = ?, default_scenario = ?, default_vat_rate = ?, default_note = ?,
          api_enabled = ?, api_base_url = ?, api_key_masked = ?,
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.provider_name ?? existing.provider_name,
        input.usage_mode ?? existing.usage_mode,
        input.company_title ?? existing.company_title,
        input.tax_no ?? existing.tax_no,
        input.tax_office ?? existing.tax_office,
        input.is_einvoice_taxpayer !== undefined
          ? input.is_einvoice_taxpayer
            ? 1
            : 0
          : existing.is_einvoice_taxpayer
            ? 1
            : 0,
        input.default_scenario ?? existing.default_scenario,
        input.default_vat_rate ?? existing.default_vat_rate ?? 18,
        input.default_note ?? existing.default_note,
        input.api_enabled !== undefined ? (input.api_enabled ? 1 : 0) : existing.api_enabled ? 1 : 0,
        input.api_base_url ?? existing.api_base_url,
        input.api_key_masked ?? existing.api_key_masked,
        id
      );
    return this.get();
  }
}
