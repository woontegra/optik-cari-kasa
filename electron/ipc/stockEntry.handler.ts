import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import { StockEntryService, StockEntryValidationError } from '../services/stockEntry.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success, failure } from './utils';
import type { CompleteStockEntryInput, StockEntryBatchListFilters } from '../types/stockEntry';

function getStockEntryService(): StockEntryService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new StockEntryService(db);
}

export function registerStockEntryHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {
  ipcMain.handle('stockEntry:complete', (_event, input: CompleteStockEntryInput) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const result = getStockEntryService().completeBatch(input, session.id);
      auditAction(
        session.id,
        'Stok Girişi',
        'Stok',
        `Mal kabul fişi oluşturuldu: ${result.batchNo} (${result.totalQuantity} adet)`,
        { entityType: 'stock_entry_batch', entityId: result.batchId }
      );
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof StockEntryValidationError) return failure(err.message);
      return handleUnexpectedError('Stok Girişi', err, 'Stok girişi tamamlanamadı.');
    }
  });

  ipcMain.handle('stockEntry:listBatches', (_event, filters?: StockEntryBatchListFilters) => {
    try {
      requirePermission(PERMISSIONS.STOCK_EDIT);
      return success(getStockEntryService().listBatches(filters));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Stok Girişi', err, 'Giriş geçmişi alınamadı.');
    }
  });

  ipcMain.handle('stockEntry:getBatch', (_event, batchId: number) => {
    try {
      requirePermission(PERMISSIONS.STOCK_EDIT);
      return success(getStockEntryService().getBatchDetail(batchId));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Stok Girişi', err, 'Giriş fişi detayı alınamadı.');
    }
  });

  ipcMain.handle('stockEntry:print', (_event, batchId: number) => {
    try {
      requirePermission(PERMISSIONS.STOCK_EDIT);
      return success(getStockEntryService().buildPrintDocument(batchId));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof StockEntryValidationError) return failure(err.message);
      return handleUnexpectedError('Stok Girişi', err, 'Giriş fişi yazdırılamadı.');
    }
  });

  ipcMain.handle('stockEntry:exportExcel', async (_event, batchId: number) => {
    try {
      requirePermission(PERMISSIONS.STOCK_EDIT);
      const detail = getStockEntryService().getBatchDetail(batchId);
      if (!detail) return failure('Giriş fişi bulunamadı.');
      const result = await dialogModule.showSaveDialog({
        title: 'Stok Giriş Fişi Excel Kaydet',
        defaultPath: `${String(detail.batch_no)}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return success({ exported: false });
      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;
      const data = getStockEntryService().exportBatchToExcel(batchId, filePath);
      return success({ exported: true, filePath, ...data });
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof StockEntryValidationError) return failure(err.message);
      return handleUnexpectedError('Stok Girişi', err, 'Excel dışa aktarılamadı.');
    }
  });
}
