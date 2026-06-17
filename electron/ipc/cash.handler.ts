import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { CashService, CashValidationError } from '../services/cash.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError } from './ipcHelpers';
import { success, failure } from './utils';
import type { AddCashExpenseInput, AddCashIncomeInput } from '../types/sale';

function getService(): CashService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new CashService(db);
}

function handleError(err: unknown) {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof CashValidationError) return failure(err.message);
  return failure((err as Error).message);
}

export function registerCashHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('cash:getSummary', () => {
    try {
      requirePermission(PERMISSIONS.CASH_VIEW);
      return success(getService().getSummary());
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('cash:listMovements', (_event, filters?: { date_from?: string; date_to?: string }) => {
    try {
      requirePermission(PERMISSIONS.CASH_VIEW);
      return success(getService().listMovements(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('cash:addIncome', (_event, input: AddCashIncomeInput) => {
    try {
      const session = requirePermission(PERMISSIONS.CASH_EDIT);
      const result = getService().addIncome(input);
      auditAction(session.id, 'Tahsilat', 'Kasa', `Gelir eklendi: ${input.amount}`, {
        entityType: 'cash_movement',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('cash:addExpense', (_event, input: AddCashExpenseInput) => {
    try {
      const session = requirePermission(PERMISSIONS.CASH_EDIT);
      const result = getService().addExpense(input);
      auditAction(session.id, 'Gider', 'Kasa', `Gider eklendi: ${input.description}`, {
        entityType: 'cash_movement',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('cash:list', () => {
    try {
      requirePermission(PERMISSIONS.CASH_VIEW);
      return success(getService().listMovements());
    } catch (err) {
      return handleError(err);
    }
  });
}
