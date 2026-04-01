const { contextBridge, ipcRenderer } = require('electron');







contextBridge.exposeInMainWorld('electronReader', {
  getBook: (id) => ipcRenderer.invoke('electron:getBook', id),
  getBookFromLocal: (id) => ipcRenderer.invoke('electron:getBookFromLocal', id),
  minimize: () => ipcRenderer.invoke('electron:minimize'),
  maximize: () => ipcRenderer.invoke('electron:maximize'),
  close: () => ipcRenderer.invoke('electron:close'),
  onWindowMaximize: (callback) => {
    ipcRenderer.on('window:maximize', () => callback());
  },
  onWindowUnmaximize: (callback) => {
    ipcRenderer.on('window:unmaximize', () => callback());
  },
  onNavigate: (callback) => {
    ipcRenderer.on('reader:navigate', (event, data) => callback(data));
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

console.log('[Reader Preload] Initialized');
