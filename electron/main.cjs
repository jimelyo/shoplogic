/**
 * Electron main process for ShopLogic Pro (Windows build).
 *
 * Dev  : loads the Vite dev server (VITE_DEV_SERVER_URL).
 * Prod : loads the static build in `dist/` (file://), which keeps IndexedDB,
 *        the service worker and every local-first feature intact.
 */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');

// Auto-update (electron-updater). Runs only in packaged builds; on GitHub
// Releases it checks every 30 min and installs+relaunches in the background.
const { autoUpdater } = require('electron-updater');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 700;

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    autoHideMenuBar: true,
    title: 'ShopLogic Pro',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.on('closed', () => { win = null; });

  // External links (WhatsApp, mailto, docs) open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:|^whatsapp:/i.test(url)) { void shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  if (DEV_URL) {
    void win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// --- Auto-update ------------------------------------------------------------
// The Vite app asks for the state via IPC (renderer keeps its own UI/toggle);
// the desktop shell applies releases silently unless the store disables it.
function setupUpdater() {
  if (!app.isPackaged) return; // No updates in dev; vite reloads are enough.
  autoUpdater.autoDownload = false;
  autoUpdater.allowDowngrade = false;
  // Suggest (not force) the update: the UI shows a banner with one button.
  autoUpdater.autoInstallOnAppQuit = true;

  ipcMain.handle('updater:state', () => ({
    supported: true,
    version: app.getVersion(),
    downloading: downloading,
    progress: progress,
  }));
  ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates());
  ipcMain.handle('updater:apply', () => {
    if (downloading) return; // Already in progress.
    void autoUpdater.downloadUpdate();
  });
  ipcMain.handle('updater:install', () => { autoUpdater.quitAndInstall(); });

  autoUpdater.on('checking-for-update', () => send('updater:state-changed', { state: 'checking' }));
  autoUpdater.on('update-available', (i) => send('updater:state-changed', { state: 'updateReady', version: i?.version }));
  autoUpdater.on('update-not-available', () => send('updater:state-changed', { state: 'idle' }));
  autoUpdater.on('download-progress', (p) => { progress = p; send('updater:state-changed', { state: 'downloading', progress: p }); });
  autoUpdater.on('update-downloaded', (i) => { downloading = false; send('updater:state-changed', { state: 'installReady', version: i?.version }); });
  autoUpdater.on('error', (e) => send('updater:state-changed', { state: 'error', message: String(e) }));

  // Poll every 30 min and once on start (network willing).
  autoUpdater.checkForUpdates().catch(() => undefined);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => undefined), 30 * 60 * 1000);
}

let downloading = false;
let progress = null;

// Auto-download when the store hasn't opted out (localStorage flag mirrored
// by the renderer through `updater:set-auto`).
ipcMain.handle('updater:set-auto', (_e, enabled) => {
  if (enabled === undefined) return;
  autoUpdater.autoDownload = Boolean(enabled);
});

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

app.whenReady().then(() => {
  createWindow();
  setupUpdater();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
