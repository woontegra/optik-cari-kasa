import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import {
  InstitutionReceivableService,
  InstitutionReceivableError,
} from '../services/institutionReceivable.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success, failure } from './utils';
import type { InstitutionReceivableListFilters } from '../types/institutionReceivable';

function getService(): InstitutionReceivableService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new InstitutionReceivableService(db);
}

function handleError(err: unknown, userMessage = 'Kurum alacağı işlemi yapılamadı.') {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof InstitutionReceivableError) return failure(err.message);
  return handleUnexpectedError('Kurum Alacağı', err, userMessage);
}

export function registerInstitutionReceivableHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('institutionReceivables:list', (_event, filters?: InstitutionReceivableListFilters) => {
    try {
      requirePermission(PERMISSIONS.SGK_VIEW);
      return success(getService().list(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('institutionReceivables:updateStatus', (_event, id: number, status: string) => {
    try {
      const session = requirePermission(PERMISSIONS.SGK_EDIT);
      const result = getService().updateStatus(id, status as import('../types/institutionReceivable').InstitutionReceivableStatus);
      auditAction(session.id, 'Kurum Alacağı Güncellendi', 'SGK', `Durum: ${status} #${id}`, {
        entityType: 'institution_receivable',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('institutionReceivables:markCollected', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.SGK_EDIT);
      const result = getService().markCollected(id);
      auditAction(session.id, 'Kurum Alacağı Tahsil Edildi', 'SGK', `#${id}`, {
        entityType: 'institution_receivable',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });
}
