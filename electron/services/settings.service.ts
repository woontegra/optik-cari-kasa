import type Database from 'better-sqlite3';
import type { SecuritySettings } from '../types/auth';

export interface CompanySettings {
  id?: number;
  name: string;
  authorized_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  district?: string;
  tax_office?: string;
  tax_number?: string;
  logo_path?: string;
  receipt_footer_note?: string;
  support_phone?: string;
  support_email?: string;
  website?: string;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  backupFolder: string;
  backupFrequency: 'on_close' | 'daily' | 'weekly';
  lastBackupAt: string | null;
}

export class SettingsService {
  constructor(private db: Database.Database) {}

  private getSetting(key: string, defaultValue = ''): string {
    const row = this.db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? defaultValue;
  }

  private setSetting(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(key, value);
  }

  getCompany(): CompanySettings | null {
    const row = this.db.prepare(`SELECT * FROM companies WHERE is_default = 1 LIMIT 1`).get() as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      id: Number(row.id),
      name: String(row.name || ''),
      authorized_person: row.authorized_person ? String(row.authorized_person) : '',
      phone: row.phone ? String(row.phone) : '',
      email: row.email ? String(row.email) : '',
      address: row.address ? String(row.address) : '',
      city: row.city ? String(row.city) : '',
      district: row.district ? String(row.district) : '',
      tax_office: row.tax_office ? String(row.tax_office) : '',
      tax_number: row.tax_number ? String(row.tax_number) : '',
      logo_path: row.logo_path ? String(row.logo_path) : '',
      receipt_footer_note: row.receipt_footer_note ? String(row.receipt_footer_note) : '',
      support_phone: row.support_phone ? String(row.support_phone) : '',
      support_email: row.support_email ? String(row.support_email) : '',
      website: row.website ? String(row.website) : '',
    };
  }

  updateCompany(data: CompanySettings): void {
    const existing = this.db
      .prepare(`SELECT id FROM companies WHERE is_default = 1 LIMIT 1`)
      .get() as { id: number } | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE companies SET
            name = ?, authorized_person = ?, phone = ?, email = ?, address = ?,
            city = ?, district = ?, tax_office = ?, tax_number = ?, logo_path = ?,
            receipt_footer_note = ?, support_phone = ?, support_email = ?, website = ?,
            updated_at = datetime('now', 'localtime')
           WHERE id = ?`
        )
        .run(
          data.name,
          data.authorized_person || null,
          data.phone || null,
          data.email || null,
          data.address || null,
          data.city || null,
          data.district || null,
          data.tax_office || null,
          data.tax_number || null,
          data.logo_path || null,
          data.receipt_footer_note || null,
          data.support_phone || null,
          data.support_email || null,
          data.website || null,
          existing.id
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO companies (
            name, authorized_person, phone, email, address, city, district,
            tax_office, tax_number, logo_path, receipt_footer_note,
            support_phone, support_email, website, is_default
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
        )
        .run(
          data.name,
          data.authorized_person || null,
          data.phone || null,
          data.email || null,
          data.address || null,
          data.city || null,
          data.district || null,
          data.tax_office || null,
          data.tax_number || null,
          data.logo_path || null,
          data.receipt_footer_note || null,
          data.support_phone || null,
          data.support_email || null,
          data.website || null
        );
    }
  }

  getSecurity(): SecuritySettings {
    const minutes = parseInt(this.getSetting('auto_lock_minutes', '0'), 10);
    return { autoLockMinutes: Number.isFinite(minutes) ? minutes : 0 };
  }

  updateSecurity(settings: SecuritySettings): void {
    this.setSetting('auto_lock_minutes', String(settings.autoLockMinutes));
  }

  getBackupSettings(): BackupSettings {
    return {
      autoBackupEnabled: this.getSetting('auto_backup_enabled') === '1',
      backupFolder: this.getSetting('backup_folder'),
      backupFrequency: (this.getSetting('backup_frequency', 'daily') as BackupSettings['backupFrequency']) || 'daily',
      lastBackupAt: this.getSetting('last_backup_at') || null,
    };
  }

  updateBackupSettings(patch: Partial<BackupSettings>): void {
    if (patch.autoBackupEnabled !== undefined) {
      this.setSetting('auto_backup_enabled', patch.autoBackupEnabled ? '1' : '0');
    }
    if (patch.backupFolder !== undefined) {
      this.setSetting('backup_folder', patch.backupFolder);
    }
    if (patch.backupFrequency !== undefined) {
      this.setSetting('backup_frequency', patch.backupFrequency);
    }
    if (patch.lastBackupAt !== undefined) {
      this.setSetting('last_backup_at', patch.lastBackupAt);
    }
  }
}
