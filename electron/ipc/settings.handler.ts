import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import { SettingsService, type CompanySettings } from '../services/settings.service';
import { AuditService } from '../services/audit.service';
import { AuthError } from '../services/auth.service';
import { requireAuth, requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { success, failure } from './utils';
import type { SecuritySettings } from '../types/auth';
import { getDatabasePath } from '../database';

function getSettingsService(): SettingsService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new SettingsService(db);
}

function getAuditService(): AuditService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new AuditService(db);
}

export function registerCompanyHandlers(ipcMain: IpcMain, dialogModule?: typeof dialog): void {
  ipcMain.handle('settings:getCompany', () => {
    try {
      requireAuth();
      return success(getSettingsService().getCompany());
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('settings:updateCompany', (_event, data: CompanySettings) => {
    try {
      const session = requirePermission(PERMISSIONS.SETTINGS_EDIT);
      getSettingsService().updateCompany(data);
      getAuditService().log(session.id, 'Güncelleme', 'Firma', 'Firma bilgileri güncellendi', {
        entityType: 'company',
      });
      return success({ saved: true });
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('settings:selectLogo', async () => {
    try {
      requirePermission(PERMISSIONS.SETTINGS_EDIT);
      if (!dialogModule) return failure('Dialog modülü kullanılamıyor.');
      const result = await dialogModule.showOpenDialog({
        title: 'Logo Seç',
        filters: [{ name: 'Görsel', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths[0]) {
        return success({ path: null });
      }
      return success({ path: result.filePaths[0] });
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  // Legacy channels
  ipcMain.handle('company:get', () => {
    try {
      requireAuth();
      return success(getSettingsService().getCompany());
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('company:update', (_event, data: Record<string, unknown>) => {
    try {
      const session = requirePermission(PERMISSIONS.SETTINGS_EDIT);
      getSettingsService().updateCompany(data as CompanySettings);
      getAuditService().log(session.id, 'Güncelleme', 'Firma', 'Firma bilgileri güncellendi');
      return success({ saved: true });
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });
}

export function registerSecurityHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings:getSecurity', () => {
    try {
      requireAuth();
      return success(getSettingsService().getSecurity());
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('settings:updateSecurity', (_event, settings: SecuritySettings) => {
    try {
      const session = requirePermission(PERMISSIONS.SETTINGS_EDIT);
      getSettingsService().updateSecurity(settings);
      getAuditService().log(session.id, 'Güncelleme', 'Ayarlar', 'Güvenlik ayarları güncellendi');
      return success({ saved: true });
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });
}

export function registerSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings:getAll', () => {
    try {
      requireAuth();
      const db = getDatabase();
      if (!db) throw new Error('Veritabanı başlatılamadı');
      const rows = db.prepare('SELECT key, value FROM app_settings').all();
      const settings: Record<string, string> = {};
      for (const row of rows as { key: string; value: string }[]) {
        settings[row.key] = row.value;
      }
      return success(settings);
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });
}
