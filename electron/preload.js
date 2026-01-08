const { contextBridge, ipcRenderer } = require('electron');

// Мост между Electron и React Native Web
contextBridge.exposeInMainWorld('electron', {
  // Флаг Electron
  isElectron: true,
  
  // Информация
  getVersion: () => ipcRenderer.invoke('electron:getVersion'),
  getPlatform: () => ipcRenderer.invoke('electron:getPlatform'),
  
  // Авторизация
  login: () => ipcRenderer.invoke('electron:login'),
  getCookies: (url) => ipcRenderer.invoke('electron:getCookies', url),
  fetchHtml: (url) => ipcRenderer.invoke('electron:fetchHtml', url),
  openCloudflareChallenge: (options) => ipcRenderer.invoke('electron:openCloudflareChallenge', options),
  
  // Файловая система
  readFile: (filePath) => ipcRenderer.invoke('electron:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('electron:writeFile', filePath, content),
  getPath: (name) => ipcRenderer.invoke('electron:getPath', name),
  getInfo: (filePath) => ipcRenderer.invoke('electron:getInfo', filePath),
  readDirectory: (dirPath) => ipcRenderer.invoke('electron:readDirectory', dirPath),
  makeDirectory: (dirPath, options) => ipcRenderer.invoke('electron:makeDirectory', dirPath, options),
  deleteAsync: (filePath, options) => ipcRenderer.invoke('electron:deleteAsync', filePath, options),
  getPicturesPath: () => ipcRenderer.invoke('electron:getPicturesPath'),
  showOpenDialog: (options) => ipcRenderer.invoke('electron:showOpenDialog', options),
  pathJoin: (...paths) => ipcRenderer.invoke('electron:pathJoin', ...paths),
  pathNormalize: (p) => ipcRenderer.invoke('electron:pathNormalize', p),
  pathSep: () => ipcRenderer.invoke('electron:pathSep'),
  downloadFile: (url, filePath) => ipcRenderer.invoke('electron:downloadFile', url, filePath),
  fetchJson: (url, options) => ipcRenderer.invoke('electron:fetchJson', url, options),
  
  // Системные
  openExternal: (url) => ipcRenderer.invoke('electron:openExternal', url),
  minimize: () => ipcRenderer.invoke('electron:minimize'),
  maximize: () => ipcRenderer.invoke('electron:maximize'),
  close: () => ipcRenderer.invoke('electron:close'),
  
  // Окно чтения
  openReaderWindow: (options) => ipcRenderer.invoke('electron:openReaderWindow', options),
  
});

// Ранняя инициализация мока для react-native-reanimated
// Делаем это до загрузки React компонентов
(function() {
  const mockMakeShareable = (value) => value;
  
  // Сохраняем мок в глобальный объект для использования при загрузке reanimated
  window.__REANIMATED_MAKE_SHAREABLE_MOCK__ = mockMakeShareable;
  
  // Перехватываем require для react-native-reanimated
  try {
    if (typeof require !== 'undefined') {
      const Module = require('module');
      const originalRequire = Module.prototype.require;
      
      Module.prototype.require = function(id) {
        const result = originalRequire.apply(this, arguments);
        if (id === 'react-native-reanimated' || (typeof id === 'string' && id.includes('react-native-reanimated'))) {
          // Добавляем makeShareable если его нет
          if (result && typeof result.makeShareable === 'undefined') {
            Object.defineProperty(result, 'makeShareable', {
              value: mockMakeShareable,
              writable: true,
              configurable: true,
              enumerable: false,
            });
          }
          if (result?.default && typeof result.default.makeShareable === 'undefined') {
            Object.defineProperty(result.default, 'makeShareable', {
              value: mockMakeShareable,
              writable: true,
              configurable: true,
              enumerable: false,
            });
          }
        }
        return result;
      };
    }
  } catch (e) {
    console.warn('[Preload] Reanimated mock setup failed:', e);
  }
})();

console.log('[Preload] Electron bridge initialized');
