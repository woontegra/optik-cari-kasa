import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { OpticalLookupService, OpticalLookupError } from '../services/opticalLookup.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success, failure } from './utils';
import type { OpticalLookupInput, OpticalLookupListFilters, OpticalLookupType } from '../types/opticalLookup';

function getService(): OpticalLookupService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new OpticalLookupService(db);
}

function handleLookupError(err: unknown, userMessage = 'Optik tanım işlemi yapılamadı.') {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof OpticalLookupError) return failure(err.message);
  return handleUnexpectedError('OptikTanım', err, userMessage);
}

export function registerOpticalLookupHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('opticalLookups:list', (_event, filters?: OpticalLookupListFilters) => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().list(filters));
    } catch (err) {
      return handleLookupError(err, 'Tanımlar listelenemedi.');
    }
  });

  ipcMain.handle('opticalLookups:listByType', (_event, type: OpticalLookupType) => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().listByType(type));
    } catch (err) {
      return handleLookupError(err);
    }
  });

  ipcMain.handle('opticalLookups:listChildren', (_event, parentId: number) => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().listChildren(parentId));
    } catch (err) {
      return handleLookupError(err);
    }
  });

  ipcMain.handle('opticalLookups:create', (_event, input: OpticalLookupInput) => {
    try {
      const session = requirePermission(PERMISSIONS.SETTINGS_EDIT);
      const result = getService().create(input);
      auditAction(session.id, 'Optik Tanım Oluşturuldu', 'Stok', `${input.type}: ${input.name}`, {
        entityType: 'optical_lookup',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleLookupError(err, 'Tanım eklenemedi.');
    }
  });

  ipcMain.handle('opticalLookups:update', (_event, id: number, input: Partial<OpticalLookupInput>) => {
    try {
      const session = requirePermission(PERMISSIONS.SETTINGS_EDIT);
      const result = getService().update(id, input);
      auditAction(session.id, 'Optik Tanım Düzenlendi', 'Stok', `Tanım #${id}`, {
        entityType: 'optical_lookup',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleLookupError(err, 'Tanım güncellenemedi.');
    }
  });

  ipcMain.handle('opticalLookups:deactivate', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.SETTINGS_EDIT);
      const result = getService().deactivate(id);
      auditAction(session.id, 'Optik Tanım Pasife Alındı', 'Stok', `Tanım #${id}`, {
        entityType: 'optical_lookup',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleLookupError(err, 'Tanım pasife alınamadı.');
    }
  });

  ipcMain.handle('opticalLookups:reorder', (_event, ids: number[]) => {
    try {
      requirePermission(PERMISSIONS.SETTINGS_EDIT);
      getService().reorder(ids);
      return success({ ok: true });
    } catch (err) {
      return handleLookupError(err);
    }
  });

  ipcMain.handle('opticalLookups:logTranspose', (_event, payload: Record<string, unknown>) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_VIEW);
      auditAction(
        session.id,
        'Transpoze İşlemi',
        'Stok',
        `SPH ${payload.sph} CYL ${payload.cyl} AXIS ${payload.axis} → SPH ${(payload.result as Record<string, string>)?.sph}`,
        { entityType: 'optical_transpose' }
      );
      return success({ ok: true });
    } catch (err) {
      return handleLookupError(err);
    }
  });
}
