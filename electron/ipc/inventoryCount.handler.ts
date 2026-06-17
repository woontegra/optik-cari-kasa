import type { IpcMain, dialog } from 'electron';
import { getDatabase } from '../database';
import {
  InventoryCountService,
  InventoryCountValidationError,
} from '../services/inventoryCount.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success, failure } from './utils';
import type {
  CountListFilters,
  CreateCountInput,
  ResolveUnknownInput,
  UpdateItemQuantityInput,
} from '../types/inventoryCount';

function getService(): InventoryCountService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new InventoryCountService(db);
}

export function registerInventoryCountHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {
  ipcMain.handle('inventory:createCount', (_event, input: CreateCountInput) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const result = getService().createCount(input, session.id);
      auditAction(session.id, 'Sayım Başlatıldı', 'Envanter', `Sayım başlatıldı: ${result.count_no} — ${input.name}`, {
        entityType: 'inventory_count',
        entityId: Number(result.id),
      });
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Sayım başlatılamadı.');
    }
  });

  ipcMain.handle('inventory:getActiveCount', () => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().getActiveCount());
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Envanter', err, 'Aktif sayım alınamadı.');
    }
  });

  ipcMain.handle('inventory:getCountById', (_event, countId: number) => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().getCountDetail(countId));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Sayım detayı alınamadı.');
    }
  });

  ipcMain.handle('inventory:listCounts', (_event, filters?: CountListFilters) => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().listCounts(filters));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Envanter', err, 'Sayım listesi alınamadı.');
    }
  });

  ipcMain.handle('inventory:scanCode', (_event, countId: number, rawCode: string) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const result = getService().scanCode(countId, rawCode, session.id);
      if (result.success) {
        auditAction(
          session.id,
          'Barkod Okutuldu',
          'Envanter',
          `Sayım barkod okutma: ${rawCode}`,
          { entityType: 'inventory_count', entityId: countId }
        );
      }
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Barkod okutulamadı.');
    }
  });

  ipcMain.handle('inventory:updateItemQuantity', (_event, countId: number, input: UpdateItemQuantityInput) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const item = getService().updateItemQuantity(countId, input, session.id);
      auditAction(
        session.id,
        'Sayılan Adet Değiştirildi',
        'Envanter',
        `Manuel sayım düzeltmesi: kalem #${input.item_id} → ${input.counted_quantity}`,
        { entityType: 'inventory_count', entityId: countId }
      );
      return success({ item, summary: getService().computeSummary(countId) });
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Sayılan adet güncellenemedi.');
    }
  });

  ipcMain.handle('inventory:saveDraft', (_event, countId: number) => {
    try {
      requirePermission(PERMISSIONS.STOCK_EDIT);
      return success(getService().saveDraft(countId));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Taslak kaydedilemedi.');
    }
  });

  ipcMain.handle('inventory:completeCount', (_event, countId: number) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const result = getService().completeCount(countId);
      auditAction(session.id, 'Sayım Tamamlandı', 'Envanter', `Sayım tamamlandı: ${result.count_no}`, {
        entityType: 'inventory_count',
        entityId: countId,
      });
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Sayım tamamlanamadı.');
    }
  });

  ipcMain.handle('inventory:applyAdjustments', (_event, countId: number) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const result = getService().applyAdjustments(countId, session.id);
      auditAction(
        session.id,
        'Sayım Farkları İşlendi',
        'Envanter',
        `Sayım farkları stoğa işlendi: ${result.countNo} (${result.adjustedItems} kalem)`,
        { entityType: 'inventory_count', entityId: countId }
      );
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Stok farkları işlenemedi.');
    }
  });

  ipcMain.handle('inventory:cancelCount', (_event, countId: number) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const result = getService().cancelCount(countId);
      auditAction(session.id, 'Sayım İptal Edildi', 'Envanter', `Sayım iptal edildi: #${countId}`, {
        entityType: 'inventory_count',
        entityId: countId,
      });
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Sayım iptal edilemedi.');
    }
  });

  ipcMain.handle('inventory:addUnknownScan', (_event, countId: number, rawCode: string, note?: string) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const unknown = getService().addUnknownScan(countId, rawCode, note);
      auditAction(session.id, 'Bilinmeyen Barkod Kaydedildi', 'Envanter', `Bekleyen barkod: ${rawCode}`, {
        entityType: 'inventory_count',
        entityId: countId,
      });
      return success({ unknown, detail: getService().getCountDetail(countId) });
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Bilinmeyen barkod eklenemedi.');
    }
  });

  ipcMain.handle('inventory:resolveUnknownScan', (_event, countId: number, input: ResolveUnknownInput) => {
    try {
      const session = requirePermission(PERMISSIONS.STOCK_EDIT);
      const result = getService().resolveUnknownScan(countId, input, session.id);
      auditAction(session.id, 'Bilinmeyen Barkod Çözüldü', 'Envanter', `Bekleyen barkod işlendi: #${input.unknown_id}`, {
        entityType: 'inventory_count',
        entityId: countId,
      });
      return success(result);
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Bilinmeyen barkod çözülemedi.');
    }
  });

  ipcMain.handle('inventory:printReport', (_event, countId: number) => {
    try {
      requirePermission(PERMISSIONS.STOCK_VIEW);
      return success(getService().buildPrintDocument(countId));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Sayım raporu yazdırılamadı.');
    }
  });

  ipcMain.handle('inventory:exportExcel', async (_event, countId: number) => {
    try {
      requirePermission(PERMISSIONS.EXCEL_EXPORT);
      const detail = getService().getCountDetail(countId);
      const d = new Date();
      const dateStr = d.toISOString().slice(0, 10);
      const result = await dialogModule.showSaveDialog({
        title: 'Sayım Raporu Excel Kaydet',
        defaultPath: `sayim-raporu-${dateStr}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return success({ exported: false });
      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;
      const data = getService().exportCountToExcel(countId, filePath);
      return success({ exported: true, filePath, ...data });
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      if (err instanceof InventoryCountValidationError) return failure(err.message);
      return handleUnexpectedError('Envanter', err, 'Excel dışa aktarılamadı.');
    }
  });
}
