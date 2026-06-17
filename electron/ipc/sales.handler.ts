import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { SaleService, SaleValidationError } from '../services/sale.service';
import { requireAuth, requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError } from './ipcHelpers';
import { success, failure } from './utils';
import type { SaleItemInput, PaymentType, CashPaymentType } from '../types/product';
import type { AddPaymentInput, SaleListFilters, CancelSaleInput } from '../types/sale';
import { CASH_PAYMENT_TYPES } from '../types/sale';

function getService(): SaleService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new SaleService(db);
}

function handleError(err: unknown) {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof SaleValidationError) return failure(err.message);
  return failure((err as Error).message);
}

export interface CompleteSalePayload {
  items: SaleItemInput[];
  paymentMode: PaymentType;
  paymentType?: CashPaymentType;
  paidAmount?: number;
  customerId?: number | null;
  prescriptionId?: number | null;
}

export function registerSalesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('sales:list', (_event, filters?: SaleListFilters) => {
    try {
      requireAuth();
      return success(getService().list(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sales:getById', (_event, id: number) => {
    try {
      requireAuth();
      return success(getService().getById(id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sales:complete', (_event, payload: CompleteSalePayload) => {
    try {
      const session = requirePermission(PERMISSIONS.SALES_CREATE);
      if (payload.paymentMode === 'Parçalı Ödeme') {
        if (!payload.paymentType || !CASH_PAYMENT_TYPES.includes(payload.paymentType)) {
          return failure('Parçalı ödeme için geçerli ödeme türü seçilmelidir.');
        }
      } else if (
        payload.paymentMode !== 'Açık Hesap' &&
        payload.paymentMode !== 'Parçalı Ödeme' &&
        !CASH_PAYMENT_TYPES.includes(payload.paymentMode as CashPaymentType)
      ) {
        return failure('Geçersiz ödeme türü.');
      }

      const result = getService().completeSale({
        items: payload.items,
        paymentMode: payload.paymentMode,
        paymentType: payload.paymentType,
        paidAmount: payload.paidAmount,
        customerId: payload.customerId,
        prescriptionId: payload.prescriptionId,
      });
      auditAction(session.id, 'Oluşturma', 'Satış', `Satış oluşturuldu: ${result.saleNo}`, {
        entityType: 'sale',
        entityId: result.saleId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sales:addPayment', (_event, input: AddPaymentInput) => {
    try {
      const session = requirePermission(PERMISSIONS.CASH_EDIT);
      const result = getService().addPayment(input);
      auditAction(session.id, 'Tahsilat', 'Kasa', `Tahsilat eklendi #${result.paymentId}`, {
        entityType: 'payment',
        entityId: result.paymentId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sales:cancel', (_event, input: CancelSaleInput) => {
    try {
      const session = requirePermission(PERMISSIONS.SALES_CANCEL);
      const result = getService().cancelSale(input);
      auditAction(session.id, 'İptal', 'Satış', `Satış iptal edildi #${input.saleId}`, {
        entityType: 'sale',
        entityId: input.saleId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('sales:listByCustomer', (_event, customerId: number) => {
    try {
      requireAuth();
      return success(getService().listByCustomer(customerId));
    } catch (err) {
      return handleError(err);
    }
  });
}
