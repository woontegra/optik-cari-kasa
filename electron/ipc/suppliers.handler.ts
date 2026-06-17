import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import { SupplierService, SupplierValidationError } from '../services/supplier.service';
import { PurchaseService, PurchaseValidationError } from '../services/purchase.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success, failure } from './utils';
import type { SupplierInput } from '../types/supplier';
import type {
  CancelPurchaseInput,
  CreatePurchaseInput,
  PurchaseListFilters,
  SupplierPaymentInput,
} from '../types/purchase';

function getSupplierService(): SupplierService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new SupplierService(db);
}

function getPurchaseService(): PurchaseService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new PurchaseService(db);
}

export function registerSupplierHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {
  ipcMain.handle('suppliers:list', (_event, activeOnly = true) => {
    try {
      requirePermission(PERMISSIONS.SUPPLIERS_VIEW);
      return success(getSupplierService().list(activeOnly));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Tedarikçi', err, 'Tedarikçi listesi alınamadı.');
    }
  });

  ipcMain.handle('suppliers:getById', (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.SUPPLIERS_VIEW);
      return success(getSupplierService().getDetail(id));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Tedarikçi', err, 'Tedarikçi detayı alınamadı.');
    }
  });

  ipcMain.handle('suppliers:create', (_event, input: SupplierInput) => {
    try {
      const session = requirePermission(PERMISSIONS.SUPPLIERS_EDIT);
      const result = getSupplierService().create(input);
      auditAction(session.id, 'Tedarikçi Oluşturuldu', 'Tedarikçi', `Tedarikçi eklendi: ${input.name}`, {
        entityType: 'supplier',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof SupplierValidationError) return failure(err.message);
      return handleUnexpectedError('Tedarikçi', err, 'Tedarikçi eklenemedi.');
    }
  });

  ipcMain.handle('suppliers:update', (_event, id: number, input: SupplierInput) => {
    try {
      const session = requirePermission(PERMISSIONS.SUPPLIERS_EDIT);
      const result = getSupplierService().update(id, input);
      auditAction(session.id, 'Tedarikçi Düzenlendi', 'Tedarikçi', `Tedarikçi güncellendi: ${input.name}`, {
        entityType: 'supplier',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof SupplierValidationError) return failure(err.message);
      return handleUnexpectedError('Tedarikçi', err, 'Tedarikçi güncellenemedi.');
    }
  });

  ipcMain.handle('suppliers:deactivate', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.SUPPLIERS_EDIT);
      const result = getSupplierService().deactivate(id);
      auditAction(session.id, 'Tedarikçi Pasife Alındı', 'Tedarikçi', `Tedarikçi pasife alındı: #${id}`, {
        entityType: 'supplier',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof SupplierValidationError) return failure(err.message);
      return handleUnexpectedError('Tedarikçi', err, 'Tedarikçi pasife alınamadı.');
    }
  });

  ipcMain.handle('suppliers:getAccountMovements', (_event, supplierId: number) => {
    try {
      requirePermission(PERMISSIONS.SUPPLIERS_VIEW);
      return success(getSupplierService().getAccountMovements(supplierId));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Tedarikçi', err, 'Cari hareketler alınamadı.');
    }
  });

  ipcMain.handle('suppliers:addPayment', (_event, input: SupplierPaymentInput) => {
    try {
      const session = requirePermission(PERMISSIONS.SUPPLIER_PAYMENTS);
      const result = getPurchaseService().addPayment(input, session.id);
      auditAction(
        session.id,
        'Tedarikçi Ödemesi',
        'Tedarikçi',
        `Tedarikçi ödemesi: ${input.amount} ₺`,
        { entityType: 'supplier', entityId: input.supplier_id }
      );
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof PurchaseValidationError) return failure(err.message);
      return handleUnexpectedError('Tedarikçi', err, 'Ödeme kaydedilemedi.');
    }
  });

  ipcMain.handle('suppliers:printStatement', (_event, supplierId: number) => {
    try {
      requirePermission(PERMISSIONS.SUPPLIERS_VIEW);
      return success(getPurchaseService().buildSupplierStatement(supplierId));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof PurchaseValidationError) return failure(err.message);
      return handleUnexpectedError('Tedarikçi', err, 'Ekstre yazdırılamadı.');
    }
  });

  ipcMain.handle('purchases:list', (_event, filters?: PurchaseListFilters) => {
    try {
      requirePermission(PERMISSIONS.SUPPLIERS_VIEW);
      return success(getPurchaseService().list(filters));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Alış', err, 'Alış belgeleri alınamadı.');
    }
  });

  ipcMain.handle('purchases:getById', (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.SUPPLIERS_VIEW);
      return success(getPurchaseService().getById(id));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Alış', err, 'Belge detayı alınamadı.');
    }
  });

  ipcMain.handle('purchases:create', (_event, input: CreatePurchaseInput) => {
    try {
      const session = requirePermission(PERMISSIONS.SUPPLIERS_EDIT);
      const result = getPurchaseService().create(input, session.id);
      auditAction(
        session.id,
        'Alış Belgesi Oluşturuldu',
        'Tedarikçi',
        `Alış belgesi: ${result.documentNo}`,
        { entityType: 'purchase_document', entityId: result.id }
      );
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof PurchaseValidationError) return failure(err.message);
      return handleUnexpectedError('Alış', err, 'Alış belgesi oluşturulamadı.');
    }
  });

  ipcMain.handle(
    'purchases:createFromStockEntry',
    (_event, batchId: number, input: Omit<CreatePurchaseInput, 'source_type' | 'stock_entry_batch_id' | 'items'>) => {
      try {
        const session = requirePermission(PERMISSIONS.SUPPLIERS_EDIT);
        const result = getPurchaseService().createFromStockEntry(batchId, input, session.id);
        auditAction(
          session.id,
          'Mal Kabulden Alış Belgesi',
          'Tedarikçi',
          `Mal kabulden alış belgesi: ${result.documentNo}`,
          { entityType: 'purchase_document', entityId: result.id }
        );
        return success(result);
      } catch (err) {
        const auth = handleIpcError(err);
        if (auth) return auth;
        if (err instanceof PurchaseValidationError) return failure(err.message);
        return handleUnexpectedError('Alış', err, 'Alış belgesi oluşturulamadı.');
      }
    }
  );

  ipcMain.handle('purchases:cancel', (_event, id: number, input: CancelPurchaseInput) => {
    try {
      const session = requirePermission(PERMISSIONS.SUPPLIERS_EDIT);
      const result = getPurchaseService().cancel(id, input, session.id);
      auditAction(session.id, 'Alış Belgesi İptal', 'Tedarikçi', `Alış belgesi iptal: #${id}`, {
        entityType: 'purchase_document',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof PurchaseValidationError) return failure(err.message);
      return handleUnexpectedError('Alış', err, 'Belge iptal edilemedi.');
    }
  });

  ipcMain.handle('purchases:addPayment', (_event, input: SupplierPaymentInput) => {
    try {
      const session = requirePermission(PERMISSIONS.SUPPLIER_PAYMENTS);
      const result = getPurchaseService().addPayment(input, session.id);
      auditAction(session.id, 'Tedarikçi Ödemesi', 'Tedarikçi', `Belge ödemesi: ${input.amount} ₺`, {
        entityType: 'purchase_document',
        entityId: input.purchase_document_id ?? undefined,
      });
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof PurchaseValidationError) return failure(err.message);
      return handleUnexpectedError('Alış', err, 'Ödeme kaydedilemedi.');
    }
  });

  ipcMain.handle('purchases:listBySupplier', (_event, supplierId: number) => {
    try {
      requirePermission(PERMISSIONS.SUPPLIERS_VIEW);
      return success(getPurchaseService().listBySupplier(supplierId));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Alış', err, 'Alış belgeleri alınamadı.');
    }
  });

  ipcMain.handle('purchases:listStockEntryCandidates', () => {
    try {
      requirePermission(PERMISSIONS.SUPPLIERS_EDIT);
      return success(getPurchaseService().listStockEntryCandidates());
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Alış', err, 'Mal kabul listesi alınamadı.');
    }
  });

  ipcMain.handle('purchases:getStockEntryLines', (_event, batchId: number) => {
    try {
      requirePermission(PERMISSIONS.SUPPLIERS_EDIT);
      return success(getPurchaseService().getStockEntryLines(batchId));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Alış', err, 'Mal kabul kalemleri alınamadı.');
    }
  });

  ipcMain.handle('purchases:print', (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.SUPPLIERS_VIEW);
      return success(getPurchaseService().buildPrintDocument(id));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof PurchaseValidationError) return failure(err.message);
      return handleUnexpectedError('Alış', err, 'Belge yazdırılamadı.');
    }
  });

  ipcMain.handle('purchases:exportExcel', async (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.EXCEL_EXPORT);
      const detail = getPurchaseService().getById(id);
      if (!detail) return failure('Belge bulunamadı.');
      const result = await dialogModule.showSaveDialog({
        title: 'Alış Belgesi Excel',
        defaultPath: `${String(detail.document_no)}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return success({ exported: false });
      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;
      const data = getPurchaseService().exportToExcel(id, filePath);
      return success({ exported: true, filePath, ...data });
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof PurchaseValidationError) return failure(err.message);
      return handleUnexpectedError('Alış', err, 'Excel dışa aktarılamadı.');
    }
  });
}
