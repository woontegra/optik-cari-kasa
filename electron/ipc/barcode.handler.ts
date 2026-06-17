import type { IpcMain } from 'electron';
import { parseScannedCode } from '../services/barcodeParser.service';
import { requireAuth } from './authGuard';
import { handleIpcError, handleUnexpectedError } from './ipcHelpers';
import { success } from './utils';

export function registerBarcodeHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('barcode:parse', (_event, rawCode: string) => {
    try {
      requireAuth();
      return success(parseScannedCode(rawCode ?? ''));
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return handleUnexpectedError('Barkod', err, 'Barkod çözümlenemedi.');
    }
  });
}
