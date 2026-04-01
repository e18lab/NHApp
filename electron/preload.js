const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  setCaptchaHtml: (html) => ipcRenderer.invoke('nh:set-captcha-html', html),
  getCaptchaToken: (options) => ipcRenderer.invoke('electron:getCaptchaToken', options || {}),
  getVersion: () => ipcRenderer.invoke('electron:getVersion'),
  getPlatform: () => ipcRenderer.invoke('electron:getPlatform'),
  getOsName: () => ipcRenderer.invoke('electron:getOsName'),
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



(function installReanimatedElectronShim() {
  const mockMakeShareable = (value) => value;
  window.__REANIMATED_MAKE_SHAREABLE_MOCK__ = mockMakeShareable;
  try {
    if (typeof require === 'undefined') return;

    let ModuleClass;
    try {
      const nm = require('node:module');
      ModuleClass = nm.Module;
    } catch (_) {
      try {
        const m = require('module');
        ModuleClass = m.Module;
      } catch (e2) {
        console.warn('[Preload] node:module / module not available, Reanimated shim skipped:', e2?.message);
        return;
      }
    }

    if (!ModuleClass || !ModuleClass.prototype || typeof ModuleClass.prototype.require !== 'function') {
      console.warn('[Preload] Module.prototype.require missing, Reanimated shim skipped');
      return;
    }

    const originalRequire = ModuleClass.prototype.require;
    function patchMakeShareable(result) {
      if (!result) return;
      if (typeof result.makeShareable !== 'function') {
        Object.defineProperty(result, 'makeShareable', {
          value: mockMakeShareable,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      }
      if (result.default && typeof result.default.makeShareable !== 'function') {
        Object.defineProperty(result.default, 'makeShareable', {
          value: mockMakeShareable,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      }
    }

    ModuleClass.prototype.require = function patchedRequire(id) {
      const result = originalRequire.apply(this, arguments);
      if (typeof id !== 'string') return result;
      if (
        id === 'react-native-reanimated' ||
        id.includes('react-native-reanimated') ||
        id === 'react-native-worklets' ||
        id.includes('react-native-worklets')
      ) {
        patchMakeShareable(result);
      }
      return result;
    };
  } catch (e) {
    console.warn('[Preload] Reanimated mock setup failed:', e);
  }
})();

console.log('[Preload] Electron bridge initialized');
