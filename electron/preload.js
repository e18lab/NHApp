const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('electron:getVersion'),
  getPlatform: () => ipcRenderer.invoke('electron:getPlatform'),
  getBannerAssetDataUrls: () => ipcRenderer.invoke('electron:getBannerAssetDataUrls'),
  onWindowMaximizeChanged: (callback) => {
    const wrappedCallback = (event, maximized) => {
      callback(maximized);
    };
    ipcRenderer.on('window:maximize-changed', wrappedCallback);
    return () => {
      ipcRenderer.removeListener('window:maximize-changed', wrappedCallback);
    };
  },
  login: () => ipcRenderer.invoke('electron:login'),
  getCookies: (url) => ipcRenderer.invoke('electron:getCookies', url),
  fetchHtml: (url) => ipcRenderer.invoke('electron:fetchHtml', url),
  fetchProfileEditPage: (payload) => ipcRenderer.invoke('electron:fetchProfileEditPage', payload),
  submitProfileEdit: (payload) => ipcRenderer.invoke('electron:submitProfileEdit', payload),
  fetchBlacklistPage: (payload) => ipcRenderer.invoke('electron:fetchBlacklistPage', payload),
  fetchAutocomplete: (payload) => ipcRenderer.invoke('electron:fetchAutocomplete', payload),
  submitBlacklist: (payload) => ipcRenderer.invoke('electron:submitBlacklist', payload),
  openCloudflareChallenge: (options) => ipcRenderer.invoke('electron:openCloudflareChallenge', options),
  getRandomId: () => ipcRenderer.invoke('electron:getRandomId'),
  readFile: (filePath) => ipcRenderer.invoke('electron:readFile', filePath),
  getFileAsDataUrl: (filePath) => ipcRenderer.invoke('electron:getFileAsDataUrl', filePath),
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
  getDiskSpace: (basePath) => ipcRenderer.invoke('electron:getDiskSpace', basePath),
  downloadFile: (url, filePath) => ipcRenderer.invoke('electron:downloadFile', url, filePath),
  fetchJson: (url, options) => ipcRenderer.invoke('electron:fetchJson', url, options),
  openExternal: (url) => ipcRenderer.invoke('electron:openExternal', url),
  minimize: () => ipcRenderer.invoke('electron:minimize'),
  maximize: () => ipcRenderer.invoke('electron:maximize'),
  close: () => ipcRenderer.invoke('electron:close'),
  isMaximized: () => ipcRenderer.invoke('electron:isMaximized'),
  openReaderWindow: (options) => ipcRenderer.invoke('electron:openReaderWindow', options),
});



(function() {
  const mockMakeShareable = (value) => value;
  window.__REANIMATED_MAKE_SHAREABLE_MOCK__ = mockMakeShareable;
  try {
    if (typeof require !== 'undefined') {
      let Module;
      let originalRequire;
      try {
        Module = require('module');
        originalRequire = Module.prototype.require;
      } catch (moduleError) {
        console.warn('[Preload] Module require not available, using alternative approach');
        return; 
      }
      if (Module && originalRequire) {
        Module.prototype.require = function(id) {
          const result = originalRequire.apply(this, arguments);
          if (id === 'react-native-reanimated' || (typeof id === 'string' && id.includes('react-native-reanimated'))) {
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
    }
  } catch (e) {
    console.warn('[Preload] Reanimated mock setup failed:', e);
  }
})();

console.log('[Preload] Electron bridge initialized');
