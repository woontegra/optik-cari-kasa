import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { runMigrations } from './schema';
import { seedInitialData } from './seed';
import { AuthService } from '../services/auth.service';

let db: Database.Database | null = null;

export function getAppDataPath(): string {
  const appData = app.getPath('appData');
  const appDir = path.join(appData, 'Woontegra Optik Desktop');
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
  }
  return appDir;
}

export function getDatabasePath(): string {
  return path.join(getAppDataPath(), 'woontegra-optik.sqlite');
}

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDatabasePath();
  const isNew = !fs.existsSync(dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  if (isNew) {
    seedInitialData(db);
  } else {
    new AuthService(db).migrateAdminPassword();
  }

  return db;
}

export function getDatabase(): Database.Database | null {
  return db;
}
