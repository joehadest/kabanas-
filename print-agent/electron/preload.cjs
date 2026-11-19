const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kabanas', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (partial) => ipcRenderer.invoke('save-config', partial),
  getStatus: () => ipcRenderer.invoke('get-status'),
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  testPrint: (printer) => ipcRenderer.invoke('test-print', { printer }),
  openAdmin: () => ipcRenderer.invoke('open-admin'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('agent-status', listener);
    return () => ipcRenderer.removeListener('agent-status', listener);
  },
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update-state', listener);
    return () => ipcRenderer.removeListener('update-state', listener);
  },
});
