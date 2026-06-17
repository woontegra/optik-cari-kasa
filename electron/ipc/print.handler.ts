import type { IpcMain } from 'electron';

import { getDatabase } from '../database';

import { PrintService } from '../services/print.service';

import { requirePermission } from './authGuard';

import { PERMISSIONS } from '../types/permission';

import { handleUnexpectedError } from './ipcHelpers';

import { success } from './utils';



function getService(): PrintService {

  const db = getDatabase();

  if (!db) throw new Error('Veritabanı başlatılamadı');

  return new PrintService(db);

}



export function registerPrintHandlers(ipcMain: IpcMain): void {

  ipcMain.handle('print:saleReceipt', (_event, saleId: number) => {

    try {

      requirePermission(PERMISSIONS.SALES_CREATE);

      return success(getService().saleReceipt(saleId));

    } catch (err) {

      return handleUnexpectedError('Yazdırma', err, 'Satış fişi hazırlanamadı.');

    }

  });



  ipcMain.handle('print:paymentReceipt', (_event, paymentId: number) => {

    try {

      requirePermission(PERMISSIONS.CASH_VIEW);

      return success(getService().paymentReceipt(paymentId));

    } catch (err) {

      return handleUnexpectedError('Yazdırma', err, 'Tahsilat makbuzu hazırlanamadı.');

    }

  });



  ipcMain.handle('print:returnReceipt', (_event, returnId: number) => {

    try {

      requirePermission(PERMISSIONS.RETURNS_CREATE);

      return success(getService().returnReceipt(returnId));

    } catch (err) {

      return handleUnexpectedError('Yazdırma', err, 'İade fişi hazırlanamadı.');

    }

  });

}


