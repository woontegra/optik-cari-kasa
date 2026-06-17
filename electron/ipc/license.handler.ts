import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { LicenseService } from '../services/license.service';
import { AuditService } from '../services/audit.service';
import { DEMO_LICENSE_KEY } from '../types/license';
import type { LicenseActivateInput } from '../types/license';
import { logError } from '../services/logger.service';
import { getDeviceHash, getDeviceName } from '../services/device.service';
import { success, failure } from './utils';

function getService(): LicenseService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new LicenseService(db);
}

function getAudit(): AuditService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new AuditService(db);
}

export function registerLicenseHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('license:getStatus', () => {
    try {
      const status = getService().getStatus();
      return success(status);
    } catch (err) {
      logError('Lisans', 'Durum okunamadı', err);
      return failure('Lisans bilgisi okunamadı.');
    }
  });

  ipcMain.handle('license:activate', async (_event, input: LicenseActivateInput) => {
    try {
      const result = await getService().activate(input);
      if (!result.success) {
        return failure(result.error || 'Aktivasyon başarısız');
      }
      getAudit().log(null, 'Aktivasyon', 'Lisans', `Lisans aktifleştirildi: ${input.licenseKey.slice(0, 6)}***`);
      return success({ activated: true });
    } catch (err) {
      logError('Lisans', 'Aktivasyon hatası', err);
      return failure('Lisans aktifleştirilemedi. Lütfen bilgilerinizi kontrol edin.');
    }
  });

  ipcMain.handle('license:activateDemo', async (_event, input?: { companyName?: string; email?: string }) => {
    try {
      const result = await getService().activate({
        licenseKey: DEMO_LICENSE_KEY,
        companyName: input?.companyName || 'Demo Firma',
        customerEmail: input?.email,
      });
      if (!result.success) {
        return failure(result.error || 'Demo aktivasyon başarısız');
      }
      getAudit().log(null, 'Aktivasyon', 'Lisans', 'Demo lisans aktifleştirildi');
      return success({ activated: true });
    } catch (err) {
      logError('Lisans', 'Demo aktivasyon hatası', err);
      return failure('Demo lisans aktifleştirilemedi.');
    }
  });

  ipcMain.handle('license:revalidate', async () => {
    try {
      const result = await getService().revalidate();
      if (!result.success) {
        return failure(result.error || 'Doğrulama başarısız');
      }
      getAudit().log(null, 'Doğrulama', 'Lisans', 'Lisans yeniden doğrulandı');
      return success({ validated: true, warning: result.warning });
    } catch (err) {
      logError('Lisans', 'Yeniden doğrulama hatası', err);
      return failure('Lisans doğrulanamadı. İnternet bağlantınızı kontrol edin.');
    }
  });

  ipcMain.handle('license:getInfo', () => {
    try {
      const info = getService().getInfo();
      const status = getService().getStatus();
      return success({ info, status });
    } catch (err) {
      logError('Lisans', 'Bilgi okunamadı', err);
      return failure('Lisans bilgileri okunamadı.');
    }
  });

  ipcMain.handle('license:changeKey', async (_event, input: LicenseActivateInput) => {
    try {
      const result = await getService().changeKey(input);
      if (!result.success) {
        return failure(result.error || 'Lisans anahtarı değiştirilemedi');
      }
      getAudit().log(null, 'Güncelleme', 'Lisans', 'Lisans anahtarı değiştirildi');
      return success({ changed: true });
    } catch (err) {
      logError('Lisans', 'Anahtar değiştirme hatası', err);
      return failure('Lisans anahtarı değiştirilemedi.');
    }
  });

  ipcMain.handle('license:copyInfo', () => {
    try {
      const text = getService().getCopyText();
      return success({ text });
    } catch (err) {
      return failure('Lisans bilgileri kopyalanamadı.');
    }
  });

  ipcMain.handle('license:getDeviceInfo', () => {
    try {
      return success({ deviceName: getDeviceName(), deviceHash: getDeviceHash() });
    } catch (err) {
      return failure('Cihaz bilgisi alınamadı.');
    }
  });
}
