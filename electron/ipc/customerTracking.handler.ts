import fs from 'fs';
import path from 'path';
import type { IpcMain, Dialog } from 'electron';
import { getDatabase } from '../database';
import { CustomerService, CustomerValidationError } from '../services/customer.service';
import {
  AppointmentService,
  AppointmentValidationError,
} from '../services/appointment.service';
import {
  CommunicationService,
  CommunicationValidationError,
  CustomerImportantDateService,
} from '../services/communication.service';
import { CustomerDocumentService } from '../services/customerDocument.service';
import { requireAuth, requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError } from './ipcHelpers';
import { success, failure } from './utils';
import type {
  AppointmentInput,
  AppointmentListFilters,
  CommunicationLogInput,
  CommunicationTemplateInput,
  CustomerDocumentType,
  CustomerReminderListFilters,
  ImportantDateInput,
  PrepareMessageInput,
} from '../types/customerTracking';

function db() {
  const database = getDatabase();
  if (!database) throw new Error('Veritabanı başlatılamadı');
  return database;
}

function handleError(err: unknown) {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (
    err instanceof CustomerValidationError ||
    err instanceof AppointmentValidationError ||
    err instanceof CommunicationValidationError
  ) {
    return failure(err.message);
  }
  return failure((err as Error).message);
}

export function registerCustomerTrackingHandlers(ipcMain: IpcMain, dialog: Dialog): void {
  ipcMain.handle('appointments:list', (_event, filters?: AppointmentListFilters) => {
    try {
      requirePermission(PERMISSIONS.APPOINTMENTS_VIEW);
      return success(new AppointmentService(db()).list(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('appointments:getByCustomer', (_event, customerId: number) => {
    try {
      requirePermission(PERMISSIONS.APPOINTMENTS_VIEW);
      return success(new AppointmentService(db()).getByCustomer(customerId));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('appointments:create', (_event, input: AppointmentInput) => {
    try {
      const session = requirePermission(PERMISSIONS.APPOINTMENTS_EDIT);
      const result = new AppointmentService(db()).create(input, session.id);
      auditAction(session.id, 'Oluşturma', 'Randevu', `Randevu oluşturuldu #${result.id}`, {
        entityType: 'appointment',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('appointments:update', (_event, id: number, input: Partial<AppointmentInput>) => {
    try {
      const session = requirePermission(PERMISSIONS.APPOINTMENTS_EDIT);
      const result = new AppointmentService(db()).update(id, input);
      auditAction(session.id, 'Güncelleme', 'Randevu', `Randevu güncellendi #${id}`, {
        entityType: 'appointment',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('appointments:updateStatus', (_event, id: number, status: string) => {
    try {
      const session = requirePermission(PERMISSIONS.APPOINTMENTS_EDIT);
      const result = new AppointmentService(db()).updateStatus(id, status);
      auditAction(session.id, 'Durum Güncelleme', 'Randevu', `Randevu durumu: ${status} #${id}`, {
        entityType: 'appointment',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('appointments:cancel', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.APPOINTMENTS_EDIT);
      const result = new AppointmentService(db()).cancel(id);
      auditAction(session.id, 'İptal', 'Randevu', `Randevu iptal edildi #${id}`, {
        entityType: 'appointment',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customerDates:list', (_event, customerId: number) => {
    try {
      requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
      return success(new CustomerImportantDateService(db()).listByCustomer(customerId));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customerDates:create', (_event, input: ImportantDateInput) => {
    try {
      const session = requirePermission(PERMISSIONS.CUSTOMERS_EDIT);
      const result = new CustomerImportantDateService(db()).create(input);
      auditAction(session.id, 'Oluşturma', 'Önemli Tarih', `${input.title} eklendi`, {
        entityType: 'customer_date',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customerDates:update', (_event, id: number, input: Partial<ImportantDateInput>) => {
    try {
      const session = requirePermission(PERMISSIONS.CUSTOMERS_EDIT);
      const result = new CustomerImportantDateService(db()).update(id, input);
      auditAction(session.id, 'Güncelleme', 'Önemli Tarih', `Önemli tarih güncellendi #${id}`, {
        entityType: 'customer_date',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customerDates:deactivate', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.CUSTOMERS_EDIT);
      const result = new CustomerImportantDateService(db()).deactivate(id);
      auditAction(session.id, 'Pasife alma', 'Önemli Tarih', `Önemli tarih pasife alındı #${id}`, {
        entityType: 'customer_date',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('communicationTemplates:list', () => {
    try {
      requirePermission(PERMISSIONS.COMMUNICATIONS_VIEW);
      return success(new CommunicationService(db()).listTemplates(false));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('communicationTemplates:create', (_event, input: CommunicationTemplateInput) => {
    try {
      const session = requirePermission(PERMISSIONS.COMMUNICATIONS_EDIT);
      const result = new CommunicationService(db()).createTemplate(input);
      auditAction(session.id, 'Oluşturma', 'Mesaj Şablonu', input.name, {
        entityType: 'communication_template',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('communicationTemplates:update', (_event, id: number, input: Partial<CommunicationTemplateInput>) => {
    try {
      const session = requirePermission(PERMISSIONS.COMMUNICATIONS_EDIT);
      const result = new CommunicationService(db()).updateTemplate(id, input);
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('communicationTemplates:deactivate', (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.COMMUNICATIONS_EDIT);
      return success(new CommunicationService(db()).deactivateTemplate(id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('communications:prepareMessage', (_event, input: PrepareMessageInput) => {
    try {
      const session = requirePermission(PERMISSIONS.COMMUNICATIONS_EDIT);
      const result = new CommunicationService(db()).prepareMessage(input);
      auditAction(session.id, 'Mesaj Hazırlama', 'İletişim', `${input.channel} mesajı hazırlandı`, {
        entityType: 'customer',
        entityId: input.customer_id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('communications:log', (_event, input: CommunicationLogInput) => {
    try {
      const session = requirePermission(PERMISSIONS.COMMUNICATIONS_EDIT);
      const result = new CommunicationService(db()).log(input, session.id);
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('communications:markSent', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.COMMUNICATIONS_EDIT);
      const result = new CommunicationService(db()).markSent(id);
      auditAction(session.id, 'Gönderildi İşaretlendi', 'İletişim', `İletişim kaydı #${id}`, {
        entityType: 'communication_log',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('communications:listByCustomer', (_event, customerId: number) => {
    try {
      requirePermission(PERMISSIONS.COMMUNICATIONS_VIEW);
      return success(new CommunicationService(db()).listByCustomer(customerId));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customerDocuments:print', (_event, documentType: CustomerDocumentType, customerId: number) => {
    try {
      const session = requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
      const result = new CustomerDocumentService(db()).print(documentType, customerId);
      auditAction(session.id, 'Yazdırma', 'Müşteri Belgesi', documentType, {
        entityType: 'customer',
        entityId: customerId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:uploadPhoto', async (_event, customerId: number) => {
    try {
      const session = requirePermission(PERMISSIONS.CUSTOMERS_EDIT);
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Fotoğraf', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      });
      if (result.canceled || !result.filePaths[0]) return success({ cancelled: true });
      const upload = new CustomerService(db()).uploadPhoto(customerId, result.filePaths[0]);
      auditAction(session.id, 'Fotoğraf Eklendi', 'Müşteri', `Müşteri #${customerId}`, {
        entityType: 'customer',
        entityId: customerId,
      });
      return success(upload);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:removePhoto', (_event, customerId: number) => {
    try {
      const session = requirePermission(PERMISSIONS.CUSTOMERS_EDIT);
      const result = new CustomerService(db()).removePhoto(customerId);
      auditAction(session.id, 'Fotoğraf Kaldırıldı', 'Müşteri', `Müşteri #${customerId}`, {
        entityType: 'customer',
        entityId: customerId,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:getReminderLists', (_event, filters?: CustomerReminderListFilters) => {
    try {
      requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
      return success(new CustomerService(db()).getReminderLists(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:listCategories', () => {
    try {
      requireAuth();
      return success(new CustomerService(db()).listCategories());
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:getPhotoData', (_event, customerId: number) => {
    try {
      requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
      const customer = new CustomerService(db()).getById(customerId);
      if (!customer?.photo_path) return success({ dataUrl: null });
      const photoPath = String(customer.photo_path);
      if (!fs.existsSync(photoPath)) return success({ dataUrl: null });
      const buf = fs.readFileSync(photoPath);
      const ext = path.extname(photoPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return success({ dataUrl: `data:${mime};base64,${buf.toString('base64')}` });
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('customers:exportReminderList', async (_event, filters?: CustomerReminderListFilters) => {
    try {
      requirePermission(PERMISSIONS.EXCEL_EXPORT);
      const XLSX = await import('xlsx');
      const result = await dialog.showSaveDialog({
        title: 'Müşteri Listesini Kaydet',
        defaultPath: `musteri-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return success({ exported: false });
      const rows = new CustomerService(db()).getReminderLists(filters);
      const data = rows.map((c) => ({
        'Ad Soyad': c.full_name,
        'T.C.': c.tc_no || '',
        Telefon: c.phone || '',
        WhatsApp: c.whatsapp_phone || '',
        'E-posta': c.email || '',
        Kategori: c.customer_category || '',
        Bakiye: c.balance,
        'Son Satış': c.last_sale_date || '',
        'SMS İzni': c.sms_permission ? 'Evet' : 'Hayır',
        'E-posta İzni': c.email_permission ? 'Evet' : 'Hayır',
        'WhatsApp İzni': c.whatsapp_permission ? 'Evet' : 'Hayır',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Müşteriler');
      XLSX.writeFile(wb, result.filePath);
      return success({ exported: true, filePath: result.filePath });
    } catch (err) {
      return handleError(err);
    }
  });
}
