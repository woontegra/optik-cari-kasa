import type { IpcMain, Dialog } from 'electron';
import { getDatabase } from '../database';
import { BankService, BankValidationError } from '../services/bank.service';
import { PosService, PosValidationError } from '../services/pos.service';
import { ExpenseService, ExpenseValidationError } from '../services/expense.service';
import { StatementService } from '../services/statement.service';
import { ProfitLossService } from '../services/profitLoss.service';
import { ReportService } from '../services/report.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError } from './ipcHelpers';
import { success, failure } from './utils';
import type {
  BankAccountInput,
  BankMovementInput,
  ExpenseInput,
  PersonnelExpenseInput,
  PosAccountInput,
  ProfitLossFilter,
  StatementFilter,
} from '../types/finance';

function db() {
  const database = getDatabase();
  if (!database) throw new Error('Veritabanı başlatılamadı');
  return database;
}

function handleError(err: unknown) {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof BankValidationError || err instanceof PosValidationError || err instanceof ExpenseValidationError) {
    return failure(err.message);
  }
  return failure((err as Error).message);
}

export function registerFinanceHandlers(ipcMain: IpcMain, dialog: Dialog): void {
  ipcMain.handle('banks:listAccounts', (_e, activeOnly = true) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new BankService(db()).listAccounts(activeOnly));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('banks:createAccount', (_e, input: BankAccountInput) => {
    try {
      const session = requirePermission(PERMISSIONS.FINANCE_EDIT);
      const result = new BankService(db()).createAccount(input);
      auditAction(session.id, 'Oluşturma', 'Banka', `Banka hesabı: ${input.account_name}`, {
        entityType: 'bank_account',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('banks:updateAccount', (_e, id: number, input: Partial<BankAccountInput>) => {
    try {
      const session = requirePermission(PERMISSIONS.FINANCE_EDIT);
      const result = new BankService(db()).updateAccount(id, input);
      auditAction(session.id, 'Güncelleme', 'Banka', `Banka hesabı güncellendi: #${id}`, {
        entityType: 'bank_account',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('banks:addMovement', (_e, input: BankMovementInput) => {
    try {
      const session = requirePermission(PERMISSIONS.FINANCE_EDIT);
      const result = new BankService(db()).addMovement(input, session.id);
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('banks:listMovements', (_e, filters?: { bank_account_id?: number; date_from?: string; date_to?: string }) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new BankService(db()).listMovements(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('banks:transferCashToBank', (_e, payload: { bank_account_id: number; amount: number; description?: string }) => {
    try {
      const session = requirePermission(PERMISSIONS.CASH_EDIT);
      const result = new BankService(db()).transferCashToBank(
        payload.bank_account_id,
        payload.amount,
        payload.description || 'Kasadan bankaya aktarım',
        session.id
      );
      auditAction(session.id, 'Aktarım', 'Kasa-Banka', `Kasadan bankaya: ${payload.amount}`, {
        entityType: 'bank_movement',
        entityId: result.bankMovementId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('banks:transferBankToCash', (_e, payload: { bank_account_id: number; amount: number; description?: string }) => {
    try {
      const session = requirePermission(PERMISSIONS.CASH_EDIT);
      const result = new BankService(db()).transferBankToCash(
        payload.bank_account_id,
        payload.amount,
        payload.description || 'Bankadan kasaya aktarım',
        session.id
      );
      auditAction(session.id, 'Aktarım', 'Kasa-Banka', `Bankadan kasaya: ${payload.amount}`, {
        entityType: 'bank_movement',
        entityId: result.bankMovementId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('pos:listAccounts', (_e, activeOnly = true) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new PosService(db()).listAccounts(activeOnly));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('pos:createAccount', (_e, input: PosAccountInput) => {
    try {
      const session = requirePermission(PERMISSIONS.FINANCE_EDIT);
      const result = new PosService(db()).createAccount(input);
      auditAction(session.id, 'Oluşturma', 'POS', `POS hesabı: ${input.name}`, {
        entityType: 'pos_account',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('pos:updateAccount', (_e, id: number, input: Partial<PosAccountInput>) => {
    try {
      const session = requirePermission(PERMISSIONS.FINANCE_EDIT);
      const result = new PosService(db()).updateAccount(id, input);
      auditAction(session.id, 'Güncelleme', 'POS', `POS hesabı güncellendi: #${id}`, {
        entityType: 'pos_account',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('pos:listMovements', (_e, filters?: Record<string, unknown>) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new PosService(db()).listMovements(filters as never));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('expenses:list', (_e, filters?: Record<string, unknown>) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new ExpenseService(db()).list(filters as never));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('expenses:create', (_e, input: ExpenseInput) => {
    try {
      const session = requirePermission(PERMISSIONS.FINANCE_EDIT);
      const result = new ExpenseService(db()).create(input, session.id);
      auditAction(session.id, 'Oluşturma', 'Gider', input.description, {
        entityType: 'expense',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('expenses:createPersonnel', (_e, input: PersonnelExpenseInput) => {
    try {
      const session = requirePermission(PERMISSIONS.FINANCE_EDIT);
      const result = new ExpenseService(db()).createPersonnel(input, session.id);
      auditAction(session.id, 'Oluşturma', 'Personel Gideri', `${input.personnel_name} - ${input.expense_type}`, {
        entityType: 'personnel_expense',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('expenses:cancel', (_e, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.FINANCE_EDIT);
      const result = new ExpenseService(db()).cancel(id, session.id);
      auditAction(session.id, 'İptal', 'Gider', `Gider iptal: #${id}`, {
        entityType: 'expense',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('statements:getCustomer', (_e, customerId: number, filter?: StatementFilter) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new StatementService(db()).getCustomer(customerId, filter));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('statements:getSupplier', (_e, supplierId: number, filter?: StatementFilter) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new StatementService(db()).getSupplier(supplierId, filter));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('statements:getCash', (_e, filter?: StatementFilter) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new StatementService(db()).getCash(filter));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('statements:getBank', (_e, bankAccountId: number, filter?: StatementFilter) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new StatementService(db()).getBank(bankAccountId, filter));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('statements:getPos', (_e, posAccountId: number, filter?: StatementFilter) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new StatementService(db()).getPos(posAccountId, filter));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('statements:print', (_e, payload: { title: string; subtitle: string; rows: Record<string, unknown>[] }) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      const rows = payload.rows as import('../services/statement.service').StatementRow[];
      return success(new StatementService(db()).buildPrintHtml(payload.title, payload.subtitle, rows));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('profitLoss:getSummary', (_e, filter?: ProfitLossFilter) => {
    try {
      const session = requirePermission(PERMISSIONS.FINANCE_VIEW);
      auditAction(session.id, 'Rapor', 'Kâr-Zarar', 'Kâr-zarar özeti alındı');
      return success(new ProfitLossService(db()).getSummary(filter));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('profitLoss:getDetail', (_e, filter?: ProfitLossFilter) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      return success(new ProfitLossService(db()).getDetail(filter));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('profitLoss:exportExcel', async (_e, payload: { fileName: string; rows: Record<string, unknown>[] }) => {
    try {
      requirePermission(PERMISSIONS.EXCEL_EXPORT);
      const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: payload.fileName,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (canceled || !filePath) return success({ exported: false });
      new ReportService(db()).exportExcel(filePath, payload.rows, 'Kâr-Zarar');
      return success({ exported: true, filePath });
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('profitLoss:print', (_e, payload: { title: string; subtitle: string; rows: Record<string, unknown>[] }) => {
    try {
      requirePermission(PERMISSIONS.FINANCE_VIEW);
      const rows = payload.rows as import('../services/statement.service').StatementRow[];
      return success(new StatementService(db()).buildPrintHtml(payload.title, payload.subtitle, rows));
    } catch (err) {
      return handleError(err);
    }
  });
}
