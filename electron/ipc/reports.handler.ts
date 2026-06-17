import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import { ReportService, ReportValidationError } from '../services/report.service';
import { InvoiceDraftService } from '../services/invoiceDraft.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { handleIpcError } from './ipcHelpers';
import { success, failure } from './utils';
import type {
  CashReportFilter,
  CustomerAccountReportFilter,
  DayEndFilter,
  PrescriptionMedulaReportFilter,
  PrintReportPayload,
  ReturnCancelReportFilter,
  SalesReportFilter,
  StockReportFilter,
} from '../types/report';

function getService(): ReportService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new ReportService(db);
}

function reportError(err: unknown) {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof ReportValidationError) return failure(err.message);
  return failure((err as Error).message);
}

export function registerReportHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {
  const guarded = <T>(fn: () => T) => {
    try {
      requirePermission(PERMISSIONS.REPORTS_VIEW);
      return success(fn());
    } catch (err) {
      return reportError(err);
    }
  };

  ipcMain.handle('reports:getDayEnd', (_event, filter?: DayEndFilter) => guarded(() => getService().getDayEnd(filter)));
  ipcMain.handle('reports:getSalesReport', (_event, filters?: SalesReportFilter) =>
    guarded(() => getService().getSalesReport(filters))
  );
  ipcMain.handle('reports:getCashReport', (_event, filters?: CashReportFilter) =>
    guarded(() => getService().getCashReport(filters))
  );
  ipcMain.handle('reports:getStockReport', (_event, filters?: StockReportFilter) =>
    guarded(() => getService().getStockReport(filters))
  );
  ipcMain.handle('reports:getCustomerAccountReport', (_event, filters?: CustomerAccountReportFilter) =>
    guarded(() => getService().getCustomerAccountReport(filters))
  );
  ipcMain.handle('reports:getPrescriptionMedulaReport', (_event, filters?: PrescriptionMedulaReportFilter) =>
    guarded(() => getService().getPrescriptionMedulaReport(filters))
  );
  ipcMain.handle('reports:getEdonusumReport', (_event, filters?: import('../types/invoiceDraft').InvoiceDraftReportFilters) =>
    guarded(() => new InvoiceDraftService(getDatabase()!).getReport(filters))
  );

  ipcMain.handle('reports:getReturnCancelReport', (_event, filters?: ReturnCancelReportFilter) =>
    guarded(() => getService().getReturnCancelReport(filters))
  );
  ipcMain.handle('reports:getPurchaseReport', (_event, filters?: import('../types/report').PurchaseReportFilter) =>
    guarded(() => getService().getPurchaseReport(filters))
  );
  ipcMain.handle('reports:getSupplierAccountReport', (_event, filters?: import('../types/report').SupplierAccountReportFilter) =>
    guarded(() => getService().getSupplierAccountReport(filters))
  );

  ipcMain.handle(
    'reports:exportExcel',
    async (_event, payload: { fileName: string; rows: Record<string, unknown>[]; sheetName?: string }) => {
      try {
        requirePermission(PERMISSIONS.EXCEL_EXPORT);
        const result = await dialogModule.showSaveDialog({
          title: 'Excel Dosyası Kaydet',
          defaultPath: payload.fileName,
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        });
        if (result.canceled || !result.filePath) {
          return success({ exported: false });
        }
        const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;
        getService().exportExcel(filePath, payload.rows, payload.sheetName || 'Rapor');
        return success({ exported: true, filePath });
      } catch (err) {
        return reportError(err);
      }
    }
  );

  ipcMain.handle('reports:print', (_event, payload: PrintReportPayload) => {
    try {
      requirePermission(PERMISSIONS.REPORTS_VIEW);
      return success(getService().buildPrintHtml(payload));
    } catch (err) {
      return reportError(err);
    }
  });
}
