import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { LabelService } from '../services/label.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { handleUnexpectedError } from './ipcHelpers';
import { success } from './utils';
import type { LabelPreviewInput, LabelSettings } from '../types/label';

function getService(): LabelService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new LabelService(db);
}

export function registerLabelHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('labels:preview', (_event, input: LabelPreviewInput) => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().preview(input));
    } catch (err) {
      return handleUnexpectedError('Etiket', err, 'Etiket önizlemesi oluşturulamadı.');
    }
  });

  ipcMain.handle('labels:print', (_event, input: LabelPreviewInput) => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().print(input));
    } catch (err) {
      return handleUnexpectedError('Etiket', err, 'Etiket yazdırılamadı.');
    }
  });
}

export function registerLabelSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings:getLabelSettings', () => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().getSettings());
    } catch (err) {
      return handleUnexpectedError('Ayarlar', err, 'Etiket ayarları okunamadı.');
    }
  });

  ipcMain.handle('settings:updateLabelSettings', (_event, settings: Partial<LabelSettings>) => {
    try {
      requirePermission(PERMISSIONS.SETTINGS_EDIT);
      getService().updateSettings(settings);
      return success({ saved: true });
    } catch (err) {
      return handleUnexpectedError('Ayarlar', err, 'Etiket ayarları kaydedilemedi.');
    }
  });
}
