import type { IpcMain, dialog } from 'electron';

import { getDatabase } from '../database';

import { UtsTrackingService, UtsTrackingError } from '../services/utsTracking.service';

import { requirePermission } from './authGuard';

import { PERMISSIONS } from '../types/permission';

import { handleUnexpectedError } from './ipcHelpers';

import { success, failure } from './utils';

import type { UtsListFilters } from '../types/medula';

import type { UtsStatus } from '../types/medula';



function getService(): UtsTrackingService {

  const db = getDatabase();

  if (!db) throw new Error('Veritabanı başlatılamadı');

  return new UtsTrackingService(db);

}



function handleUtsError(err: unknown, userMessage = 'ÜTS işlemi yapılamadı.') {

  if (err instanceof UtsTrackingError) return failure(err.message);

  return handleUnexpectedError('ÜTS', err, userMessage);

}



export function registerUtsHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {

  ipcMain.handle('uts:listRecords', (_event, filters?: UtsListFilters) => {

    try {

      requirePermission(PERMISSIONS.UTS_VIEW);

      return success(getService().listRecords(filters));

    } catch (err) {

      return handleUtsError(err, 'ÜTS kayıtları listelenemedi.');

    }

  });



  ipcMain.handle(

    'uts:updateStatus',

    (_event, payload: { productId: number; status: UtsStatus; note?: string }) => {

      try {

        requirePermission(PERMISSIONS.UTS_EDIT);

        const result = getService().updateStatus(payload.productId, payload.status, payload.note);

        return success(result);

      } catch (err) {

        return handleUtsError(err, 'ÜTS durumu güncellenemedi.');

      }

    }

  );



  ipcMain.handle('uts:exportExcel', async (_event, filters?: UtsListFilters) => {

    try {

      requirePermission(PERMISSIONS.UTS_EXPORT);

      const result = await dialogModule.showSaveDialog({

        title: 'ÜTS / UBB Takip Dosyası Kaydet',

        defaultPath: getService().getDefaultFileName(),

        filters: [{ name: 'Excel', extensions: ['xlsx'] }],

      });

      if (result.canceled || !result.filePath) return success({ exported: false });

      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;

      const data = getService().exportExcel(filePath, filters);

      return success({ exported: true, filePath, ...data });

    } catch (err) {

      return handleUtsError(err, 'ÜTS dosyası dışa aktarılamadı.');

    }

  });

}


