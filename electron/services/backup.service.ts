import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { getAppDataPath, getDatabase, getDatabasePath } from '../database';
import { SettingsService } from './settings.service';
import { AuditService } from './audit.service';

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

function formatBackupFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `woontegra-optik-yedek-${date}-${time}.sqlite`;
}

export class BackupService {
  private settings: SettingsService;
  private audit: AuditService;

  constructor(private db: Database.Database) {
    this.settings = new SettingsService(db);
    this.audit = new AuditService(db);
  }

  getSettings() {
    const backup = this.settings.getBackupSettings();
    return {
      ...backup,
      dbPath: getDatabasePath(),
    };
  }

  setAutoBackup(enabled: boolean): void {
    this.settings.updateBackupSettings({ autoBackupEnabled: enabled });
  }

  setBackupFolder(folder: string): void {
    this.settings.updateBackupSettings({ backupFolder: folder });
  }

  setBackupFrequency(frequency: 'on_close' | 'daily' | 'weekly'): void {
    this.settings.updateBackupSettings({ backupFrequency: frequency });
  }

  createBackup(targetFolder?: string, backupType = 'manual', userId?: number): { backupPath: string; size: number } {
    const dbPath = getDatabasePath();
    const folder = targetFolder || this.settings.getBackupSettings().backupFolder || getAppDataPath();
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const backupPath = path.join(folder, formatBackupFileName());
    fs.copyFileSync(dbPath, backupPath);
    const stats = fs.statSync(backupPath);

    this.db
      .prepare(`INSERT INTO backups (file_path, file_size, backup_type) VALUES (?, ?, ?)`)
      .run(backupPath, stats.size, backupType);

    this.settings.updateBackupSettings({ lastBackupAt: new Date().toISOString() });
    this.audit.log(userId ?? null, 'Yedek alma', 'Yedekleme', `Yedek oluşturuldu: ${path.basename(backupPath)}`, {
      entityType: 'backup',
    });

    return { backupPath, size: stats.size };
  }

  createSafetyBackup(): string {
    const safetyFolder = path.join(getAppDataPath(), 'safety-backups');
    const result = this.createBackup(safetyFolder, 'safety');
    return result.backupPath;
  }

  restoreFromFile(sourcePath: string, userId?: number): { restored: boolean; safetyBackupPath: string } {
    if (!fs.existsSync(sourcePath)) {
      throw new BackupError('Yedek dosyası bulunamadı.');
    }

    const safetyPath = this.createSafetyBackup();
    const dbPath = getDatabasePath();
    const database = getDatabase();
    if (database) {
      database.close();
    }

    fs.copyFileSync(sourcePath, dbPath);
    this.audit.log(userId ?? null, 'Geri yükleme', 'Yedekleme', `Yedekten geri yüklendi: ${path.basename(sourcePath)}`, {
      entityType: 'backup',
    });

    return { restored: true, safetyBackupPath: safetyPath };
  }

  list(): Record<string, unknown>[] {
    return this.db.prepare(`SELECT * FROM backups ORDER BY created_at DESC LIMIT 50`).all() as Record<string, unknown>[];
  }

  shouldRunAutoBackup(trigger: 'on_close' | 'daily' | 'weekly'): boolean {
    const settings = this.settings.getBackupSettings();
    if (!settings.autoBackupEnabled) return false;
    if (settings.backupFrequency !== trigger) return false;

    if (trigger === 'on_close') return true;

    const last = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
    if (!last) return true;

    const now = Date.now();
    const diffHours = (now - last.getTime()) / (1000 * 60 * 60);
    if (trigger === 'daily') return diffHours >= 24;
    if (trigger === 'weekly') return diffHours >= 24 * 7;
    return false;
  }

  runAutoBackupIfNeeded(trigger: 'on_close' | 'daily' | 'weekly'): boolean {
    if (!this.shouldRunAutoBackup(trigger)) return false;
    const folder = this.settings.getBackupSettings().backupFolder || getAppDataPath();
    this.createBackup(folder, `auto_${trigger}`);
    return true;
  }
}
