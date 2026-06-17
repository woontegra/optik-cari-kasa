import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { CustomerService, CustomerValidationError } from '../services/customer.service';
import { requireAuth, requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError } from './ipcHelpers';
import { success, failure } from './utils';
import type { CustomerInput, CustomerListFilters, CustomerQuickInput } from '../types/customer';

function getService(): CustomerService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new CustomerService(db);
}

function handleError(err: unknown) {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof CustomerValidationError) return failure(err.message);
  return failure((err as Error).message);
}

export function registerCustomerHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('customers:list', (_event, filters?: CustomerListFilters) => {
    try {
      requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
      return success(getService().list(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:search', (_event, query: string) => {
    try {
      requireAuth();
      return success(getService().search(query));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:getById', (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
      return success(getService().getById(id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:create', (_event, input: CustomerInput) => {
    try {
      const session = requirePermission(PERMISSIONS.CUSTOMERS_EDIT);
      const result = getService().create(input);
      auditAction(session.id, 'Oluşturma', 'Müşteri', `Müşteri eklendi: ${input.full_name}`, {
        entityType: 'customer',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:createQuick', (_event, input: CustomerQuickInput) => {
    try {
      const session = requirePermission(PERMISSIONS.CUSTOMERS_EDIT);
      const result = getService().createQuick(input);
      auditAction(session.id, 'Oluşturma', 'Müşteri', `Hızlı müşteri eklendi: ${input.full_name}`, {
        entityType: 'customer',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:update', (_event, id: number, input: CustomerInput) => {
    try {
      const session = requirePermission(PERMISSIONS.CUSTOMERS_EDIT);
      const existing = getService().getById(id);
      const result = getService().update(id, input);
      auditAction(session.id, 'Güncelleme', 'Müşteri', `Müşteri güncellendi: ${input.full_name}`, {
        entityType: 'customer',
        entityId: id,
      });
      if (existing && existing.customer_category !== input.customer_category) {
        auditAction(session.id, 'Kategori Değişikliği', 'Müşteri', `Kategori: ${input.customer_category || '-'}`, {
          entityType: 'customer',
          entityId: id,
        });
      }
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:deactivate', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.CUSTOMERS_EDIT);
      if (session.role === 'Satış Personeli') {
        return failure('Satış personeli müşteri pasife alamaz.');
      }
      const result = getService().deactivate(id);
      auditAction(session.id, 'Pasife alma', 'Müşteri', `Müşteri pasife alındı #${id}`, {
        entityType: 'customer',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:getSales', (_event, customerId: number) => {
    try {
      requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
      return success(getService().getSalesByCustomer(customerId));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:getAccountMovements', (_event, customerId: number) => {
    try {
      requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
      return success(getService().getAccountMovements(customerId));
    } catch (err) {
      return handleError(err);
    }
  });
}
