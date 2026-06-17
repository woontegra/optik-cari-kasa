import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { AuditService } from '../services/audit.service';
import { AuthError } from '../services/auth.service';
import { requireAuth } from './authGuard';
import { success, failure } from './utils';
import type { AuditListFilters } from '../types/audit';

function getService(): AuditService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new AuditService(db);
}

export function registerAuditHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('audit:list', (_event, filters?: AuditListFilters) => {
    try {
      requireAuth();
      return success(getService().list(filters));
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });
}
