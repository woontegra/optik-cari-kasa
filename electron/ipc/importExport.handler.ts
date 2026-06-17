import type { IpcMain, dialog } from 'electron';

import { getDatabase } from '../database';

import { ImportExportService, ImportExportError, suggestColumnMapping } from '../services/importExport.service';

import { requirePermission } from './authGuard';

import { PERMISSIONS } from '../types/permission';

import { handleUnexpectedError } from './ipcHelpers';

import { success, failure } from './utils';

import type { ColumnMapping, ImportExecuteInput } from '../types/importExport';



function getService(): ImportExportService {

  const db = getDatabase();

  if (!db) throw new Error('Veritabanı başlatılamadı');

  return new ImportExportService(db);

}



function handleImportError(err: unknown, userMessage = 'Excel işlemi yapılamadı.') {

  if (err instanceof ImportExportError) return failure(err.message);

  return handleUnexpectedError('Excel', err, userMessage);

}



export function registerImportExportHandlers(ipcMain: IpcMain, dialogModule: typeof dialog): void {

  ipcMain.handle('products:selectImportFile', async () => {

    try {

      requirePermission(PERMISSIONS.STOCK_EDIT);

      const result = await dialogModule.showOpenDialog({

        title: 'Excel Dosyası Seç',

        filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }],

        properties: ['openFile'],

      });



      if (result.canceled || !result.filePaths[0]) {

        return success(null);

      }



      const parsed = getService().parseFile(result.filePaths[0]);

      const suggestedMapping = suggestColumnMapping(parsed.headers);

      return success({ ...parsed, suggestedMapping });

    } catch (err) {

      return handleImportError(err, 'Excel dosyası okunamadı.');

    }

  });



  ipcMain.handle(

    'products:previewImport',

    (_event, payload: { rows: Record<string, string>[]; mapping: ColumnMapping }) => {

      try {

        requirePermission(PERMISSIONS.STOCK_EDIT);

        const preview = getService().previewImport(payload.rows, payload.mapping);

        return success(preview);

      } catch (err) {

        return handleImportError(err, 'İçe aktarım önizlemesi oluşturulamadı.');

      }

    }

  );



  ipcMain.handle('products:importFromExcel', (_event, payload: ImportExecuteInput) => {

    try {

      requirePermission(PERMISSIONS.STOCK_EDIT);

      const result = getService().executeImport(payload);

      return success(result);

    } catch (err) {

      return handleImportError(err, 'Ürünler içe aktarılamadı.');

    }

  });



  ipcMain.handle('products:exportToExcel', async () => {

    try {

      requirePermission(PERMISSIONS.EXCEL_EXPORT);

      const today = new Date().toISOString().slice(0, 10);

      const defaultName = `woontegra-optik-stok-${today}.xlsx`;

      const result = await dialogModule.showSaveDialog({

        title: 'Excel Dosyası Kaydet',

        defaultPath: defaultName,

        filters: [{ name: 'Excel', extensions: ['xlsx'] }],

      });



      if (result.canceled || !result.filePath) {

        return success({ exported: false });

      }



      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;

      getService().exportToFile(filePath);

      return success({ exported: true, filePath });

    } catch (err) {

      return handleImportError(err, 'Stok dışa aktarılamadı.');

    }

  });



  ipcMain.handle('products:downloadImportTemplate', async () => {

    try {

      requirePermission(PERMISSIONS.STOCK_VIEW);

      const result = await dialogModule.showSaveDialog({

        title: 'Şablon Kaydet',

        defaultPath: 'woontegra-optik-stok-sablonu.xlsx',

        filters: [{ name: 'Excel', extensions: ['xlsx'] }],

      });



      if (result.canceled || !result.filePath) {

        return success({ saved: false });

      }



      const filePath = result.filePath.endsWith('.xlsx') ? result.filePath : `${result.filePath}.xlsx`;

      getService().generateTemplate(filePath);

      return success({ saved: true, filePath });

    } catch (err) {

      return handleImportError(err, 'Şablon indirilemedi.');

    }

  });

}


