import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { ProductService, ProductValidationError } from '../services/product.service';
import { requireAuth, requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError } from './ipcHelpers';
import { success, failure } from './utils';
import type { ProductInput, ProductListFilters } from '../types/product';

function getService(): ProductService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new ProductService(db);
}

function handleError(err: unknown) {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof ProductValidationError) return failure(err.message);
  return failure((err as Error).message);
}

export function registerProductHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('products:list', (_event, filters?: ProductListFilters) => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().list(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('products:getById', (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().getById(id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('products:findByBarcode', (_event, barcode: string, activeOnly = false) => {
    try {
      requireAuth();
      return success(getService().findByBarcode(barcode, activeOnly));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('products:resolveScan', (_event, rawCode: string, activeOnly = false) => {
    try {
      requireAuth();
      return success(getService().resolveScan(rawCode, activeOnly));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('products:create', (_event, input: ProductInput) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const result = getService().create(input);
      const actionLabel = input.stock_quantity === 0 ? 'Hızlı ürün oluşturuldu' : 'Ürün eklendi';
      auditAction(session.id, 'Oluşturma', 'Stok', `${actionLabel}: ${input.name}`, {
        entityType: 'product',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('products:update', (_event, id: number, input: ProductInput) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const result = getService().update(id, input);
      auditAction(session.id, 'Güncelleme', 'Stok', `Ürün optik bilgileri güncellendi: ${input.name}`, {
        entityType: 'product',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('products:deactivate', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_DELETE);
      const result = getService().deactivate(id);
      auditAction(session.id, 'Pasife alma', 'Stok', `Ürün pasife alındı #${id}`, {
        entityType: 'product',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('products:delete', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_DELETE);
      const result = getService().delete(id);
      auditAction(session.id, 'Silme', 'Stok', `Ürün silindi #${id}`, {
        entityType: 'product',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });
}
