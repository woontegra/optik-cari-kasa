import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { CampaignService, CampaignValidationError } from '../services/campaign.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { auditAction, handleIpcError } from './ipcHelpers';
import { success, failure } from './utils';
import type { CalculateSaleInput, CampaignInput, CampaignReportFilter } from '../types/campaign';

function db() {
  const database = getDatabase();
  if (!database) throw new Error('Veritabanı başlatılamadı');
  return database;
}

function handleError(err: unknown) {
  const auth = handleIpcError(err);
  if (auth) return auth;
  if (err instanceof CampaignValidationError) return failure(err.message);
  return failure((err as Error).message);
}

export function registerCampaignHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('campaigns:list', (_e, filters?: { status?: string; activeOnly?: boolean }) => {
    try {
      requirePermission(PERMISSIONS.CAMPAIGN_VIEW);
      return success(new CampaignService(db()).list(filters));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('campaigns:listActive', () => {
    try {
      requirePermission(PERMISSIONS.SALES_CREATE);
      return success(new CampaignService(db()).listActive());
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('campaigns:getById', (_e, id: number) => {
    try {
      requirePermission(PERMISSIONS.CAMPAIGN_VIEW);
      return success(new CampaignService(db()).getById(id));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('campaigns:create', (_e, input: CampaignInput) => {
    try {
      const session = requirePermission(PERMISSIONS.CAMPAIGN_EDIT);
      const result = new CampaignService(db()).create(input, session.id);
      auditAction(session.id, 'Oluşturma', 'Kampanya', input.name, {
        entityType: 'campaign',
        entityId: result.id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('campaigns:update', (_e, id: number, input: Partial<CampaignInput>) => {
    try {
      const session = requirePermission(PERMISSIONS.CAMPAIGN_EDIT);
      const result = new CampaignService(db()).update(id, input);
      auditAction(session.id, 'Güncelleme', 'Kampanya', `Kampanya #${id}`, {
        entityType: 'campaign',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('campaigns:activate', (_e, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.CAMPAIGN_EDIT);
      const result = new CampaignService(db()).activate(id);
      auditAction(session.id, 'Aktif', 'Kampanya', `Kampanya aktif: #${id}`, {
        entityType: 'campaign',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('campaigns:deactivate', (_e, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.CAMPAIGN_EDIT);
      const result = new CampaignService(db()).deactivate(id);
      auditAction(session.id, 'Pasif', 'Kampanya', `Kampanya pasif: #${id}`, {
        entityType: 'campaign',
        entityId: id,
      });
      return success(result);
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('campaigns:calculateForSale', (_e, input: CalculateSaleInput) => {
    try {
      requirePermission(PERMISSIONS.SALES_CREATE);
      return success(new CampaignService(db()).calculateForSale(input));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('campaigns:validateCode', (_e, code: string, input: CalculateSaleInput) => {
    try {
      requirePermission(PERMISSIONS.SALES_CREATE);
      return success(new CampaignService(db()).validateCode(code, input));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('campaigns:getReport', (_e, filter?: CampaignReportFilter) => {
    try {
      requirePermission(PERMISSIONS.CAMPAIGN_VIEW);
      return success(new CampaignService(db()).getReport(filter));
    } catch (err) {
      return handleError(err);
    }
  });

  ipcMain.handle('campaigns:listSales', (_e, filter?: CampaignReportFilter) => {
    try {
      requirePermission(PERMISSIONS.CAMPAIGN_VIEW);
      return success(new CampaignService(db()).listCampaignSales(filter));
    } catch (err) {
      return handleError(err);
    }
  });
}
