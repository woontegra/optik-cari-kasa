import fs from 'fs';
import path from 'path';
import { getAppDataPath } from '../database';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

let logDirEnsured = false;

function ensureLogDir(): string {
  const dir = path.join(getAppDataPath(), 'logs');
  if (!logDirEnsured) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    logDirEnsured = true;
  }
  return dir;
}

function logFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `woontegra-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.log`;
}

export function getLogsDirectory(): string {
  return ensureLogDir();
}

export function logMessage(level: LogLevel, category: string, message: string, detail?: unknown): void {
  try {
    const dir = ensureLogDir();
    const line = `[${new Date().toISOString()}] [${level}] [${category}] ${message}${
      detail !== undefined ? ` | ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''
    }\n`;
    fs.appendFileSync(path.join(dir, logFileName()), line, 'utf8');
  } catch {
    // Son çare: konsola yaz
    console.error(`[${level}] [${category}]`, message, detail);
  }
}

export function logError(category: string, message: string, err?: unknown): void {
  const detail = err instanceof Error ? `${err.message}\n${err.stack}` : err;
  logMessage('ERROR', category, message, detail);
}

export function logWarn(category: string, message: string, detail?: unknown): void {
  logMessage('WARN', category, message, detail);
}

export function logInfo(category: string, message: string, detail?: unknown): void {
  logMessage('INFO', category, message, detail);
}
