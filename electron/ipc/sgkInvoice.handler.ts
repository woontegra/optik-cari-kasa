import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import { SgkInvoiceService, SgkInvoiceError } from '../services/sgkInvoice.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success, failure } from './utils';
import type { SgkCreateBatchInput, SgkInvoiceListFilters, SgkInvoiceReadyFilters } from '../types/sgkInvoice';

function getService(): SgkInvoiceService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new SgkInvoiceService(db);
}

function handleError(err: unknown, userMessage = 'SGK fatura işlemi yapılamadı.') {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof SgkInvoiceError) return failure(err.message);
  return handleUnexpectedError('SGK Fatura', err, userMessage);
}

export function registerSgkInvoiceHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {
  ipcMain.handle('sgkInvoices:listReady', (_event, filters?: SgkInvoiceReadyFilters) => {
    try {
      requirePermission(PERMISSIONS.SGK_VIEW);
      return success(getService().listInvoiceReady(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sgkInvoices:createBatch', (_event, input: SgkCreateBatchInput) => {
    try {
      const session = requirePermission(PERMISSIONS.SGK_EDIT);
      const result = getService().createBatch(input, session.id);
      auditAction(session.id, 'SGK Fatura Hazırlık Listesi', 'SGK', result.batchNo, {
        entityType: 'sgk_invoice_batch',
        entityId: result.batchId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sgkInvoices:listBatches', (_event, filters?: SgkInvoiceListFilters) => {
    try {
      requirePermission(PERMISSIONS.SGK_VIEW);
      return success(getService().listBatches(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sgkInvoices:getBatchDetail', (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.SGK_VIEW);
      return success(getService().getBatchDetail(id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sgkInvoices:markInvoiced', (_event, batchId: number) => {
    try {
      const session = requirePermission(PERMISSIONS.SGK_EDIT);
      const result = getService().markInvoiced(batchId, session.id);
      auditAction(session.id, 'SGK Faturalandı', 'SGK', `Batch #${batchId}`, {
        entityType: 'sgk_invoice_batch',
        entityId: batchId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sgkInvoices:markCollected', (_event, batchId: number) => {
    try {
      const session = requirePermission(PERMISSIONS.SGK_EDIT);
      const result = getService().markCollected(batchId);
      auditAction(session.id, 'Kurum Alacağı Tahsil Edildi', 'SGK', `Batch #${batchId}`, {
        entityType: 'sgk_invoice_batch',
        entityId: batchId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sgkInvoices:exportExcel', async (_event, batchId: number) => {
    try {
      requirePermission(PERMISSIONS.MEDULA_EXPORT);
      const result = await dialogModule.showSaveDialog({
        title: 'SGK Fatura Listesi Kaydet',
        defaultPath: `sgk-fatura-${batchId}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return success({ exported: false });
      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;
      const data = getService().exportExcel(batchId, filePath);
      return success({ exported: true, filePath, ...data });
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sgkInvoices:print', (_event, batchId: number) => {
    try {
      requirePermission(PERMISSIONS.SGK_VIEW);
      return success({ html: getService().getPrintHtml(batchId) });
    } catch (err) {
      return handleError(err);
    }
  });
}
