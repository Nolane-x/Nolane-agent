'use strict';

const electron = require('electron');

const api = Object.freeze({
  selectDirectory: () => electron.ipcRenderer.invoke('nolane:select-directory'),
  getUpdateStatus: () => electron.ipcRenderer.invoke('nolane:update-status'),
  getUpdateState: () => electron.ipcRenderer.invoke('nolane:update-state-get'),
  checkForUpdates: () => electron.ipcRenderer.invoke('nolane:update-check'),
  downloadAvailableUpdate: () => electron.ipcRenderer.invoke('nolane:update-download'),
  deferUpdate: () => electron.ipcRenderer.invoke('nolane:update-defer'),
  ignoreVersion: () => electron.ipcRenderer.invoke('nolane:update-ignore'),
  getNativeCoreStatus: () => electron.ipcRenderer.invoke('nolane:core-status'),
  installStagedUpdate: () => electron.ipcRenderer.invoke('nolane:update-install-and-restart'),
  installUpdateAndRestart: () => electron.ipcRenderer.invoke('nolane:update-install-and-restart'),
  onUpdateState: (listener) => {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    const handler = (_event, value) => listener(value);
    electron.ipcRenderer.on('nolane:update-state', handler);
    return () => electron.ipcRenderer.removeListener('nolane:update-state', handler);
  },
  getDesktopInfo: () => Object.freeze({
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    desktop: true,
  }),
});

electron.contextBridge.exposeInMainWorld('nolaneDesktop', api);
