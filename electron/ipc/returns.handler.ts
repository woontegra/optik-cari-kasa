import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { ReturnService, ReturnValidationError } from '../services/return.service';
import { SaleService } from '../services/sale.service';
import { requireAuth, requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError } from './ipcHelpers';
import { success, failure } from './utils';
import type { CreateReturnInput, ReturnListFilters } from '../types/return';

function getReturnService(): ReturnService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new ReturnService(db);
}

function getSaleService(): SaleService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new SaleService(db);
}

function handleError(err: unknown) {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof ReturnValidationError) return failure(err.message);
  return failure((err as Error).message);
}

export function registerReturnHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('returns:list', (_event, filters?: ReturnListFilters) => {
    try {
      requireAuth();
      return success(getReturnService().list(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('returns:getById', (_event, id: number) => {
    try {
      requireAuth();
      return success(getReturnService().getById(id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('returns:create', (_event, input: CreateReturnInput) => {
    try {
      const session = requirePermission(PERMISSIONS.RETURNS_CREATE);
      const result = getReturnService().create(input);
      auditAction(session.id, 'Oluşturma', 'İade', `İade oluşturuldu: ${result.returnNo}`, {
        entityType: 'return',
        entityId: result.returnId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('returns:listBySale', (_event, saleId: number) => {
    try {
      requireAuth();
      return success(getReturnService().listBySale(saleId));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('returns:searchSale', (_event, query: string) => {
    try {
      requirePermission(PERMISSIONS.RETURNS_CREATE);
      return success(getSaleService().searchForReturn(query));
    } catch (err) {
      return handleError(err);
    }
  });
}
