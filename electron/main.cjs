/**
 * Electron main process for ShopLogic Pro (Windows build).
 *
 * Dev  : loads the Vite dev server (VITE_DEV_SERVER_URL).
 * Prod : loads the static build from dist/ served over the custom privileged
 *        `app://shoplogic` scheme (hardened: no file:// in the renderer). On the
 *        first upgrade the renderer's IndexedDB must be moved from the old
 *        file:// origin, which a hidden window dumps once (see migrateOrigin).
 */
const { app, BrowserWindow, ipcMain, session, shell, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

// Auto-update (electron-updater). Runs only in packaged builds; on GitHub
// Releases it checks every 30 min and installs+relaunches in the background.
const { autoUpdater } = require('electron-updater');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 700;
const DIST = path.join(__dirname, '..', 'dist');
/** Only this origin is ever loaded in production (see protocol handler). */
const APP_ORIGIN = 'app://shoplogic';

let win = null;

// The app:// scheme must be privileged (standard host semantics + secure
// context + service workers) BEFORE the Electron module system is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true, stream: true } },
]);

/**
 * Serves the static build from app://shoplogic/<path>, with an SPA fallback to
 * index.html for unknown paths. Paths are resolved safely inside dist/ only: a
 * URL can never escape the directory (path traversal is normalized away).
 */
function registerAppProtocol() {
  const serve = (rel) => net.fetch(pathToFileURL(path.join(DIST, rel)).toString());
  protocol.handle('app', async (request) => {
    try {
      const u = new URL(request.url);
      let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
      if (!rel) rel = 'index.html';
      const abs = path.normalize(path.join(DIST, rel));
      if (!abs.startsWith(DIST + path.sep)) return serve('index.html');
      return await net.fetch(pathToFileURL(abs).toString());
    } catch {
      return serve('index.html'); // SPA fallback (unknown route / deleted asset)
    }
  });
}

/**
 * Only these protocols may open in the external browser (parsed with URL, not
 * string prefixes, so `https://evil.com/file://…` can never fake a pass).
 */
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);
function isExternalUrl(url) {
  try { return EXTERNAL_PROTOCOLS.has(new URL(url).protocol); } catch { return false; }
}

function isInAppOrigin(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'file:' || (u.protocol === 'app:' && u.origin === APP_ORIGIN);
  } catch { return false; }
}

/**
 * Hard allow-list of session permission requests (camera for the barcode
 * scanner is the only one the app asks for). Anything else is denied instead
 * of silently approved — the Electron security checklist's default is to
 * reject and handle each permission explicitly.
 */
const ALLOWED_PERMISSIONS = new Set(['media']);
function setupSessionPermissions() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, cb) => { cb(ALLOWED_PERMISSIONS.has(permission)); });
  ses.setPermissionCheckHandler((_wc, permission /*, origin */) => ALLOWED_PERMISSIONS.has(permission));
}

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

  // External links (WhatsApp, mailto, docs) open in the default browser. Any
  // other new window is denied by default; only http(s)/mailto leave the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // The renderer must never navigate away from the packaged app (or from the
  // Vite dev server in development). A remote page would otherwise inherit the
  // preload bridge on the same BrowserWindow. Parsed with `new URL()`.
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = (DEV_URL && url.startsWith(DEV_URL)) || isInAppOrigin(url);
    if (allowed) return;
    event.preventDefault();
    if (isExternalUrl(url)) void shell.openExternal(url);
  });
  win.webContents.on('will-redirect', (event, url) => {
    const allowed = (DEV_URL && url.startsWith(DEV_URL)) || isInAppOrigin(url);
    if (!allowed) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  if (DEV_URL) {
    void win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadURL(`${APP_ORIGIN}/index.html`);
  }
}

// --- Origen file:// → app:// : volcado único de IndexedDB -------------------
// IndexedDB está aislada por origen, así que al migrar el renderer de file://
// (versiones 1.0–1.3.x) a app:// la base de datos parece vacía. Una ventana
// oculta sobre el origen viejo volca TODAS las tablas (incluye users) por IPC;
// el dump queda en userData y el renderer del origen nuevo lo importa una vez.

ipcMain.on('origin-migration:dump', (_e, json) => {
  if (typeof json === 'string' && json.length && json.length < 256 * 1024 * 1024) {
    try {
      fs.writeFileSync(path.join(app.getPath('userData'), 'origin-migration.json'), json, 'utf8');
    } catch { /* reintentará en el próximo arranque */ }
  }
});

ipcMain.handle('origin-migration:get', () => {
  try {
    const f = path.join(app.getPath('userData'), 'origin-migration.json');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  } catch { return null; }
});

ipcMain.handle('origin-migration:finish', () => {
  try { fs.rmSync(path.join(app.getPath('userData'), 'origin-migration.json'), { force: true }); } catch { /* noop */ }
  return true;
});

/** Opens a hidden file:// window and waits for the renderer dump (25 s max). */
function dumpOldOrigin() {
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    let hidden;
    const finish = (data) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ipcMain.off('origin-migration:dump', onDump);
      try { if (hidden && !hidden.isDestroyed()) hidden.destroy(); } catch { /* noop */ }
      resolve(data);
    };
    const onDump = (_e, json) => finish(typeof json === 'string' && json.startsWith('{') ? json : null);
    hidden = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    timer = setTimeout(() => finish(null), 25_000);
    hidden.webContents.on('will-navigate', (e) => e.preventDefault());
    void hidden.loadFile(path.join(DIST, 'index.html'), { hash: '__sl-migrate-origin' })
      .catch(() => finish(null));
    ipcMain.on('origin-migration:dump', onDump);
  });
}

/** Before loading app://, make sure the old origin was dumped exactly once. */
async function ensureOriginMigrated() {
  if (DEV_URL) return; // dev stays on the Vite server
  const marker = path.join(app.getPath('userData'), 'origin-migration.json');
  if (fs.existsSync(marker)) return; // ya volcado (o decidido vacío): continuar
  const dump = await dumpOldOrigin();
  if (dump === null) return; // no se pudo leer el origen viejo: seguir en file://
  try { fs.writeFileSync(marker, dump, 'utf8'); } catch { /* noop */ }
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
const companion = require('./verifactu-companion.cjs');

ipcMain.handle('verifactu:signer-status', () => {
  const cfg = signer.readSignerConfig(app.getPath('userData'));
  return cfg ? { available: true, p12Path: cfg.p12Path, p12PasswordSet: !!cfg.p12Password }
             : { available: false, hint: 'Falta userData/verifactu/signer.json con { p12Path, p12Password }' };
});

// --- VERI*FACTU Companion (asistente de certificado + diagnóstico) -----------
// La contraseña del .p12 viaja SOLO por IPC al main y muere aquí: no se guarda
// en Dexie/localStorage ni se devuelve jamás al renderer.
ipcMain.handle('verifactu:companion-pick-p12', (e) => companion.pickAndCopyP12(app.getPath('userData'), e.sender));
ipcMain.handle('verifactu:companion-validate', (_e, password) => {
  const cert = companion.certTargetPath(app.getPath('userData'));
  return companion.describeP12(cert, password);
});
ipcMain.handle('verifactu:companion-install', (_e, password) => companion.installSignerConfig(app.getPath('userData'), password));
ipcMain.handle('verifactu:signer-detail', () => companion.signerDetail(app.getPath('userData')));
ipcMain.handle('verifactu:test-connection', (_e, environment) => companion.testConnection(environment));

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

app.whenReady().then(async () => {
  registerAppProtocol();
  setupSessionPermissions();
  await ensureOriginMigrated();
  createWindow();
  setupUpdater();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
