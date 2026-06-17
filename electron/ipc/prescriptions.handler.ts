import type { IpcMain } from 'electron';

import { getDatabase } from '../database';

import { PrescriptionService, PrescriptionValidationError } from '../services/prescription.service';

import { requirePermission } from './authGuard';

import { PERMISSIONS } from '../types/permission';

import { handleIpcError, handleUnexpectedError } from './ipcHelpers';

import { success, failure } from './utils';

import type { PrescriptionInput, PrescriptionListFilters } from '../types/prescription';



function getService(): PrescriptionService {

  const db = getDatabase();

  if (!db) throw new Error('Veritabanı başlatılamadı');

  return new PrescriptionService(db);

}



function handleError(err: unknown, userMessage = 'Reçete işlemi yapılamadı.') {

  const auth = handleIpcError(err);

  if (auth) return auth;

  if (err instanceof PrescriptionValidationError) return failure(err.message);

  return handleUnexpectedError('Reçete', err, userMessage);

}



export function registerPrescriptionHandlers(ipcMain: IpcMain): void {

  ipcMain.handle('prescriptions:list', (_event, filters?: PrescriptionListFilters) => {

    try {

      requirePermission(PERMISSIONS.PRESCRIPTIONS_VIEW);

      return success(getService().list(filters));

    } catch (err) {

      return handleError(err, 'Reçete listesi alınamadı.');

    }

  });



  ipcMain.handle('prescriptions:getById', (_event, id: number) => {

    try {

      requirePermission(PERMISSIONS.PRESCRIPTIONS_VIEW);

      return success(getService().getById(id));

    } catch (err) {

      return handleError(err);

    }

  });



  ipcMain.handle('prescriptions:listByCustomer', (_event, customerId: number, activeOnly = false) => {

    try {

      requirePermission(PERMISSIONS.PRESCRIPTIONS_VIEW);

      return success(getService().listByCustomer(customerId, activeOnly));

    } catch (err) {

      return handleError(err);

    }

  });



  ipcMain.handle('prescriptions:create', (_event, input: PrescriptionInput) => {

    try {

      requirePermission(PERMISSIONS.PRESCRIPTIONS_EDIT);

      return success(getService().create(input));

    } catch (err) {

      return handleError(err, 'Reçete kaydedilemedi.');

    }

  });



  ipcMain.handle('prescriptions:update', (_event, id: number, input: PrescriptionInput) => {

    try {

      requirePermission(PERMISSIONS.PRESCRIPTIONS_EDIT);

      return success(getService().update(id, input));

    } catch (err) {

      return handleError(err, 'Reçete güncellenemedi.');

    }

  });



  ipcMain.handle('prescriptions:deactivate', (_event, id: number) => {

    try {

      requirePermission(PERMISSIONS.PRESCRIPTIONS_EDIT);

      return success(getService().deactivate(id));

    } catch (err) {

      return handleError(err, 'Reçete pasife alınamadı.');

    }

  });

}


