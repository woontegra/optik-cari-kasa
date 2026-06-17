import type { IpcMain } from 'electron';

import { getDatabase } from '../database';

import { CustomerAccountService } from '../services/customerAccount.service';

import { requirePermission } from './authGuard';

import { PERMISSIONS } from '../types/permission';

import { handleUnexpectedError } from './ipcHelpers';

import { success } from './utils';



function getService(): CustomerAccountService {

  const db = getDatabase();

  if (!db) throw new Error('Veritabanı başlatılamadı');

  return new CustomerAccountService(db);

}



export function registerCustomerAccountHandlers(ipcMain: IpcMain): void {

  ipcMain.handle('customerAccount:getBalance', (_event, customerId: number) => {

    try {

      requirePermission(PERMISSIONS.CUSTOMERS_VIEW);

      return success({ balance: getService().getBalance(customerId) });

    } catch (err) {

      return handleUnexpectedError('Cari', err, 'Cari bakiye okunamadı.');

    }

  });



  ipcMain.handle('customerAccount:listMovements', (_event, customerId: number) => {

    try {

      requirePermission(PERMISSIONS.CUSTOMERS_VIEW);

      return success(getService().listMovements(customerId));

    } catch (err) {

      return handleUnexpectedError('Cari', err, 'Cari hareketler okunamadı.');

    }

  });

}


