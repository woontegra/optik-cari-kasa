import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import { TitubbExportService, TitubbExportError } from '../services/titubbExport.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success, failure } from './utils';
import type { TitubbExportInput, TitubbListFilters, TitubbMarkIgnoredInput } from '../types/titubb';

function getService(): TitubbExportService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new TitubbExportService(db);
}

function handleTitubbError(err: unknown, userMessage = 'TİTUBB işlemi yapılamadı.') {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof TitubbExportError) return failure(err.message);
  return handleUnexpectedError('TİTUBB', err, userMessage);
}

export function registerTitubbHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {
  ipcMain.handle('titubb:listPending', (_event, filters?: TitubbListFilters) => {
    try {
      requirePermission(PERMISSIONS.MEDULA_VIEW);
      return success(getService().listPending(filters));
    } catch (err) {
      return handleTitubbError(err, 'Bildirilecek ürünler listelenemedi.');
    }
  });

  ipcMain.handle('titubb:validateRows', (_event, rowKeys: string[]) => {
    try {
      requirePermission(PERMISSIONS.MEDULA_VIEW);
      return success(getService().validateRows(rowKeys));
    } catch (err) {
      return handleTitubbError(err, 'Doğrulama yapılamadı.');
    }
  });

  ipcMain.handle('titubb:exportExcel', async (_event, input: TitubbExportInput) => {
    try {
      const session = requirePermission(PERMISSIONS.MEDULA_EXPORT);
      const result = await dialogModule.showSaveDialog({
        title: 'TİTUBB Bildirimi Excel Kaydet',
        defaultPath: getService().getDefaultFileName(),
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return success({ exported: false });
      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;
      const data = getService().exportExcel(input, filePath, session.id);
      auditAction(
        session.id,
        'TİTUBB Excel Oluşturuldu',
        'ÜTS',
        `TİTUBB dışa aktarım: ${data.exportNo} (${data.recordCount} kayıt)`,
        { entityType: 'uts_titubb_export', entityId: data.exportId }
      );
      return success({ exported: true, ...data });
    } catch (err) {
      return handleTitubbError(err, 'Excel dosyası oluşturulamadı.');
    }
  });

  ipcMain.handle('titubb:listExports', () => {
    try {
      requirePermission(PERMISSIONS.MEDULA_VIEW);
      return success(getService().listExports());
    } catch (err) {
      return handleTitubbError(err, 'Dışa aktarım geçmişi alınamadı.');
    }
  });

  ipcMain.handle('titubb:getExportDetail', (_event, exportId: number) => {
    try {
      requirePermission(PERMISSIONS.MEDULA_VIEW);
      return success(getService().getExportDetail(exportId));
    } catch (err) {
      return handleTitubbError(err, 'Dışa aktarım detayı alınamadı.');
    }
  });

  ipcMain.handle('titubb:markUploaded', (_event, exportId: number) => {
    try {
      const session = requirePermission(PERMISSIONS.MEDULA_EXPORT);
      const result = getService().markUploaded(exportId, session.id);
      auditAction(
        session.id,
        'TİTUBB ÜTS Yüklendi',
        'ÜTS',
        `TİTUBB dışa aktarım ÜTS'ye yüklendi: #${exportId}`,
        { entityType: 'uts_titubb_export', entityId: exportId }
      );
      return success(result);
    } catch (err) {
      return handleTitubbError(err, 'Yüklendi işaretlenemedi.');
    }
  });

  ipcMain.handle('titubb:markIgnored', (_event, input: TitubbMarkIgnoredInput) => {
    try {
      const session = requirePermission(PERMISSIONS.MEDULA_EXPORT);
      const result = getService().markIgnored(input);
      auditAction(session.id, 'TİTUBB İşlem Dışı', 'ÜTS', `${result.ignored} kayıt işlem dışı bırakıldı`);
      return success(result);
    } catch (err) {
      return handleTitubbError(err, 'İşlem dışı kaydedilemedi.');
    }
  });

  ipcMain.handle('titubb:countPending', () => {
    try {
      requirePermission(PERMISSIONS.DASHBOARD_VIEW);
      return success({ count: getService().countPending() });
    } catch (err) {
      return handleTitubbError(err, 'Bekleyen sayı alınamadı.');
    }
  });
}
