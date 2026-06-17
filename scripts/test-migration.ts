/**
 * Temiz kurulum ve tekrarlı migration smoke testi.
 * Kullanım: npx tsx scripts/test-migration.ts
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../electron/database/schema';
import { seedInitialData } from '../electron/database/seed';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, '..', '.tmp-migration-test');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function runScenario(name: string, dbPath: string, seed = false) {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  if (seed) seedInitialData(db);

  const users = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const products = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
  const drafts = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_drafts'")
    .get();

  runMigrations(db);

  const users2 = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const products2 = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;

  db.close();

  console.log(
    `[${name}] users=${users}→${users2}, products=${products}→${products2}, invoice_drafts=${drafts ? 'OK' : 'MISSING'}`
  );
  if (!drafts) throw new Error('invoice_drafts tablosu oluşmadı');
  if (seed && users < 1) throw new Error('Admin kullanıcı oluşmadı');
  if (products2 < products) throw new Error('Tekrar migration ürün kaybettirdi');
}

try {
  runScenario('temiz-kurulum', path.join(tmpDir, 'fresh.sqlite'), true);
  runScenario('bos-migration', path.join(tmpDir, 'empty.sqlite'), false);
  console.log('Migration testi başarılı.');
} catch (err) {
  console.error('Migration testi başarısız:', (err as Error).message);
  process.exit(1);
}
