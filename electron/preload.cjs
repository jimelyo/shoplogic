/**
 * Preload: the only bridge between the Vite app and Electron.
 * Exposes a tiny, read-mostly updater API — no Node, no fs, no secrets.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shoplogicDesktop', {
  isDesktop: true,
  getVersion: () => ipcRenderer.invoke('updater:state').then((s) => s?.version ?? null),
  getUpdaterState: () => ipcRenderer.invoke('updater:state'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  applyUpdate: () => ipcRenderer.invoke('updater:apply'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  setAutoDownload: (enabled) => ipcRenderer.invoke('updater:set-auto', enabled),
  /** #11 external backup: write a UTF-8 text file into a subfolder of the user's Documents. */
  saveTextFile: (opts) => ipcRenderer.invoke('files:save-text', opts),
  pickBackupDir: () => ipcRenderer.invoke('files:pick-dir'),
  /** VERI*FACTU: firma XAdES del registro (proceso main usa el .p12 local). */
  verifactuSign: (xml) => ipcRenderer.invoke('verifactu:sign', xml),
  verifactuSignerStatus: () => ipcRenderer.invoke('verifactu:signer-status'),
  onStateChange: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('updater:state-changed', listener);
    return () => ipcRenderer.removeListener('updater:state-changed', listener);
  },
});
