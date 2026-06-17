import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { UserService, UserValidationError } from '../services/user.service';
import { AuthError } from '../services/auth.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { success, failure } from './utils';
import type { UserInput } from '../types/user';

function getService(): UserService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new UserService(db);
}

export function registerUserHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('users:list', () => {
    try {
      requirePermission(PERMISSIONS.USERS_MANAGE);
      return success(getService().list());
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('users:getById', (_event, id: number) => {
    try {
      requirePermission(PERMISSIONS.USERS_MANAGE);
      return success(getService().getById(id));
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('users:create', (_event, input: UserInput) => {
    try {
      const session = requirePermission(PERMISSIONS.USERS_MANAGE);
      const result = getService().create(input, session.id);
      return success(result);
    } catch (err) {
      if (err instanceof AuthError || err instanceof UserValidationError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('users:update', (_event, id: number, input: Partial<UserInput>) => {
    try {
      const session = requirePermission(PERMISSIONS.USERS_MANAGE);
      const result = getService().update(id, input, session.id);
      return success(result);
    } catch (err) {
      if (err instanceof AuthError || err instanceof UserValidationError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('users:deactivate', (_event, id: number) => {
    try {
      const session = requirePermission(PERMISSIONS.USERS_MANAGE);
      const result = getService().deactivate(id, session.id);
      return success(result);
    } catch (err) {
      if (err instanceof AuthError || err instanceof UserValidationError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('users:resetPassword', (_event, payload: { id: number; newPassword: string }) => {
    try {
      const session = requirePermission(PERMISSIONS.USERS_MANAGE);
      getService().resetPassword(payload.id, payload.newPassword, session.id);
      return success({ reset: true });
    } catch (err) {
      if (err instanceof AuthError || err instanceof UserValidationError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('users:changePassword', (_event, payload: { id: number; newPassword: string }) => {
    try {
      const session = requirePermission(PERMISSIONS.USERS_MANAGE);
      getService().changePassword(payload.id, payload.newPassword, session.id);
      return success({ changed: true });
    } catch (err) {
      if (err instanceof AuthError || err instanceof UserValidationError) return failure(err.message);
      return failure((err as Error).message);
    }
  });
}
