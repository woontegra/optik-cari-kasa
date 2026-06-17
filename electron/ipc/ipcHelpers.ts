import { getDatabase } from '../database';
import { AuditService } from '../services/audit.service';
import { AuthError } from '../services/auth.service';
import { logError } from '../services/logger.service';
import { failure, type IpcResult } from './utils';

export function getAudit(): AuditService {
  const db = getDatabase();
  if (!db) throw new Error('Veritabanı başlatılamadı');
  return new AuditService(db);
}

export function handleIpcError(err: unknown) {
  if (err instanceof AuthError) return failure(err.message);
  return null;
}

export function handleUnexpectedError(
  category: string,
  err: unknown,
  userMessage = 'İşlem sırasında bir hata oluştu.'
): IpcResult {
  const auth = handleIpcError(err);
  if (auth) return auth;
  logError(category, userMessage, err);
  return failure(userMessage);
}

export function auditAction(
  userId: number,
  action: string,
  module: string,
  description: string,
  options?: { entityType?: string; entityId?: number }
) {
  try {
    getAudit().log(userId, action, module, description, options);
  } catch {
    // ignore audit failures
  }
}
