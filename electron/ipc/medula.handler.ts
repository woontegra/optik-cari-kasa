import type { IpcMain, dialog } from 'electron';

import { getDatabase } from '../database';

import { MedulaExportService, MedulaExportError } from '../services/medulaExport.service';

import { requirePermission } from './authGuard';

import { PERMISSIONS } from '../types/permission';

import { handleUnexpectedError } from './ipcHelpers';

import { success, failure } from './utils';

import type { MedulaListFilters } from '../types/medula';



function getService(): MedulaExportService {

  const db = getDatabase();

  if (!db) throw new Error('Veritabanı başlatılamadı');

  return new MedulaExportService(db);

}



function handleMedulaError(err: unknown, userMessage = 'Medula işlemi yapılamadı.') {

  if (err instanceof MedulaExportError) return failure(err.message);

  return handleUnexpectedError('Medula', err, userMessage);

}



export function registerMedulaHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {

  ipcMain.handle('medula:listReadyRecords', (_event, filters?: MedulaListFilters) => {

    try {

      requirePermission(PERMISSIONS.MEDULA_VIEW);

      return success(getService().listReadyRecords(filters));

    } catch (err) {

      return handleMedulaError(err, 'Medula kayıtları listelenemedi.');

    }

  });



  ipcMain.handle('medula:getRecordDetail', (_event, saleId: number) => {

    try {

      requirePermission(PERMISSIONS.MEDULA_VIEW);

      return success(getService().getRecordDetail(saleId));

    } catch (err) {

      return handleMedulaError(err);

    }

  });



  ipcMain.handle('medula:validateRecord', (_event, saleId: number) => {

    try {

      requirePermission(PERMISSIONS.MEDULA_VIEW);

      return success(getService().validateRecord(saleId));

    } catch (err) {

      return handleMedulaError(err, 'Medula doğrulaması yapılamadı.');

    }

  });



  ipcMain.handle(

    'medula:exportExcel',

    async (_event, payload: { saleIds: number[]; force?: boolean }) => {

      try {

        requirePermission(PERMISSIONS.MEDULA_EXPORT);

        const result = await dialogModule.showSaveDialog({

          title: 'Medula Hazırlık Dosyası Kaydet',

          defaultPath: getService().getDefaultFileName('xlsx'),

          filters: [{ name: 'Excel', extensions: ['xlsx'] }],

        });

        if (result.canceled || !result.filePath) return success({ exported: false });

        const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;

        const data = getService().exportExcel(payload.saleIds, filePath, payload.force);

        return success({ exported: true, filePath, ...data });

      } catch (err) {

        return handleMedulaError(err, 'Medula dosyası dışa aktarılamadı.');

      }

    }

  );



  ipcMain.handle(

    'medula:exportCsv',

    async (_event, payload: { saleIds: number[]; force?: boolean }) => {

      try {

        requirePermission(PERMISSIONS.MEDULA_EXPORT);

        const result = await dialogModule.showSaveDialog({

          title: 'Medula Hazırlık CSV Kaydet',

          defaultPath: getService().getDefaultFileName('csv'),

          filters: [{ name: 'CSV', extensions: ['csv'] }],

        });

        if (result.canceled || !result.filePath) return success({ exported: false });

        const filePath = result.filePath.endsWith('.csv') ? result.filePath : `${result.filePath}.csv`;

        const data = getService().exportCsv(payload.saleIds, filePath, payload.force);

        return success({ exported: true, filePath, ...data });

      } catch (err) {

        return handleMedulaError(err, 'Medula CSV dışa aktarılamadı.');

      }

    }

  );



  ipcMain.handle(

    'medula:exportTxt',

    async (_event, payload: { saleIds: number[]; force?: boolean }) => {

      try {

        requirePermission(PERMISSIONS.MEDULA_EXPORT);

        const result = await dialogModule.showSaveDialog({

          title: 'Medula Hazırlık TXT Kaydet',

          defaultPath: getService().getDefaultFileName('txt'),

          filters: [{ name: 'Metin', extensions: ['txt'] }],

        });

        if (result.canceled || !result.filePath) return success({ exported: false });

        const filePath = result.filePath.endsWith('.txt') ? result.filePath : `${result.filePath}.txt`;

        const data = getService().exportTxt(payload.saleIds, filePath, payload.force);

        return success({ exported: true, filePath, ...data });

      } catch (err) {

        return handleMedulaError(err, 'Medula TXT dışa aktarılamadı.');

      }

    }

  );



  ipcMain.handle('medula:markExported', (_event, saleIds: number[]) => {

    try {

      requirePermission(PERMISSIONS.MEDULA_EXPORT);

      return success(getService().markExported(saleIds));

    } catch (err) {

      return handleMedulaError(err);

    }

  });



  ipcMain.handle('medula:markUploaded', (_event, saleIds: number[]) => {

    try {

      requirePermission(PERMISSIONS.MEDULA_EXPORT);

      return success(getService().markUploaded(saleIds));

    } catch (err) {

      return handleMedulaError(err);

    }

  });



  ipcMain.handle('medula:listExports', () => {

    try {

      requirePermission(PERMISSIONS.MEDULA_VIEW);

      return success(getService().listExports());

    } catch (err) {

      return handleMedulaError(err, 'Medula dışa aktarım geçmişi okunamadı.');

    }

  });

}


