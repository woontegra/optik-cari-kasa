import type Database from 'better-sqlite3';
import type {
  OpticalLookupInput,
  OpticalLookupListFilters,
  OpticalLookupType,
} from '../types/opticalLookup';

export class OpticalLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpticalLookupError';
  }
}

export class OpticalLookupService {
  constructor(private db: Database.Database) {}

  list(filters: OpticalLookupListFilters = {}): Record<string, unknown>[] {
    let sql = `
      SELECT v.*, p.name as parent_name
      FROM optical_lookup_values v
      LEFT JOIN optical_lookup_values p ON p.id = v.parent_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.type) {
      sql += ` AND v.type = ?`;
      params.push(filters.type);
    }
    if (filters.parent_id !== undefined) {
      sql += ` AND v.parent_id = ?`;
      params.push(filters.parent_id);
    }
    if (filters.active_only !== false) {
      sql += ` AND v.is_active = 1`;
    }
    if (filters.search?.trim()) {
      sql += ` AND (v.name LIKE ? OR v.code LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY v.sort_order, v.name`;
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }

  listByType(type: OpticalLookupType, activeOnly = true): Record<string, unknown>[] {
    return this.list({ type, active_only: activeOnly });
  }

  listChildren(parentId: number, activeOnly = true): Record<string, unknown>[] {
    return this.list({ parent_id: parentId, active_only: activeOnly });
  }

  getById(id: number): Record<string, unknown> | null {
    const row = this.db
      .prepare(
        `SELECT v.*, p.name as parent_name FROM optical_lookup_values v
         LEFT JOIN optical_lookup_values p ON p.id = v.parent_id WHERE v.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    return row || null;
  }

  create(input: OpticalLookupInput): { id: number } {
    const name = input.name?.trim();
    if (!name) throw new OpticalLookupError('Ad zorunludur.');
    if (!input.type) throw new OpticalLookupError('Tür zorunludur.');

    const dup = this.db
      .prepare(
        `SELECT id FROM optical_lookup_values
         WHERE type = ? AND LOWER(name) = LOWER(?) AND COALESCE(parent_id, 0) = COALESCE(?, 0)`
      )
      .get(input.type, name, input.parent_id ?? null);
    if (dup) throw new OpticalLookupError('Bu tanım zaten mevcut.');

    const maxSort = this.db
      .prepare(`SELECT COALESCE(MAX(sort_order), 0) as m FROM optical_lookup_values WHERE type = ?`)
      .get(input.type) as { m: number };

    const result = this.db
      .prepare(
        `INSERT INTO optical_lookup_values (type, parent_id, name, code, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`
      )
      .run(
        input.type,
        input.parent_id ?? null,
        name,
        input.code?.trim() || null,
        input.sort_order ?? maxSort.m + 1
      );

    return { id: Number(result.lastInsertRowid) };
  }

  update(id: number, input: Partial<OpticalLookupInput>): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new OpticalLookupError('Tanım bulunamadı.');

    const name = (input.name ?? existing.name)?.toString().trim();
    if (!name) throw new OpticalLookupError('Ad zorunludur.');

    this.db
      .prepare(
        `UPDATE optical_lookup_values SET
          name = ?, code = ?, parent_id = ?, sort_order = ?,
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        name,
        input.code !== undefined ? input.code?.trim() || null : existing.code,
        input.parent_id !== undefined ? input.parent_id : existing.parent_id,
        input.sort_order !== undefined ? input.sort_order : existing.sort_order,
        id
      );

    return { id };
  }

  deactivate(id: number): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new OpticalLookupError('Tanım bulunamadı.');
    this.db
      .prepare(
        `UPDATE optical_lookup_values SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(id);
    return { id };
  }

  reorder(ids: number[]): void {
    const update = this.db.prepare(`UPDATE optical_lookup_values SET sort_order = ? WHERE id = ?`);
    ids.forEach((id, index) => update.run(index + 1, id));
  }

  /** Import için: yoksa oluştur, varsa id döndür */
  findOrCreate(
    type: OpticalLookupType,
    name: string,
    parentId?: number | null,
    autoCreate = true
  ): { id: number; created: boolean } | null {
    const trimmed = name?.trim();
    if (!trimmed) return null;

    const existing = this.db
      .prepare(
        `SELECT id FROM optical_lookup_values
         WHERE type = ? AND LOWER(name) = LOWER(?) AND COALESCE(parent_id, 0) = COALESCE(?, 0)`
      )
      .get(type, trimmed, parentId ?? null) as { id: number } | undefined;

    if (existing) return { id: existing.id, created: false };
    if (!autoCreate) return null;

    const created = this.create({ type, name: trimmed, parent_id: parentId ?? null });
    return { id: created.id, created: true };
  }

  getNameById(id?: number | null): string | null {
    if (!id) return null;
    const row = this.db.prepare(`SELECT name FROM optical_lookup_values WHERE id = ?`).get(id) as
      | { name: string }
      | undefined;
    return row?.name || null;
  }
}
