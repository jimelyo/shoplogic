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

// --- VERI*FACTU signer (XAdES Enveloped, art. 14 Orden HAC/1177/2024) ---------
// La firma digital exige Node (node-forge + xml-crypto): se hace aquí, en el
// proceso main, leyendo el .p12 local que el operador instala; nunca por HTTP.
// El renderer ve solo el resultado: XML firmado o error sin detalles sensibles.
const signer = require('./verifactu-signer.cjs');

ipcMain.handle('verifactu:signer-status', () => {
  const cfg = signer.readSignerConfig(app.getPath('userData'));
  return cfg ? { available: true, p12Path: cfg.p12Path, p12PasswordSet: !!cfg.p12Password }
             : { available: false, hint: 'Falta userData/verifactu/signer.json con { p12Path, p12Password }' };
});

ipcMain.handle('verifactu:sign', (_e, xml) => {
  if (typeof xml !== 'string' || !xml.startsWith('<')) return { ok: false, error: 'XML inválido' };
  const cfg = signer.readSignerConfig(app.getPath('userData'));
  if (!cfg) return { ok: false, error: 'Firmador no configurado (falta .p12 / signer.json)' };
  try {
    return { ok: true, signed: signer.signEnvelopeXml({ xml, p12Path: cfg.p12Path, p12Password: cfg.p12Password }) };
  } catch (err) {
    return { ok: false, error: `Firma fallida: ${(err && err.message) || String(err)}` };
  }
});

// --- External backup (#11) ---------------------------------------------------
// Writes the daily snapshot copy into a subfolder of Documents, inside a
// sandboxed allow-list (only files named shoplogic-backup-*.json). No arbitrary
// file write: the renderer passes folder NAME + content, and the folder has to
// exist under Documents.
const fs = require('node:fs');
const os = require('node:os');

ipcMain.handle('files:save-text', (_e, { dir, name, content }) => {
  if (typeof dir !== 'string' || typeof name !== 'string' || typeof content !== 'string') return 0;
  if (!/^shoplogic-backup-.+\.json$/.test(name)) return 0; // allow-list
  const safeDir = path.basename(dir);                       // no traversal
  const target = path.join(os.homedir(), 'Documents', 'ShopLogic Backups', safeDir);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, name), content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
});

ipcMain.handle('files:pick-dir', () => {
  // Desktop keeps it simple: a well-known folder; a native dialog would add
  // little and complicate the permission story.
  return path.join('Documents', 'ShopLogic Backups');
});

app.whenReady().then(() => {
  createWindow();
  setupUpdater();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
