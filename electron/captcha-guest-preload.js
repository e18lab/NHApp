/**
 * Preload для webview с Turnstile (partition persist:nh-captcha).
 * Выполняется ДО любого JS страницы — Cloudflare не успевает считать automation-флаги.
 */
(function stealth() {
  // 1. webdriver
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
  } catch (_) {}

  // 2. window.chrome — без него Turnstile считает среду не-Chrome
  try {
    if (!window.chrome) {
      window.chrome = {
        app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
        runtime: { connect: () => {}, sendMessage: () => {} },
        loadTimes: function () { return {}; },
        csi: function () { return {}; },
      };
    }
  } catch (_) {}

  // 3. navigator.plugins — пустой массив → headless-сигнал
  try {
    const pluginData = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeTypes: [{ type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: '' }] },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', mimeTypes: [{ type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' }, { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' }] },
    ];
    const plugins = Object.create(PluginArray.prototype);
    pluginData.forEach((pd, i) => {
      const p = Object.create(Plugin.prototype);
      Object.defineProperty(p, 'name', { get: () => pd.name });
      Object.defineProperty(p, 'filename', { get: () => pd.filename });
      Object.defineProperty(p, 'description', { get: () => pd.description });
      Object.defineProperty(plugins, i, { get: () => p });
    });
    Object.defineProperty(plugins, 'length', { get: () => pluginData.length });
    Object.defineProperty(navigator, 'plugins', { get: () => plugins, configurable: true });
  } catch (_) {}

  // 4. navigator.languages
  try {
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });
  } catch (_) {}

  // 5. permissions — в headless notifications.query() возвращает 'denied', в реальном Chrome — 'default'
  try {
    const origQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (params) => {
      if (params && params.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission, onchange: null });
      }
      return origQuery(params);
    };
  } catch (_) {}

  // 6. Убираем automation-артефакты в document
  try {
    const attr = document.documentElement.getAttribute('webdriver');
    if (attr !== null) document.documentElement.removeAttribute('webdriver');
  } catch (_) {}

  // 7. Убираем глобальные переменные phantom/nightmare/domAutomation
  try {
    ['callPhantom', '_phantom', '__nightmare', 'domAutomation', 'domAutomationController', '__webdriver_script_fn', '__driver_evaluate', '__webdriverFunc', '__fxdriver_unwrap', '__selenium_unwrapped', 'seleniumKey'].forEach((k) => {
      try { delete window[k]; } catch (_) {}
    });
  } catch (_) {}
})();
