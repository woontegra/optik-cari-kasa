import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import { InvoiceDraftService, InvoiceDraftError } from '../services/invoiceDraft.service';
import { InvoiceExportService } from '../services/invoiceExport.service';
import { EinvoiceSettingsService } from '../services/einvoiceSettings.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success, failure } from './utils';
import type {
  CreateFromPurchaseInput,
  CreateFromSaleInput,
  CreateFromSgkBatchInput,
  CreateFromStockEntryInput,
  EinvoiceSettingsInput,
  InvoiceDraftListFilters,
  InvoiceDraftReportFilters,
  MarkOfficialInput,
} from '../types/invoiceDraft';

function draftService(): InvoiceDraftService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new InvoiceDraftService(db);
}

function exportService(): InvoiceExportService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new InvoiceExportService(db);
}

function settingsService(): EinvoiceSettingsService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new EinvoiceSettingsService(db);
}

function handleError(err: unknown, msg = 'E-Dönüşüm işlemi yapılamadı.') {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof InvoiceDraftError) return failure(err.message);
  return handleUnexpectedError('E-Dönüşüm', err, msg);
}

export function registerInvoiceDraftHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {
  ipcMain.handle('invoiceDrafts:list', (_event, filters?: InvoiceDraftListFilters) => {
    try {
      requirePermission(PERMISSIONS.EINVOICE_VIEW);
      return success(draftService().list(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:getById', (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.EINVOICE_VIEW);
      return success(draftService().getById(id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:createFromSale', (_event, input: CreateFromSaleInput) => {
    try {
      const session = requirePermission(PERMISSIONS.EINVOICE_EDIT);
      const result = draftService().createFromSale(input, session.id);
      auditAction(session.id, 'Fatura Taslağı Oluşturuldu', 'E-Dönüşüm', `Satış #${input.sale_id}`, {
        entityType: 'invoice_draft',
        entityId: result.draftId,
      });
      if (result.warning) {
        auditAction(session.id, 'Eksik Alanlı Belge Oluşturuldu', 'E-Dönüşüm', result.warning, {
          entityType: 'invoice_draft',
          entityId: result.draftId,
        });
      }
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:createFromPurchase', (_event, input: CreateFromPurchaseInput) => {
    try {
      const session = requirePermission(PERMISSIONS.EINVOICE_EDIT);
      const result = draftService().createFromPurchase(input, session.id);
      auditAction(session.id, 'Alış Belge Taslağı Oluşturuldu', 'E-Dönüşüm', `Alış #${input.purchase_document_id}`, {
        entityType: 'invoice_draft',
        entityId: result.draftId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:createFromSgkBatch', (_event, input: CreateFromSgkBatchInput) => {
    try {
      const session = requirePermission(PERMISSIONS.EINVOICE_EDIT);
      const result = draftService().createFromSgkBatch(input, session.id);
      auditAction(session.id, 'SGK Fatura Taslağı Oluşturuldu', 'E-Dönüşüm', `Batch #${input.sgk_invoice_batch_id}`, {
        entityType: 'invoice_draft',
        entityId: result.draftId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:createFromStockEntry', (_event, input: CreateFromStockEntryInput) => {
    try {
      const session = requirePermission(PERMISSIONS.EINVOICE_EDIT);
      const result = draftService().createFromStockEntry(input, session.id);
      auditAction(session.id, 'E-İrsaliye Taslağı Oluşturuldu', 'E-Dönüşüm', `Mal kabul #${input.stock_entry_batch_id}`, {
        entityType: 'invoice_draft',
        entityId: result.draftId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:updateStatus', (_event, id: number, status: string) => {
    try {
      const session = requirePermission(PERMISSIONS.EINVOICE_EDIT);
      return success(draftService().updateStatus(id, status, session.id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:markOfficial', (_event, input: MarkOfficialInput) => {
    try {
      const session = requirePermission(PERMISSIONS.EINVOICE_MARK_OFFICIAL);
      const result = draftService().markOfficial(input, session.id);
      auditAction(session.id, 'Resmi Belge No Girildi', 'E-Dönüşüm', input.official_invoice_no || `#${input.draft_id}`, {
        entityType: 'invoice_draft',
        entityId: input.draft_id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:cancel', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.EINVOICE_EDIT);
      const result = draftService().cancel(id, session.id);
      auditAction(session.id, 'Belge İptal Edildi', 'E-Dönüşüm', `#${id}`, { entityType: 'invoice_draft', entityId: id });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:exportExcel', async (_event, draftId: number) => {
    try {
      requirePermission(PERMISSIONS.EINVOICE_EXPORT);
      const detail = draftService().getById(draftId);
      const result = await dialogModule.showSaveDialog({
        title: 'Fatura Taslağı Excel Kaydet',
        defaultPath: `fatura-taslak-${detail?.draft_no || draftId}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return success({ exported: false });
      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;
      const data = exportService().exportExcel(draftId, filePath);
      draftService().markExported(draftId);
      const session = requirePermission(PERMISSIONS.EINVOICE_EXPORT);
      auditAction(session.id, 'Excel Dışa Aktarıldı', 'E-Dönüşüm', filePath, { entityType: 'invoice_draft', entityId: draftId });
      return success({ exported: true, filePath, ...data });
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:exportXml', async (_event, draftId: number) => {
    try {
      requirePermission(PERMISSIONS.EINVOICE_EXPORT);
      const detail = draftService().getById(draftId);
      const result = await dialogModule.showSaveDialog({
        title: 'Fatura Taslağı XML Kaydet',
        defaultPath: `fatura-taslak-${detail?.draft_no || draftId}.xml`,
        filters: [{ name: 'XML', extensions: ['xml'] }],
      });
      if (result.canceled || !result.filePath) return success({ exported: false });
      const filePath = result.filePath.endsWith('.xml') ? result.filePath : `${result.filePath}.xml`;
      const data = exportService().exportXml(draftId, filePath);
      draftService().markExported(draftId);
      const session = requirePermission(PERMISSIONS.EINVOICE_EXPORT);
      auditAction(session.id, 'XML Dışa Aktarıldı', 'E-Dönüşüm', filePath, { entityType: 'invoice_draft', entityId: draftId });
      return success({ exported: true, ...data });
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:printHtml', (_event, draftId: number) => {
    try {
      requirePermission(PERMISSIONS.EINVOICE_VIEW);
      return success({ html: exportService().getPrintHtml(draftId) });
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:getReport', (_event, filters?: InvoiceDraftReportFilters) => {
    try {
      requirePermission(PERMISSIONS.REPORTS_VIEW);
      return success(draftService().getReport(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('invoiceDrafts:getDashboardStats', () => {
    try {
      requirePermission(PERMISSIONS.DASHBOARD_VIEW);
      return success(draftService().getDashboardStats());
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('einvoiceSettings:get', () => {
    try {
      requirePermission(PERMISSIONS.EINVOICE_VIEW);
      return success(settingsService().get());
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('einvoiceSettings:update', (_event, input: EinvoiceSettingsInput) => {
    try {
      requirePermission(PERMISSIONS.EINVOICE_EDIT);
      const session = requirePermission(PERMISSIONS.EINVOICE_EDIT);
      const result = settingsService().update(input);
      auditAction(session.id, 'E-Dönüşüm Ayarları Güncellendi', 'E-Dönüşüm', String(input.provider_name || ''), {
        entityType: 'einvoice_settings',
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });
}
