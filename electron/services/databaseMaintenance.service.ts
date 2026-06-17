import type Database from 'better-sqlite3';
import { getDatabasePath } from '../database';

export class DatabaseMaintenanceService {
  constructor(private db: Database.Database) {}

  integrityCheck(): { ok: boolean; message: string } {
    const row = this.db.pragma('integrity_check', { simple: true }) as { integrity_check: string };
    const result = row?.integrity_check ?? String(row);
    const ok = result === 'ok';
    return {
      ok,
      message: ok ? 'Veritabanı bütünlük kontrolü başarılı.' : `Bütünlük hatası: ${result}`,
    };
  }

  vacuum(): { ok: boolean; message: string; dbPath: string } {
    this.db.exec('VACUUM');
    return {
      ok: true,
      message: 'Veritabanı boşluk temizleme (VACUUM) tamamlandı.',
      dbPath: getDatabasePath(),
    };
  }
}
