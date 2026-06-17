import type Database from 'better-sqlite3';
import type { UserInput, UserListItem, UserRecord } from '../types/user';
import type { Permission, UserRole } from '../types/permission';
import { hashPassword } from './auth.service';
import { AuditService } from './audit.service';

export class UserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserValidationError';
  }
}

export class UserService {
  private audit: AuditService;

  constructor(private db: Database.Database) {
    this.audit = new AuditService(db);
  }

  private parsePermissions(raw: string | null): Permission[] | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Permission[];
    } catch {
      return null;
    }
  }

  list(): UserListItem[] {
    return this.db
      .prepare(
        `SELECT id, full_name, username, role, phone, email, is_active, last_login_at
         FROM users ORDER BY full_name, username`
      )
      .all() as UserListItem[];
  }

  getById(id: number): UserRecord | null {
    const row = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: Number(row.id),
      full_name: String(row.full_name || ''),
      username: String(row.username),
      role: String(row.role) as UserRole,
      phone: row.phone ? String(row.phone) : null,
      email: row.email ? String(row.email) : null,
      permissions: this.parsePermissions(row.permissions ? String(row.permissions) : null),
      is_active: Number(row.is_active),
      must_change_password: Number(row.must_change_password),
      last_login_at: row.last_login_at ? String(row.last_login_at) : null,
      created_at: String(row.created_at),
      updated_at: row.updated_at ? String(row.updated_at) : null,
    };
  }

  create(input: UserInput, actorId: number): { id: number } {
    if (!input.full_name?.trim()) throw new UserValidationError('Ad soyad zorunludur.');
    if (!input.username?.trim()) throw new UserValidationError('Kullanıcı adı zorunludur.');
    if (!input.password || input.password.length < 6) {
      throw new UserValidationError('Şifre en az 6 karakter olmalıdır.');
    }

    const exists = this.db
      .prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`)
      .get(input.username.trim());
    if (exists) throw new UserValidationError('Bu kullanıcı adı zaten kullanılıyor.');

    const permsJson = input.permissions?.length ? JSON.stringify(input.permissions) : null;
    const result = this.db
      .prepare(
        `INSERT INTO users (full_name, username, password_hash, role, phone, email, permissions, is_active, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        input.full_name.trim(),
        input.username.trim(),
        hashPassword(input.password),
        input.role,
        input.phone?.trim() || null,
        input.email?.trim() || null,
        permsJson,
        input.is_active === false ? 0 : 1
      );

    const id = Number(result.lastInsertRowid);
    this.audit.log(actorId, 'Oluşturma', 'Kullanıcı', `Yeni kullanıcı: ${input.username}`, {
      entityType: 'user',
      entityId: id,
    });
    return { id };
  }

  update(id: number, input: Partial<UserInput>, actorId: number): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new UserValidationError('Kullanıcı bulunamadı.');

    if (input.username && input.username.trim() !== existing.username) {
      const dup = this.db
        .prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?`)
        .get(input.username.trim(), id);
      if (dup) throw new UserValidationError('Bu kullanıcı adı zaten kullanılıyor.');
    }

    const permsJson =
      input.permissions !== undefined
        ? input.permissions.length
          ? JSON.stringify(input.permissions)
          : null
        : existing.permissions
          ? JSON.stringify(existing.permissions)
          : null;

    this.db
      .prepare(
        `UPDATE users SET
          full_name = ?, username = ?, role = ?, phone = ?, email = ?,
          permissions = ?, is_active = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.full_name?.trim() ?? existing.full_name,
        input.username?.trim() ?? existing.username,
        input.role ?? existing.role,
        input.phone?.trim() ?? existing.phone,
        input.email?.trim() ?? existing.email,
        permsJson,
        input.is_active === false ? 0 : input.is_active === true ? 1 : existing.is_active,
        id
      );

    this.audit.log(actorId, 'Güncelleme', 'Kullanıcı', `Kullanıcı güncellendi: ${existing.username}`, {
      entityType: 'user',
      entityId: id,
    });
    return { id };
  }

  deactivate(id: number, actorId: number): { id: number } {
    const user = this.getById(id);
    if (!user) throw new UserValidationError('Kullanıcı bulunamadı.');
    if (user.username === 'admin') throw new UserValidationError('Varsayılan admin kullanıcısı pasife alınamaz.');

    this.db
      .prepare(`UPDATE users SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(id);
    this.audit.log(actorId, 'Pasife alma', 'Kullanıcı', `Kullanıcı pasife alındı: ${user.username}`, {
      entityType: 'user',
      entityId: id,
    });
    return { id };
  }

  resetPassword(id: number, newPassword: string, actorId: number): void {
    if (!newPassword || newPassword.length < 6) {
      throw new UserValidationError('Şifre en az 6 karakter olmalıdır.');
    }
    const user = this.getById(id);
    if (!user) throw new UserValidationError('Kullanıcı bulunamadı.');

    this.db
      .prepare(
        `UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(hashPassword(newPassword), id);

    this.audit.log(actorId, 'Şifre sıfırlama', 'Kullanıcı', `Şifre sıfırlandı: ${user.username}`, {
      entityType: 'user',
      entityId: id,
    });
  }

  changePassword(id: number, newPassword: string, actorId: number): void {
    if (!newPassword || newPassword.length < 6) {
      throw new UserValidationError('Şifre en az 6 karakter olmalıdır.');
    }
    this.db
      .prepare(
        `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(hashPassword(newPassword), id);
    this.audit.log(actorId, 'Şifre değiştirme', 'Kullanıcı', `Yönetici şifre değiştirdi`, {
      entityType: 'user',
      entityId: id,
    });
  }
}
