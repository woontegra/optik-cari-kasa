import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import { BackupService, BackupError } from '../services/backup.service';
import { AuthError } from '../services/auth.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { success, failure } from './utils';

function getService(): BackupService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new BackupService(db);
}

export function registerBackupHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {
  ipcMain.handle('backup:getSettings', () => {
    try {
      return success(getService().getSettings());
    } catch (err) {
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('backup:setAutoBackup', (_event, enabled: boolean) => {
    try {
      requirePermission(PERMISSIONS.BACKUP_MANAGE);
      getService().setAutoBackup(enabled);
      return success({ saved: true });
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('backup:setFrequency', (_event, frequency: 'on_close' | 'daily' | 'weekly') => {
    try {
      requirePermission(PERMISSIONS.BACKUP_MANAGE);
      getService().setBackupFrequency(frequency);
      return success({ saved: true });
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('backup:selectFolder', async () => {
    try {
      requirePermission(PERMISSIONS.BACKUP_MANAGE);
      const result = await dialogModule.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Yedek Klasörü Seç',
      });
      if (result.canceled || !result.filePaths[0]) {
        return success({ folder: null });
      }
      const folder = result.filePaths[0];
      getService().setBackupFolder(folder);
      return success({ folder });
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('backup:create', (_event, targetFolder?: string) => {
    try {
      const session = requirePermission(PERMISSIONS.BACKUP_MANAGE);
      const result = getService().createBackup(targetFolder, 'manual', session.id);
      return success(result);
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('backup:restore', async (_event, filePath?: string) => {
    try {
      const session = requirePermission(PERMISSIONS.BACKUP_MANAGE);
      let sourcePath = filePath;
      if (!sourcePath) {
        const result = await dialogModule.showOpenDialog({
          properties: ['openFile'],
          title: 'Yedek Dosyası Seç',
          filters: [{ name: 'SQLite', extensions: ['sqlite', 'db'] }],
        });
        if (result.canceled || !result.filePaths[0]) {
          return success({ restored: false });
        }
        sourcePath = result.filePaths[0];
      }
      const restoreResult = getService().restoreFromFile(sourcePath, session.id);
      return success({
        restored: true,
        message: 'Yedek geri yüklendi. Uygulama yeniden başlatılacak.',
        safetyBackupPath: restoreResult.safetyBackupPath,
        needsRestart: true,
      });
    } catch (err) {
      if (err instanceof AuthError || err instanceof BackupError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('backup:list', () => {
    try {
      requirePermission(PERMISSIONS.BACKUP_MANAGE);
      return success(getService().list());
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });
}
