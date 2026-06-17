import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import { UtsOperationService, UtsOperationError } from '../services/utsOperation.service';
import { TitubbExportService } from '../services/titubbExport.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success, failure } from './utils';
import type {
  UtsCreateOperationInput,
  UtsMarkIgnoredInput,
  UtsOperationHistoryFilters,
  UtsOperationListFilters,
  UtsOperationType,
  UtsReportFilters,
} from '../types/utsOperation';
import type { UtsImportRow } from '../types/utsOperation';

function getService(): UtsOperationService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new UtsOperationService(db);
}

function handleUtsError(err: unknown, userMessage = 'ÜTS operasyonu yapılamadı.') {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof UtsOperationError) return failure(err.message);
  return handleUnexpectedError('ÜTS', err, userMessage);
}

export function registerUtsOperationHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {
  ipcMain.handle('utsOperations:listPendingReceive', (_event, filters?: UtsOperationListFilters) => {
    try {
      requirePermission(PERMISSIONS.UTS_VIEW);
      return success(getService().listPendingReceive(filters));
    } catch (err) {
      return handleUtsError(err);
    }
  });

  ipcMain.handle('utsOperations:listPendingGive', (_event, filters?: UtsOperationListFilters) => {
    try {
      requirePermission(PERMISSIONS.UTS_VIEW);
      return success(getService().listPendingGive(filters));
    } catch (err) {
      return handleUtsError(err);
    }
  });

  ipcMain.handle('utsOperations:listPendingReturn', (_event, filters?: UtsOperationListFilters) => {
    try {
      requirePermission(PERMISSIONS.UTS_VIEW);
      return success(getService().listPendingReturn(filters));
    } catch (err) {
      return handleUtsError(err);
    }
  });

  ipcMain.handle('utsOperations:createOperation', (_event, input: UtsCreateOperationInput) => {
    try {
      const session = requirePermission(PERMISSIONS.UTS_EDIT);
      const result = getService().createOperation(input, session.id);
      const labels: Record<string, string> = {
        ALMA_BILDIRIMI: 'ÜTS alma bildirimi hazırlandı',
        VERME_BILDIRIMI: 'ÜTS verme bildirimi hazırlandı',
        IADE_BILDIRIMI: 'ÜTS iade bildirimi hazırlandı',
        RED_BILDIRIMI: 'ÜTS red bildirimi hazırlandı',
      };
      auditAction(session.id, 'ÜTS Operasyon', 'ÜTS', labels[input.operation_type] || 'ÜTS operasyonu', {
        entityType: 'uts_operation',
        entityId: result.operationId,
      });
      return success(result);
    } catch (err) {
      return handleUtsError(err);
    }
  });

  ipcMain.handle('utsOperations:exportExcel', async (_event, operationId: number, operationType?: UtsOperationType) => {
    try {
      const session = requirePermission(PERMISSIONS.UTS_EXPORT);
      const svc = getService();
      const detail = svc.getDetail(operationId);
      const opType = (operationType || (detail?.operation as Record<string, unknown>)?.operation_type) as UtsOperationType;
      const result = await dialogModule.showSaveDialog({
        title: 'ÜTS Excel Kaydet',
        defaultPath: svc.getDefaultFileName(opType || 'ALMA_BILDIRIMI'),
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return success({ exported: false });
      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;
      const data = svc.exportExcel(operationId, filePath, session.id);
      auditAction(session.id, 'ÜTS Excel Dışa Aktarım', 'ÜTS', filePath, {
        entityType: 'uts_operation',
        entityId: operationId,
      });
      if (detail && (detail.operation as Record<string, unknown>).status === 'Hatalı') {
        auditAction(session.id, 'Eksik Alanlı ÜTS Dışa Aktarım', 'ÜTS', filePath, {
          entityType: 'uts_operation',
          entityId: operationId,
        });
      }
      return success({ exported: true, ...data });
    } catch (err) {
      return handleUtsError(err, 'Excel oluşturulamadı.');
    }
  });

  ipcMain.handle('utsOperations:markProcessed', (_event, operationIds: number[]) => {
    try {
      const session = requirePermission(PERMISSIONS.UTS_MARK_PROCESSED);
      const result = getService().markProcessed(operationIds, session.id);
      for (const id of operationIds) {
        auditAction(session.id, 'ÜTS\'de İşlendi', 'ÜTS', `Operasyon #${id}`, {
          entityType: 'uts_operation',
          entityId: id,
        });
      }
      return success(result);
    } catch (err) {
      return handleUtsError(err);
    }
  });

  ipcMain.handle('utsOperations:markIgnored', (_event, input: UtsMarkIgnoredInput) => {
    try {
      const session = requirePermission(PERMISSIONS.UTS_EDIT);
      const result = getService().markIgnored(input, session.id);
      auditAction(session.id, 'ÜTS İşlem Dışı', 'ÜTS', input.reason, { entityType: 'uts_operation' });
      return success(result);
    } catch (err) {
      return handleUtsError(err);
    }
  });

  ipcMain.handle('utsOperations:listHistory', (_event, filters?: UtsOperationHistoryFilters) => {
    try {
      requirePermission(PERMISSIONS.UTS_VIEW);
      return success(getService().listHistory(filters));
    } catch (err) {
      return handleUtsError(err);
    }
  });

  ipcMain.handle('utsOperations:getDetail', (_event, operationId: number) => {
    try {
      requirePermission(PERMISSIONS.UTS_VIEW);
      return success(getService().getDetail(operationId));
    } catch (err) {
      return handleUtsError(err);
    }
  });

  ipcMain.handle('utsOperations:importUtsFile', async () => {
    try {
      requirePermission(PERMISSIONS.UTS_EDIT);
      const result = await dialogModule.showOpenDialog({
        title: 'ÜTS Dosyası Seç',
        filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths[0]) return success({ rows: [], cancelled: true });
      const rows = getService().importUtsFile(result.filePaths[0]);
      return success({ rows, filePath: result.filePaths[0], cancelled: false });
    } catch (err) {
      return handleUtsError(err, 'Dosya okunamadı.');
    }
  });

  ipcMain.handle(
    'utsOperations:createStockEntryFromImport',
    (_event, payload: { rows: UtsImportRow[]; supplier_id?: number; document_no?: string; entry_date?: string }) => {
      try {
        const session = requirePermission(PERMISSIONS.UTS_EDIT);
        const result = getService().createStockEntryFromImport(payload.rows, session.id, payload);
        auditAction(session.id, 'ÜTS Stok Girişi Hazırlığı', 'ÜTS', result.batchNo, {
          entityType: 'stock_entry_batch',
          entityId: result.batchId,
        });
        return success(result);
      } catch (err) {
        return handleUtsError(err);
      }
    }
  );

  ipcMain.handle('utsOperations:getReport', (_event, filters?: UtsReportFilters) => {
    try {
      requirePermission(PERMISSIONS.UTS_VIEW);
      return success(getService().getReport(filters));
    } catch (err) {
      return handleUtsError(err);
    }
  });

  ipcMain.handle('utsOperations:getDashboardStats', () => {
    try {
      requirePermission(PERMISSIONS.DASHBOARD_VIEW);
      const svc = getService();
      const titubb = new TitubbExportService(getDatabase()!);
      return success({
        pendingReceive: svc.countPendingReceive(),
        pendingGive: svc.countPendingGive(),
        errorCount: svc.countErrorRecords(),
        titubbPending: titubb.countPending(),
      });
    } catch (err) {
      return handleUtsError(err);
    }
  });
}
