import type { IpcMain } from 'electron';
import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDatabase, getDatabasePath, getAppDataPath } from '../database';
import { getLogsDirectory, logError } from '../services/logger.service';
import { DatabaseMaintenanceService } from '../services/databaseMaintenance.service';
import { DemoCleanupService, DemoCleanupError } from '../services/demoCleanup.service';
import { LicenseService } from '../services/license.service';
import { SettingsService } from '../services/settings.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { AuthError } from '../services/auth.service';
import { success, failure } from './utils';
import { handleUnexpectedError } from './ipcHelpers';

function readPackageVersion(): string {
  try {
    return app.getVersion();
  } catch {
    return '1.0.0';
  }
}

export function registerAppHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('app:getDbPath', () => {
    try {
      return success({ path: getDatabasePath() });
    } catch (err) {
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('app:getVersion', () => {
    return success({ version: readPackageVersion(), name: 'Woontegra Optik Desktop' });
  });

  ipcMain.handle('app:getAbout', () => {
    try {
      const db = getDatabase();
      const licenseStatus = db ? new LicenseService(db).getStatus() : null;
      const backup = db ? new SettingsService(db).getBackupSettings() : null;
      return success({
        appName: 'Woontegra Optik Desktop',
        version: readPackageVersion(),
        licenseStatus: licenseStatus?.license?.status ?? 'Lisans yok',
        licenseMasked: licenseStatus?.license?.licenseKeyMasked ?? '-',
        dbPath: getDatabasePath(),
        backupFolder: backup?.backupFolder || getAppDataPath(),
        lastBackupAt: backup?.lastBackupAt ?? null,
        supportEmail: db ? new LicenseService(db).getSupportEmail() : 'destek@woontegra.com',
        copyright: 'Woontegra Teknoloji Yazılım ve Dijital Hizmetler Ltd. Şti.',
        logsPath: getLogsDirectory(),
      });
    } catch (err) {
      logError('Uygulama', 'Hakkında bilgisi alınamadı', err);
      return failure('Uygulama bilgileri okunamadı.');
    }
  });

  ipcMain.handle('app:openLogsFolder', () => {
    try {
      const dir = getLogsDirectory();
      shell.openPath(dir);
      return success({ opened: true, path: dir });
    } catch (err) {
      logError('Uygulama', 'Log klasörü açılamadı', err);
      return failure('Log klasörü açılamadı.');
    }
  });

  ipcMain.handle('app:openDbFolder', () => {
    try {
      requirePermission(PERMISSIONS.BACKUP_MANAGE);
      const dir = path.dirname(getDatabasePath());
      shell.openPath(dir);
      return success({ opened: true, path: dir });
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      logError('Uygulama', 'Veritabanı klasörü açılamadı', err);
      return failure('Veritabanı klasörü açılamadı.');
    }
  });

  ipcMain.handle('db:integrityCheck', () => {
    try {
      requirePermission(PERMISSIONS.BACKUP_MANAGE);
      const db = getDatabase();
      if (!db) throw new Error('Veritabanı başlatılamadı');
      const result = new DatabaseMaintenanceService(db).integrityCheck();
      return success(result);
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      logError('Veritabanı', 'Bütünlük kontrolü hatası', err);
      return failure('Veritabanı bütünlük kontrolü yapılamadı.');
    }
  });

  ipcMain.handle('db:vacuum', () => {
    try {
      requirePermission(PERMISSIONS.BACKUP_MANAGE);
      const db = getDatabase();
      if (!db) throw new Error('Veritabanı başlatılamadı');
      const result = new DatabaseMaintenanceService(db).vacuum();
      return success(result);
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      logError('Veritabanı', 'VACUUM hatası', err);
      return failure('Veritabanı bakım işlemi yapılamadı.');
    }
  });

  ipcMain.handle('db:clearDemoData', () => {
    try {
      requirePermission(PERMISSIONS.BACKUP_MANAGE);
      const db = getDatabase();
      if (!db) throw new Error('Veritabanı başlatılamadı');
      const result = new DemoCleanupService(db).clearDemoData();
      return success(result);
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      if (err instanceof DemoCleanupError) return failure(err.message);
      return handleUnexpectedError('Bakım', err, 'Demo veriler temizlenemedi.');
    }
  });

  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
    return success({ relaunching: true });
  });
}
