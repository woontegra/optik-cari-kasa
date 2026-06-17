import type Database from 'better-sqlite3';
import type { AuditListFilters, AuditLogRecord } from '../types/audit';
import { getSession } from './auth.service';

export class AuditService {
  constructor(private db: Database.Database) {}

  log(
    userId: number | null,
    action: string,
    module: string,
    description: string,
    options?: {
      entityType?: string;
      entityId?: number;
      oldValue?: string;
      newValue?: string;
    }
  ): void {
    const session = getSession();
    const uid = userId ?? session?.id ?? null;
    this.db
      .prepare(
        `INSERT INTO audit_logs (user_id, action, module, description, entity_type, entity_id, old_value, new_value, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        uid,
        action,
        module,
        description,
        options?.entityType ?? null,
        options?.entityId ?? null,
        options?.oldValue ?? null,
        options?.newValue ?? null,
        description
      );
  }

  list(filters: AuditListFilters = {}): AuditLogRecord[] {
    let sql = `
      SELECT al.*, u.full_name as user_name, u.username
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.date_from) {
      sql += ` AND date(al.created_at) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(al.created_at) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.user_id) {
      sql += ` AND al.user_id = ?`;
      params.push(filters.user_id);
    }
    if (filters.module) {
      sql += ` AND al.module = ?`;
      params.push(filters.module);
    }
    if (filters.action) {
      sql += ` AND al.action = ?`;
      params.push(filters.action);
    }

    sql += ` ORDER BY al.created_at DESC, al.id DESC LIMIT 1000`;
    return this.db.prepare(sql).all(...params) as AuditLogRecord[];
  }
}
