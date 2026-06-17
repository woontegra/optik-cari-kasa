import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import type { ChangePasswordInput, LoginInput, UserSession } from '../types/auth';
import type { Permission, UserRole } from '../types/permission';
import { PermissionService } from './permission.service';
import { AuditService } from './audit.service';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

let currentSession: UserSession | null = null;

export function getSession(): UserSession | null {
  return currentSession;
}

export function setSession(session: UserSession | null): void {
  currentSession = session;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  if (hash.startsWith('$2')) {
    return bcrypt.compareSync(password, hash);
  }
  // Legacy SHA-256 migration support
  const crypto = require('crypto') as typeof import('crypto');
  const legacy = crypto.createHash('sha256').update(password).digest('hex');
  return legacy === hash;
}

export class AuthService {
  private audit: AuditService;

  constructor(private db: Database.Database) {
    this.audit = new AuditService(db);
  }

  private rowToSession(row: Record<string, unknown>): UserSession {
    const role = String(row.role) as UserRole;
    let customPerms: Permission[] | null = null;
    if (row.permissions) {
      try {
        customPerms = JSON.parse(String(row.permissions)) as Permission[];
      } catch {
        customPerms = null;
      }
    }
    return {
      id: Number(row.id),
      username: String(row.username),
      fullName: String(row.full_name || row.username),
      role,
      permissions: PermissionService.resolvePermissions(role, customPerms),
      mustChangePassword: Number(row.must_change_password) === 1,
    };
  }

  login(input: LoginInput): UserSession {
    const username = input.username?.trim();
    const password = input.password || '';
    if (!username || !password) {
      throw new AuthError('Kullanıcı adı ve şifre zorunludur.');
    }

    const row = this.db
      .prepare(`SELECT * FROM users WHERE username = ? COLLATE NOCASE`)
      .get(username) as Record<string, unknown> | undefined;

    if (!row) {
      this.audit.log(null, 'Hatalı giriş', 'Kimlik Doğrulama', `Bilinmeyen kullanıcı: ${username}`);
      throw new AuthError('Kullanıcı adı veya şifre hatalı.');
    }

    if (Number(row.is_active) !== 1) {
      this.audit.log(Number(row.id), 'Hatalı giriş', 'Kimlik Doğrulama', 'Pasif kullanıcı giriş denemesi');
      throw new AuthError('Hesabınız pasif durumda. Yöneticinize başvurun.');
    }

    if (!verifyPassword(password, String(row.password_hash))) {
      this.audit.log(Number(row.id), 'Hatalı giriş', 'Kimlik Doğrulama', 'Yanlış şifre');
      throw new AuthError('Kullanıcı adı veya şifre hatalı.');
    }

    // Migrate legacy SHA-256 hash to bcrypt
    if (!String(row.password_hash).startsWith('$2')) {
      const newHash = hashPassword(password);
      this.db
        .prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`)
        .run(newHash, row.id);
    }

    this.db
      .prepare(`UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(row.id);

    const session = this.rowToSession(row);
    setSession(session);
    this.audit.log(session.id, 'Giriş', 'Kimlik Doğrulama', `${session.username} giriş yaptı`);
    return session;
  }

  logout(): void {
    if (currentSession) {
      this.audit.log(currentSession.id, 'Çıkış', 'Kimlik Doğrulama', `${currentSession.username} çıkış yaptı`);
    }
    setSession(null);
  }

  getSession(): UserSession | null {
    return currentSession;
  }

  changePassword(userId: number, input: ChangePasswordInput): void {
    const row = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new AuthError('Kullanıcı bulunamadı.');

    if (!verifyPassword(input.currentPassword, String(row.password_hash))) {
      throw new AuthError('Mevcut şifre hatalı.');
    }
    if (!input.newPassword || input.newPassword.length < 6) {
      throw new AuthError('Yeni şifre en az 6 karakter olmalıdır.');
    }

    const newHash = hashPassword(input.newPassword);
    this.db
      .prepare(
        `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(newHash, userId);

    if (currentSession?.id === userId) {
      setSession({ ...currentSession, mustChangePassword: false });
    }

    this.audit.log(userId, 'Şifre değiştirme', 'Kullanıcı', 'Kullanıcı şifresini değiştirdi');
  }

  unlock(password: string): UserSession {
    if (!currentSession) throw new AuthError('Oturum bulunamadı.');
    const row = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(currentSession.id) as
      | Record<string, unknown>
      | undefined;
    if (!row || !verifyPassword(password, String(row.password_hash))) {
      throw new AuthError('Şifre hatalı.');
    }
    return currentSession;
  }

  migrateAdminPassword(): void {
    const admin = this.db.prepare(`SELECT id, password_hash FROM users WHERE username = 'admin'`).get() as
      | { id: number; password_hash: string }
      | undefined;
    if (!admin) return;
    if (!admin.password_hash.startsWith('$2')) {
      const newHash = hashPassword('admin123');
      this.db
        .prepare(
          `UPDATE users SET password_hash = ?, must_change_password = 1, role = 'Yönetici', updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(newHash, admin.id);
    }
  }
}
