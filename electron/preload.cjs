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
  onStateChange: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('updater:state-changed', listener);
    return () => ipcRenderer.removeListener('updater:state-changed', listener);
  },
});
