import { getSession } from '../services/auth.service';
import type { Permission } from '../types/permission';
import { AuthError } from '../services/auth.service';

export function requireAuth() {
  const session = getSession();
  if (!session) {
    throw new AuthError('Oturum bulunamadı. Lütfen giriş yapın.');
  }
  return session;
}

export function requirePermission(permission: Permission) {
  const session = requireAuth();
  if (session.role !== 'Yönetici' && !session.permissions.includes(permission)) {
    throw new AuthError('Bu işlem için yetkiniz yok.');
  }
  return session;
}

export function handleAuthError(err: unknown) {
  if (err instanceof AuthError) {
    return { success: false as const, error: err.message };
  }
  return null;
}
