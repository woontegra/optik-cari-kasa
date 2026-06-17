import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initDatabase, getDatabase } from './database';
import { registerIpcHandlers } from './ipc';
import { BackupService } from './services/backup.service';
import { logError, logInfo, getLogsDirectory } from './services/logger.service';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function setupErrorHandlers(): void {
  getLogsDirectory();
  logInfo('Uygulama', `Woontegra Optik Desktop başlatılıyor (v${app.getVersion()})`);

  process.on('uncaughtException', (err) => {
    logError('Main', 'Beklenmeyen hata', err);
  });

  process.on('unhandledRejection', (reason) => {
    logError('Main', 'İşlenmeyen promise reddi', reason);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Woontegra Optik Desktop',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

setupErrorHandlers();

app.whenReady().then(() => {
  try {
    initDatabase();
    registerIpcHandlers(ipcMain);
    createWindow();
  } catch (err) {
    logError('Uygulama', 'Başlatma hatası', err);
    throw err;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  const database = getDatabase();
  if (database) {
    try {
      new BackupService(database).runAutoBackupIfNeeded('on_close');
    } catch (err) {
      logError('Yedekleme', 'Kapanış yedeği alınamadı', err);
    }
    database.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
