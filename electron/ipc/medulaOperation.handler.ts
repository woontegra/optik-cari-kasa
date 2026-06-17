import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import { MedulaOperationService, MedulaOperationError } from '../services/medulaOperation.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success, failure } from './utils';
import type {
  MedulaEnterInfoInput,
  MedulaOperationHistoryFilters,
  MedulaReportFilters,
  SgkPrescriptionListFilters,
} from '../types/medulaOperation';
import type { MedulaListFilters } from '../types/medula';

function getService(): MedulaOperationService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new MedulaOperationService(db);
}

function handleError(err: unknown, userMessage = 'Medula işlemi yapılamadı.') {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof MedulaOperationError) return failure(err.message);
  return handleUnexpectedError('Medula', err, userMessage);
}

export function registerMedulaOperationHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {
  ipcMain.handle('medula:listPending', (_event, filters?: MedulaListFilters) => {
    try {
      requirePermission(PERMISSIONS.MEDULA_VIEW);
      return success(getService().listPendingExport({ ...filters, only_institution: true }));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('medula:validateRows', (_event, saleIds: number[]) => {
    try {
      requirePermission(PERMISSIONS.MEDULA_VIEW);
      return success(getService().validateRows(saleIds));
    } catch (err) {
      return handleError(err, 'Doğrulama yapılamadı.');
    }
  });

  ipcMain.handle('medula:markProcessed', (_event, saleIds: number[]) => {
    try {
      const session = requirePermission(PERMISSIONS.MEDULA_MARK_PROCESSED);
      const result = getService().markProcessed(saleIds, session.id);
      auditAction(session.id, 'Medula\'ya İşlendi', 'Medula', `${result.updated} kayıt`, { entityType: 'medula' });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('medula:enterMedulaInfo', (_event, input: MedulaEnterInfoInput) => {
    try {
      const session = requirePermission(PERMISSIONS.MEDULA_EDIT);
      const result = getService().enterMedulaInfo(input, session.id);
      auditAction(session.id, 'Medula Bilgisi Girildi', 'Medula', `Satış #${input.sale_id}`, {
        entityType: 'sale',
        entityId: input.sale_id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('medula:listOperations', (_event, filters?: MedulaOperationHistoryFilters) => {
    try {
      requirePermission(PERMISSIONS.MEDULA_VIEW);
      return success(getService().listOperations(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('medula:getOperationDetail', (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.MEDULA_VIEW);
      return success(getService().getOperationDetail(id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('medula:getReport', (_event, filters?: MedulaReportFilters) => {
    try {
      requirePermission(PERMISSIONS.MEDULA_VIEW);
      return success(getService().getReport(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('medula:listSgkPrescriptions', (_event, filters?: SgkPrescriptionListFilters) => {
    try {
      requirePermission(PERMISSIONS.SGK_VIEW);
      return success(getService().listSgkPrescriptions(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('medula:markInvoiceReady', (_event, saleIds: number[]) => {
    try {
      const session = requirePermission(PERMISSIONS.MEDULA_MARK_PROCESSED);
      const result = getService().markInvoiceReady(saleIds, session.id);
      auditAction(session.id, 'Faturaya Hazır', 'Medula', `${result.updated} kayıt`, { entityType: 'medula' });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('medula:markIgnored', (_event, saleIds: number[]) => {
    try {
      const session = requirePermission(PERMISSIONS.MEDULA_EDIT);
      return success(getService().markIgnored(saleIds, session.id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('medula:exportSgkExcel', async (_event, saleIds: number[]) => {
    try {
      requirePermission(PERMISSIONS.MEDULA_EXPORT);
      const result = await dialogModule.showSaveDialog({
        title: 'SGK Reçete Listesi Kaydet',
        defaultPath: `sgk-receteler-${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return success({ exported: false });
      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;
      const data = getService().exportSgkPrescriptionsExcel(saleIds, filePath);
      return success({ exported: true, filePath, ...data });
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('medula:getDashboardStats', () => {
    try {
      requirePermission(PERMISSIONS.DASHBOARD_VIEW);
      return success(getService().getDashboardStats());
    } catch (err) {
      return handleError(err);
    }
  });
}
