import type { IpcMain } from 'electron';
import { getDatabase } from '../database';
import { AuthService, AuthError } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';
import { success, failure } from './utils';
import type { ChangePasswordInput, LoginInput } from '../types/auth';

function getAuthService(): AuthService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new AuthService(db);
}

export function registerAuthHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('auth:login', (_event, input: LoginInput) => {
    try {
      const session = getAuthService().login(input);
      return success(session);
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('auth:logout', () => {
    try {
      getAuthService().logout();
      return success({ loggedOut: true });
    } catch (err) {
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('auth:getSession', () => {
    try {
      const session = getAuthService().getSession();
      return success(session);
    } catch (err) {
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('auth:changePassword', (_event, input: ChangePasswordInput) => {
    try {
      const session = getAuthService().getSession();
      if (!session) return failure('Oturum bulunamadı.');
      getAuthService().changePassword(session.id, input);
      return success({ changed: true, mustChangePassword: false });
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('auth:unlock', (_event, password: string) => {
    try {
      const session = getAuthService().unlock(password);
      return success(session);
    } catch (err) {
      if (err instanceof AuthError) return failure(err.message);
      return failure((err as Error).message);
    }
  });

  ipcMain.handle('permissions:getCurrent', () => {
    try {
      const session = getAuthService().getSession();
      if (!session) return success(null);
      return success({
        role: session.role,
        permissions: session.permissions,
        roleDefaults: PermissionService.resolvePermissions(session.role, null),
      });
    } catch (err) {
      return failure((err as Error).message);
    }
  });
}
