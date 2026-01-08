const { contextBridge, ipcRenderer } = require('electron');

// Минимальный preload для reader окна
// Предоставляем только необходимые методы IPC

// Так как nodeIntegration: true, мы можем использовать require напрямую в reader.js
// Но для безопасности лучше использовать contextBridge

contextBridge.exposeInMainWorld('electronReader', {
  // IPC методы для получения книги
  getBook: (id) => ipcRenderer.invoke('electron:getBook', id),
  getBookFromLocal: (id) => ipcRenderer.invoke('electron:getBookFromLocal', id),
  
  // Управление окном
  minimize: () => ipcRenderer.invoke('electron:minimize'),
  maximize: () => ipcRenderer.invoke('electron:maximize'),
  close: () => ipcRenderer.invoke('electron:close'),
  
  // История чтения - теперь используем общий localStorage через app:// протокол
  // IPC методы не нужны, так как localStorage общий для всех окон
  
  // Слушаем события окна
  onWindowMaximize: (callback) => {
    ipcRenderer.on('window:maximize', () => callback());
  },
  onWindowUnmaximize: (callback) => {
    ipcRenderer.on('window:unmaximize', () => callback());
  },
  
  // Слушаем навигацию
  onNavigate: (callback) => {
    ipcRenderer.on('reader:navigate', (event, data) => callback(data));
  },
  
  // Отключаем слушатели
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

console.log('[Reader Preload] Initialized');
