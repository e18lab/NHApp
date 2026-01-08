const { app, BrowserWindow, ipcMain, shell, dialog, session, protocol } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const isTest = process.env.ELECTRON_TEST === 'true';

let mainWindow = null;
let devServerProcess = null;

// Путь к dist
const distPath = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distPath, 'index.html');

// URL для dev режима (Expo dev server)
const DEV_SERVER_URL = process.env.EXPO_DEV_SERVER_URL || 'http://localhost:8081';

// Кастомный протокол для production/dev билда
const APP_SCHEME = 'app';
// Протокол для локальных файлов (скачанные книги)
const LOCAL_SCHEME = 'local';

/**
 * Возвращает distBasePath для текущего режима.
 */
function getDistBasePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'dist')
    : path.join(__dirname, '..', 'dist');
}

/**
 * Определяет MIME-тип по расширению файла
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.webp': 'image/webp', // Добавляем webp для скачанных книг
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * ВАЖНО: Регистрация схемы как привилегированной ДОЛЖНА быть ДО app.ready
 * Это позволяет app:// работать как http:// (localStorage, fetch, etc.)
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,      // Стандартный протокол (как http)
      secure: true,        // Считается безопасным (как https)
      supportFetchAPI: true, // Поддержка fetch()
      corsEnabled: true,   // CORS разрешён
      stream: true,        // Поддержка streaming
    },
  },
  {
    scheme: LOCAL_SCHEME,
    privileges: {
      standard: true,      // Стандартный протокол (как http)
      secure: true,        // Считается безопасным (как https)
      supportFetchAPI: true, // Поддержка fetch()
      corsEnabled: true,   // CORS разрешён
      stream: true,        // Поддержка streaming
    },
  },
]);

/**
 * Регистрирует обработчик app:// протокола на сессии
 */
function registerAppProtocolForSession(sess, distBasePath) {
  if (sess.__appProtocolInstalled) return;
  sess.__appProtocolInstalled = true;

  sess.protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);

    // Логирование в dev режиме
    if (isDev) {
      console.log(`[${APP_SCHEME}://] Request: ${request.url}`);
      console.log(`  pathname: ${pathname}`);
    }

    // Если запрашивается корень или HTML-страница без расширения — отдаём index.html
    // Это нужно для SPA роутинга
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    // Убираем ведущий слэш для path.join
    const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    
    // Если запрашивается electron/reader.html или electron/reader.js - берем из папки electron
    let filePath;
    if (relativePath.startsWith('electron/')) {
      const electronFile = relativePath.replace('electron/', '');
      filePath = path.join(__dirname, electronFile);
    } else {
      filePath = path.join(distBasePath, relativePath);
    }

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      // Для SPA: если файл не найден и это не статический ресурс — отдаём index.html
      const ext = path.extname(filePath).toLowerCase();
      const isStaticResource = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.json', '.mp4', '.webm', '.mp3', '.wav'].includes(ext);

      if (!isStaticResource) {
        filePath = path.join(distBasePath, 'index.html');
        if (isDev) {
          console.log(`  SPA fallback to: ${filePath}`);
        }
      } else {
        if (isDev) {
          console.warn(`  NOT FOUND: ${filePath}`);
        }
        return new Response('Not Found', { status: 404 });
      }
    }

    // Читаем файл и возвращаем Response
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const mimeType = getMimeType(filePath);

      if (isDev) {
        console.log(`  Serving: ${filePath} (${mimeType})`);
      }

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error(`[${APP_SCHEME}://] Error reading file: ${filePath}`, error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
}

/**
 * Регистрирует обработчик local:// протокола для локальных файлов (скачанные книги)
 */
function registerLocalProtocolForSession(sess) {
  if (sess.__localProtocolInstalled) return;
  sess.__localProtocolInstalled = true;

  sess.protocol.handle(LOCAL_SCHEME, async (request) => {
    // Извлекаем путь напрямую из URL, минуя парсинг через new URL()
    // Это нужно, чтобы сохранить двоеточие после буквы диска в Windows
    const fullUrl = request.url;
    let filePath = fullUrl.replace(`${LOCAL_SCHEME}://`, '').replace(`${LOCAL_SCHEME}:/`, '');

    if (isDev) {
      console.log(`[${LOCAL_SCHEME}://] Request URL: ${request.url}`);
      console.log(`[${LOCAL_SCHEME}://] Extracted path: ${filePath}`);
    }

    // Декодируем путь (может быть закодирован)
    // Важно: декодируем полностью, включая специальные символы
    try {
      // Декодируем несколько раз, если путь был закодирован несколько раз
      let decoded = filePath;
      let prevDecoded = '';
      while (decoded !== prevDecoded) {
        prevDecoded = decoded;
        decoded = decodeURIComponent(decoded);
      }
      filePath = decoded;
    } catch (e) {
      // Если не удалось декодировать, используем как есть
      if (isDev) {
        console.warn(`[${LOCAL_SCHEME}://] Failed to decode path, using as-is: ${filePath}`);
      }
    }

    // Для Windows: обрабатываем пути с буквой диска
    if (process.platform === 'win32') {
      // Обрабатываем разные варианты:
      // - /C:/Users/... (один слэш с двоеточием)
      // - //C:/Users/... (два слэша с двоеточием)
      // - ///C:/Users/... (три слэша с двоеточием)
      // - c/Users/... (без слэша и двоеточия - браузер съедает C: как хост)
      // - /c/Users/... (со слэшем но без двоеточия)
      
      // Сначала проверяем паттерн с двоеточием: /C:/ или C:/
      const driveWithColon = filePath.match(/^\/+([A-Za-z]):\//);
      if (driveWithColon) {
        // Есть буква диска с двоеточием, убираем ведущие слэши
        filePath = filePath.replace(/^\/+/, '');
      } else {
        // Проверяем паттерн без двоеточия (браузер может съесть C: как хост)
        // Паттерны: "c/Users/..." или "/c/Users/..."
        const driveWithoutColon = filePath.match(/^\/*([A-Za-z])\/(.*)$/);
        if (driveWithoutColon) {
          // Восстанавливаем двоеточие: c/Users/... -> C:/Users/...
          const driveLetter = driveWithoutColon[1].toUpperCase();
          const restPath = driveWithoutColon[2];
          filePath = `${driveLetter}:/${restPath}`;
          if (isDev) {
            console.log(`[${LOCAL_SCHEME}://] Restored drive letter: ${filePath}`);
          }
        } else if (filePath.startsWith('/')) {
          // Нет буквы диска, просто убираем ведущие слэши
          filePath = filePath.replace(/^\/+/, '');
        }
      }
      // Нормализуем путь (заменяем прямые слэши на обратные)
      filePath = filePath.replace(/\//g, path.sep);
    } else {
      // Для Unix-подобных систем просто убираем ведущие слэши
      filePath = filePath.replace(/^\/+/, '');
    }

    if (isDev) {
      console.log(`[${LOCAL_SCHEME}://] Resolved path: ${filePath}`);
    }

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      if (isDev) {
        console.warn(`[${LOCAL_SCHEME}://] File not found: ${filePath}`);
      }
      return new Response('File Not Found', { status: 404 });
    }

    // Проверяем, что это файл (не директория)
    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return new Response('Not a file', { status: 400 });
      }
    } catch (err) {
      return new Response('Error accessing file', { status: 500 });
    }

    // Читаем файл и возвращаем Response
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const mimeType = getMimeType(filePath);

      if (isDev) {
        console.log(`[${LOCAL_SCHEME}://] Serving: ${filePath} (${mimeType})`);
      }

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000', // Кешируем на год
        },
      });
    } catch (error) {
      console.error(`[${LOCAL_SCHEME}://] Error reading file: ${filePath}`, error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
}

/**
 * Регистрирует протоколы на всех нужных сессиях
 */
function registerProtocols() {
  const distBasePath = getDistBasePath();

  // Регистрируем на defaultSession
  registerAppProtocolForSession(session.defaultSession, distBasePath);
  registerLocalProtocolForSession(session.defaultSession);

  if (isDev) {
    console.log(`[Electron] Registered ${APP_SCHEME}:// protocol`);
    console.log(`[Electron] Registered ${LOCAL_SCHEME}:// protocol`);
    console.log(`[Electron] distBasePath: ${distBasePath}`);
  }
}

function createWindow() {
  const preloadPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'electron', 'preload.js')
    : path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      // НЕ используем partition чтобы app:// работал на defaultSession
    },
    icon: path.join(__dirname, '..', 'assets', 'images', 'icon.png'),
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode !== -3) {
      console.error(`[Electron] Failed to load: ${validatedURL}`);
      console.error(`[Electron] Error: ${errorCode} - ${errorDescription}`);
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.log(`[Renderer ${level === 2 ? 'ERROR' : 'WARN'}] ${message} (${sourceId}:${line})`);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page finished loading');
    mainWindow.webContents.executeJavaScript(`
      console.log('[Electron] App initialized');
      console.log('[Electron] window.location.href:', window.location.href);
      console.log('[Electron] window.location.pathname:', window.location.pathname);
      console.log('[Electron] window.location.protocol:', window.location.protocol);
    `).catch(err => console.error('[Electron] Error:', err));
  });

  // Загрузка
  if (isTest) {
    // Test режим — подключаемся к Expo dev server
    console.log(`[Electron] Connecting to dev server: ${DEV_SERVER_URL}`);
    mainWindow.loadURL(DEV_SERVER_URL);
    
    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(DEV_SERVER_URL);
        }
      }, 1000);
    });
  } else if (fs.existsSync(indexPath) || app.isPackaged) {
    // Production или Dev с билдом — используем app:// протокол
    // ВАЖНО: загружаем app://./ (не index.html), чтобы pathname был "/" для Expo Router
    const appUrl = `${APP_SCHEME}://./`;
    console.log(`[Electron] Loading via custom protocol: ${appUrl}`);
    mainWindow.loadURL(appUrl);
    } else {
    // Fallback на dev server
    console.warn(`[Electron] dist/index.html not found, trying dev server: ${DEV_SERVER_URL}`);
    mainWindow.loadURL(DEV_SERVER_URL);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Открываем внешние ссылки в браузере
    if (url.startsWith('http://') || url.startsWith('https://')) {
    shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ========== LOGIN WINDOW ==========
let loginWindow = null;
let loginResolve = null;
let loginCookieInterval = null;
let loginResolved = false; // Флаг чтобы предотвратить двойной resolve

async function createLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    throw new Error('Login window already open');
  }

  // Сбрасываем флаг
  loginResolved = false;

  // Очищаем старые auth cookies
  try {
    const existingCookies = await session.defaultSession.cookies.get({ url: 'https://nhentai.net' });
    for (const cookie of existingCookies) {
      if (cookie.name === 'sessionid' || cookie.name === 'csrftoken') {
        await session.defaultSession.cookies.remove('https://nhentai.net', cookie.name);
        console.log(`[Login] Cleared cookie: ${cookie.name}`);
      }
    }
  } catch (err) {
    console.error('[Login] Error clearing cookies:', err);
  }

  return new Promise((resolve) => {
    loginResolve = resolve;

    // НЕ модальное окно - modal может блокировать
    loginWindow = new BrowserWindow({
      width: 500,
      height: 700,
      parent: mainWindow,
      modal: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const LOGIN_URL = 'https://nhentai.net/login/?next=/';

    const finishLogin = (tokens) => {
      // Предотвращаем повторный вызов
      if (loginResolved) {
        console.log('[Login] Already resolved, ignoring duplicate call');
        return;
      }
      
      loginResolved = true;
      console.log('[Login] Finishing login with tokens:', !!tokens);
      
      // Очищаем интервал
      if (loginCookieInterval) {
        clearInterval(loginCookieInterval);
        loginCookieInterval = null;
      }
      
      // Resolve promise ПЕРЕД закрытием окна
      if (loginResolve) {
        const r = loginResolve;
        loginResolve = null;
        r(tokens);
      }
      
      // Закрываем окно ПОСЛЕ resolve
      if (loginWindow && !loginWindow.isDestroyed()) {
        // Используем close() вместо destroy() чтобы событие closed сработало корректно
        loginWindow.close();
      }
    };

    const checkCookies = async () => {
      if (!loginWindow || loginWindow.isDestroyed() || loginResolved) return;
      
      try {
        const cookies = await session.defaultSession.cookies.get({ url: 'https://nhentai.net' });
        
        let csrftoken = null;
        let sessionid = null;
        
        for (const cookie of cookies) {
          if (cookie.name === 'csrftoken') csrftoken = cookie.value;
          if (cookie.name === 'sessionid') sessionid = cookie.value;
        }
        
        console.log('[Login] Cookies:', { csrf: !!csrftoken, session: !!sessionid });
        
        if (sessionid) {
          console.log('[Login] SUCCESS - got sessionid!');
          finishLogin({ csrftoken, sessionid });
        }
      } catch (err) {
        console.error('[Login] Cookie check error:', err);
      }
    };

    // Проверяем cookies каждую секунду
    loginCookieInterval = setInterval(checkCookies, 1000);

    loginWindow.webContents.on('did-navigate', (event, url) => {
      console.log('[Login] Navigate:', url);
      // Проверяем сразу после навигации
      setTimeout(checkCookies, 300);
    });

    loginWindow.webContents.on('did-finish-load', () => {
      setTimeout(checkCookies, 300);
    });

    loginWindow.once('ready-to-show', () => {
      loginWindow.show();
    });

    loginWindow.on('closed', () => {
      console.log('[Login] Window closed event');
      
      // Очищаем интервал
      if (loginCookieInterval) {
        clearInterval(loginCookieInterval);
        loginCookieInterval = null;
      }
      
      loginWindow = null;
      
      // Если окно закрыли вручную БЕЗ логина (т.е. resolve ещё не был вызван)
      if (loginResolve && !loginResolved) {
        console.log('[Login] Window closed without login');
        finishLogin(null);
      }
    });

    loginWindow.loadURL(LOGIN_URL);
  });
}

// IPC обработчики
ipcMain.handle('electron:getVersion', () => app.getVersion());
ipcMain.handle('electron:getPlatform', () => process.platform);

// Login via Electron window
ipcMain.handle('electron:login', async () => {
  try {
    const result = await createLoginWindow();
    return { success: true, tokens: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get cookies from Electron session
ipcMain.handle('electron:getCookies', async (event, url) => {
  try {
    const cookies = await session.defaultSession.cookies.get({ url: url || 'https://nhentai.net' });
    const result = {};
    for (const cookie of cookies) {
      result[cookie.name] = cookie.value;
    }
    return { success: true, cookies: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========== CLOUDFLARE CHALLENGE WINDOW ==========
let cloudflareWindow = null;
let cloudflareResolve = null;
let cloudflareCookieInterval = null;
let cloudflareResolved = false;

async function createCloudflareChallengeWindow(options) {
  const { url, galleryId, prefillText } = options || {};
  
  // Закрываем существующее окно, если оно есть
  if (cloudflareWindow && !cloudflareWindow.isDestroyed()) {
    console.log('[Cloudflare] Closing existing window before opening new one');
    cloudflareResolved = true;
    if (cloudflareCookieInterval) {
      clearInterval(cloudflareCookieInterval);
      cloudflareCookieInterval = null;
    }
    cloudflareWindow.close();
    cloudflareWindow = null;
    // Даем время на закрытие
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  cloudflareResolved = false;
  const targetUrl = url || (galleryId ? `https://nhentai.net/g/${galleryId}/` : 'https://nhentai.net/');

  // Синхронизируем cookies из основной сессии в Cloudflare сессию
  const cloudflareSession = session.fromPartition('persist:cloudflare');
  try {
    const mainCookies = await session.defaultSession.cookies.get({ url: 'https://nhentai.net' });
    console.log(`[Cloudflare] Syncing ${mainCookies.length} cookies to Cloudflare session`);
    
    for (const cookie of mainCookies) {
      try {
        await cloudflareSession.cookies.set({
          url: 'https://nhentai.net',
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: cookie.expirationDate,
        });
      } catch (err) {
        console.warn(`[Cloudflare] Failed to sync cookie ${cookie.name}:`, err);
      }
    }
    console.log('[Cloudflare] Cookies synced to Cloudflare session');
  } catch (err) {
    console.error('[Cloudflare] Error syncing cookies:', err);
  }

  return new Promise((resolve) => {
    cloudflareResolve = resolve;

    cloudflareWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      parent: mainWindow,
      modal: false,
      show: false, // Окно скрыто, работает в фоне
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:cloudflare', // Отдельная сессия для Cloudflare
      },
    });

    const finishCloudflare = (result) => {
      if (cloudflareResolved) {
        console.log('[Cloudflare] Already resolved, ignoring duplicate call');
        return;
      }
      
      cloudflareResolved = true;
      console.log('[Cloudflare] Finishing challenge');

      if (cloudflareCookieInterval) {
        clearInterval(cloudflareCookieInterval);
        cloudflareCookieInterval = null;
      }

      if (cloudflareResolve) {
        const r = cloudflareResolve;
        cloudflareResolve = null;
        r(result);
      }

      // Закрываем окно асинхронно, чтобы дать время на обработку результата
      setTimeout(() => {
        if (cloudflareWindow && !cloudflareWindow.isDestroyed()) {
          console.log('[Cloudflare] Closing window after completion');
          cloudflareWindow.close();
          cloudflareWindow = null;
        }
      }, 100);
    };

    // Отслеживаем появление нового комментария в DOM
    let lastCommentIds = new Set();
    
    const checkForNewComment = async () => {
      if (!cloudflareWindow || cloudflareWindow.isDestroyed() || cloudflareResolved) return null;
      
      try {
        const result = await cloudflareWindow.webContents.executeJavaScript(`
          (function() {
            try {
              var comments = document.querySelectorAll('#comments .comment');
              var newComments = [];
              
              for (var i = 0; i < comments.length; i++) {
                var comment = comments[i];
                var commentId = comment.id;
                var timeEl = comment.querySelector('time[datetime]');
                var bodyEl = comment.querySelector('.body');
                var userLink = comment.querySelector('.header .left b a');
                var avatarLink = comment.querySelector('.avatar');
                var avatarImg = comment.querySelector('.avatar img');
                
                if (commentId && timeEl && bodyEl) {
                  var datetime = timeEl.getAttribute('datetime');
                  var timestamp = datetime ? new Date(datetime).getTime() : null;
                  var bodyText = bodyEl.textContent || bodyEl.innerText || '';
                  var username = '';
                  if (userLink) {
                    var userText = userLink.textContent || userLink.innerText || '';
                    if (userText && userText.trim) {
                      username = userText.trim();
                    } else {
                      username = userText;
                    }
                  }
                  
                  // Пробуем извлечь ID пользователя из ссылки на профиль
                  var userId = null;
                  var profileLink = null;
                  if (userLink && userLink.getAttribute) {
                    profileLink = userLink.getAttribute('href');
                  }
                  if (!profileLink && avatarLink && avatarLink.getAttribute) {
                    profileLink = avatarLink.getAttribute('href');
                  }
                  if (profileLink) {
                    try {
                      // Формат ссылки: /users/5912619/evts
                      var parts = profileLink.split('/users/');
                      if (parts.length > 1 && parts[1]) {
                        var idPart = parts[1].split('/')[0];
                        var parsedId = parseInt(idPart, 10);
                        if (!isNaN(parsedId)) {
                          userId = parsedId;
                        }
                      }
                    } catch (e) {
                      userId = null;
                    }
                  }
                  
                  var avatarUrl = '';
                  if (avatarImg) {
                    var src = avatarImg.getAttribute('src') || '';
                    var dataSrc = avatarImg.getAttribute('data-src') || '';
                    
                    if (src && src.indexOf('data:image') === 0) {
                      avatarUrl = dataSrc || '';
                    } else {
                      avatarUrl = src || dataSrc || '';
                    }
                    
                    if (avatarUrl && avatarUrl.indexOf('//') === 0) {
                      avatarUrl = 'https:' + avatarUrl;
                    }
                    if (avatarUrl && avatarUrl.indexOf('http') !== 0 && avatarUrl.indexOf('data:') !== 0) {
                      if (avatarUrl.indexOf('/') === 0) {
                        avatarUrl = 'https://i.nhentai.net' + avatarUrl;
                      } else {
                        avatarUrl = 'https://i.nhentai.net/' + avatarUrl;
                      }
                    }
                    
                    if (avatarUrl && (avatarUrl.indexOf('data:') === 0 || avatarUrl.length === 0)) {
                      avatarUrl = '';
                    }
                  }
                  
                  var commentIdNum = commentId.replace('comment-', '');
                  
                  newComments.push({
                    id: commentIdNum,
                    commentId: commentId,
                    body: bodyText,
                    timestamp: timestamp,
                    datetime: datetime,
                    username: username,
                    userId: userId,
                    avatarUrl: avatarUrl,
                    postDate: timestamp || Date.now(),
                  });
                }
              }
              
              return newComments;
            } catch (error) {
              console.error('[Cloudflare] Error in checkForNewComment script:', error);
              return [];
            }
          })();
        `);
        
        if (result && Array.isArray(result) && result.length > 0) {
          // Ищем самый новый комментарий (с самым большим timestamp)
          const newestComment = result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
          
          // Проверяем, что комментарий был создан недавно (в последние 2 минуты)
          const commentAge = Date.now() - (newestComment.timestamp || 0);
          const isRecent = commentAge < 120000 && commentAge > -60000; // От -1 минуты до +2 минут
          
          // Проверяем, что это не старый комментарий
          if (isRecent && !lastCommentIds.has(newestComment.id)) {
            // Проверяем, что текст комментария совпадает с отправленным
            if (prefillText && newestComment.body.trim().toLowerCase() === prefillText.trim().toLowerCase()) {
              console.log('[Cloudflare] Found new comment matching sent text:', newestComment);
              lastCommentIds.add(newestComment.id);
              return newestComment;
            }
          }
        }
        
        return null;
      } catch (err) {
        console.error('[Cloudflare] Error checking for new comment:', err);
        return null;
      }
    };

    const checkCookiesAndComment = async () => {
      if (!cloudflareWindow || cloudflareWindow.isDestroyed() || cloudflareResolved) return;
      
      try {
        const cloudflareSession = cloudflareWindow.webContents.session;
        const cookies = await cloudflareSession.cookies.get({ url: 'https://nhentai.net' });
        
        const cookieMap = {};
        for (const cookie of cookies) {
          cookieMap[cookie.name] = cookie.value;
        }

        // Проверяем наличие sessionid (значит пользователь авторизован)
        const hasSession = !!cookieMap['sessionid'];
        if (!hasSession) {
          console.log('[Cloudflare] No sessionid cookie - user not logged in');
        }

        // Проверяем наличие cf_clearance (значит капча пройдена)
        if (cookieMap['cf_clearance']) {
          console.log('[Cloudflare] cf_clearance cookie found!');
          
          // Синхронизируем cookies в основную сессию
          try {
            for (const cookie of cookies) {
              await session.defaultSession.cookies.set({
                url: 'https://nhentai.net',
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite,
                expirationDate: cookie.expirationDate,
              });
            }
            console.log('[Cloudflare] Cookies synced to main session');
          } catch (err) {
            console.error('[Cloudflare] Error syncing cookies:', err);
          }

          // Проверяем результат отправки комментария через перехватчик
          let commentResult = null;
          try {
            const interceptedResult = await cloudflareWindow.webContents.executeJavaScript('window.__cloudflareCommentResult');
            if (interceptedResult) {
              console.log('[Cloudflare] Comment result from interceptor:', interceptedResult);
              commentResult = interceptedResult;
              cloudflareWindow.webContents.executeJavaScript('window.__cloudflareCommentResult = null').catch(() => {});
            }
          } catch (err) {
            // Игнорируем ошибки
          }
          
          // Если не нашли через перехватчик, проверяем DOM
          if (!commentResult && prefillText) {
            const newComment = await checkForNewComment();
            if (newComment) {
              console.log('[Cloudflare] Found new comment in DOM:', newComment);
              console.log('[Cloudflare] Avatar URL from DOM:', newComment.avatarUrl);
              // Формируем slug в нижнем регистре из username
              var slug = newComment.username ? newComment.username.toLowerCase() : 'user';
              
              commentResult = {
                id: parseInt(newComment.id) || undefined,
                gallery_id: galleryId,
                body: newComment.body,
                post_date: newComment.postDate,
                poster: {
                  username: newComment.username,
                  slug: slug,
                  ...(newComment.userId ? { id: newComment.userId } : {}),
                  ...(newComment.avatarUrl ? { avatar_url: newComment.avatarUrl } : {}),
                },
              };
              console.log('[Cloudflare] Comment result with avatar:', commentResult);
            }
          }
          
          // Если комментарий был отправлен, закрываем окно
          if (commentResult) {
            console.log('[Cloudflare] Comment successfully posted, closing window');
            setTimeout(() => {
              finishCloudflare({
                success: true,
                cookies: {
                  csrf: cookieMap['csrftoken'] || null,
                  session: cookieMap['sessionid'] || null,
                  cf: cookieMap['cf_clearance'] || null,
                },
                comment: commentResult,
              });
            }, 500);
          }
        }
      } catch (err) {
        console.error('[Cloudflare] Cookie check error:', err);
      }
    };

    // Проверяем cookies каждую секунду
    cloudflareCookieInterval = setInterval(checkCookiesAndComment, 1000);
    
    // Также проверяем появление нового комментария каждые 500мс (более часто)
    const commentCheckInterval = setInterval(async () => {
      if (cloudflareResolved) {
        clearInterval(commentCheckInterval);
        return;
      }
      
      if (prefillText) {
        const newComment = await checkForNewComment();
        if (newComment) {
          console.log('[Cloudflare] New comment detected in DOM, closing window');
          clearInterval(commentCheckInterval);
          
          const commentResult = {
            id: parseInt(newComment.id) || undefined,
            gallery_id: galleryId,
            body: newComment.body,
            post_date: newComment.postDate,
            poster: {
              username: newComment.username,
              ...(newComment.userId ? { id: newComment.userId } : {}),
              ...(newComment.avatarUrl ? { avatar_url: newComment.avatarUrl } : {}),
            },
          };
          
          // Получаем cookies перед закрытием
          try {
            const cloudflareSession = cloudflareWindow.webContents.session;
            const cookies = await cloudflareSession.cookies.get({ url: 'https://nhentai.net' });
            const cookieMap = {};
            for (const cookie of cookies) {
              cookieMap[cookie.name] = cookie.value;
            }
            
            // Синхронизируем cookies
            for (const cookie of cookies) {
              await session.defaultSession.cookies.set({
                url: 'https://nhentai.net',
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite,
                expirationDate: cookie.expirationDate,
              });
            }
            
            finishCloudflare({
              success: true,
              cookies: {
                csrf: cookieMap['csrftoken'] || null,
                session: cookieMap['sessionid'] || null,
                cf: cookieMap['cf_clearance'] || null,
              },
              comment: commentResult,
            });
          } catch (err) {
            console.error('[Cloudflare] Error getting cookies for comment:', err);
            finishCloudflare({
              success: true,
              comment: commentResult,
            });
          }
        }
      }
    }, 500);
    
    cloudflareWindow.webContents.on('did-navigate', (event, navUrl) => {
      console.log('[Cloudflare] Navigate:', navUrl);
      setTimeout(() => {
        if (!cloudflareWindow || cloudflareWindow.isDestroyed() || cloudflareResolved) {
          return;
        }
        checkCookiesAndComment();
      }, 500);
    });

    // Устанавливаем перехватчики для перехвата отправки комментария
    cloudflareWindow.webContents.on('dom-ready', () => {
      if (!cloudflareWindow || cloudflareWindow.isDestroyed()) {
        return;
      }
      cloudflareWindow.webContents.executeJavaScript(`
        (function() {
          // Перехватываем fetch для отправки комментария
          const originalFetch = window.fetch;
          window.fetch = function(...args) {
            const url = args[0];
            const options = args[1] || {};
            
            // Проверяем, это запрос на отправку комментария?
            if (typeof url === 'string' && (url.includes('/comments/submit') || (url.includes('/api/gallery/') && url.includes('/comments')))) {
              if (options.method === 'POST') {
                console.log('[Cloudflare] Intercepting comment submit via fetch:', url);
                
                return originalFetch.apply(this, args)
                  .then(response => {
                    const cloned = response.clone();
                    cloned.json().then(data => {
                      if (data && !data.error) {
                        console.log('[Cloudflare] Comment submitted successfully via fetch');
                        window.__cloudflareCommentResult = data;
                      }
                    }).catch(() => {});
                    return response;
                  });
              }
            }
            
            return originalFetch.apply(this, args);
          };
          
          // Перехватываем XMLHttpRequest
          const originalXHROpen = XMLHttpRequest.prototype.open;
          const originalXHRSend = XMLHttpRequest.prototype.send;
          
          XMLHttpRequest.prototype.open = function(method, url) {
            this.__method = method;
            this.__url = url;
            return originalXHROpen.apply(this, arguments);
          };
          
          XMLHttpRequest.prototype.send = function(data) {
            if (this.__method === 'POST' && this.__url && (this.__url.includes('/comments/submit') || (this.__url.includes('/api/gallery/') && this.__url.includes('/comments')))) {
              console.log('[Cloudflare] Intercepting XHR comment submit:', this.__url);
              
              this.addEventListener('loadend', function() {
                if (this.status >= 200 && this.status < 300) {
                  try {
                    const result = JSON.parse(this.responseText);
                    if (result && !result.error) {
                      console.log('[Cloudflare] Comment submitted via XHR');
                      window.__cloudflareCommentResult = result;
                    }
                  } catch (e) {}
                }
              });
            }
            
            return originalXHRSend.apply(this, arguments);
          };
        })();
      `).catch(err => console.error('[Cloudflare] Error injecting interceptors:', err));
    });

    cloudflareWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        if (!cloudflareWindow || cloudflareWindow.isDestroyed() || cloudflareResolved) {
          return;
        }
        checkCookiesAndComment();
      }, 500);
      
      // Автоматически заполняем и отправляем комментарий в скрытом окне
      if (prefillText && galleryId) {
        // Ждем, пока DOM полностью загрузится
        setTimeout(() => {
          // Проверяем, что окно еще существует и не уничтожено
          if (!cloudflareWindow || cloudflareWindow.isDestroyed() || cloudflareResolved) {
            return;
          }
          
          cloudflareWindow.webContents.executeJavaScript(`
            (function() {
              try {
                console.log('[Cloudflare] Starting auto-fill and submit');
                
                // Находим textarea
                const textarea = document.querySelector('#id_body') || 
                                document.querySelector('textarea[name="body"]') ||
                                document.querySelector('textarea');
                
                if (textarea) {
                  console.log('[Cloudflare] Found textarea, inserting text:', ${JSON.stringify(prefillText.substring(0, 50))} + '...');
                  
                  // Вставляем текст
                  textarea.value = ${JSON.stringify(prefillText)};
                  
                  // Триггерим события для валидации
                  textarea.dispatchEvent(new Event('input', { bubbles: true }));
                  textarea.dispatchEvent(new Event('change', { bubbles: true }));
                  textarea.dispatchEvent(new Event('blur', { bubbles: true }));
                  
                  // Ждем немного для обработки событий и нажимаем кнопку
                  setTimeout(() => {
                    // Ищем форму комментария (родительский элемент textarea)
                    const commentForm = textarea.closest('form') || 
                                      textarea.closest('#comment_form') ||
                                      textarea.closest('.row')?.querySelector('form');
                    
                    // Ищем кнопку отправки ВНУТРИ формы комментария, а не на всей странице
                    let submitBtn = null;
                    
                    if (commentForm) {
                      // Ищем кнопку внутри формы комментария
                      submitBtn = commentForm.querySelector('button[type="submit"]') ||
                                 commentForm.querySelector('button.btn-primary') ||
                                 commentForm.querySelector('.btn-primary') ||
                                 commentForm.querySelector('button.btn');
                      
                      console.log('[Cloudflare] Found comment form, looking for submit button inside');
                    }
                    
                    // Если не нашли в форме, ищем рядом с textarea
                    if (!submitBtn) {
                      const commentContainer = textarea.closest('#comment_form') || 
                                              textarea.closest('.row') ||
                                              textarea.parentElement;
                      
                      if (commentContainer) {
                        submitBtn = commentContainer.querySelector('button[type="submit"]') ||
                                   commentContainer.querySelector('button.btn-primary') ||
                                   commentContainer.querySelector('.btn-primary');
                        console.log('[Cloudflare] Looking for submit button near textarea');
                      }
                    }
                    
                    if (submitBtn) {
                      console.log('[Cloudflare] Found submit button in comment form, clicking');
                      
                      // Проверяем, что textarea валидна (минимум 10 символов)
                      if (textarea.value.length >= 10) {
                        // Проверяем, что это действительно кнопка комментария (не поиска)
                        const btnText = submitBtn.textContent || submitBtn.innerHTML || '';
                        const isCommentBtn = btnText.includes('Comment') || 
                                           btnText.includes('comment') ||
                                           submitBtn.querySelector('i.fa-comment');
                        
                        if (isCommentBtn || !submitBtn.closest('form.search')) {
                          submitBtn.click();
                          console.log('[Cloudflare] Comment submit button clicked');
                        } else {
                          console.warn('[Cloudflare] Found submit button but it seems to be search button, skipping');
                        }
                      } else {
                        console.warn('[Cloudflare] Text too short:', textarea.value.length);
                      }
                    } else {
                      console.warn('[Cloudflare] Submit button not found in comment form, trying form submit');
                      
                      // Пробуем отправить форму комментария напрямую
                      if (commentForm && !commentForm.classList.contains('search')) {
                        commentForm.submit();
                        console.log('[Cloudflare] Comment form submitted directly');
                      }
                    }
                  }, 1000);
                } else {
                  console.warn('[Cloudflare] Textarea not found, retrying in 2 seconds...');
                  return false;
                  // Повторная попытка через 2 секунды (на случай медленной загрузки)
                  setTimeout(() => {
                    const retryTextarea = document.querySelector('#id_body') || 
                                         document.querySelector('textarea[name="body"]');
                    if (retryTextarea) {
                      retryTextarea.value = ${JSON.stringify(prefillText)};
                      retryTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                      
                      setTimeout(() => {
                        // Ищем кнопку в форме комментария, а не поиска
                        const retryForm = retryTextarea.closest('form');
                        const retryBtn = retryForm && !retryForm.classList.contains('search')
                          ? (retryForm.querySelector('button[type="submit"]') || 
                             retryForm.querySelector('.btn-primary'))
                          : null;
                        
                        if (retryBtn) {
                          const btnText = retryBtn.textContent || retryBtn.innerHTML || '';
                          const isCommentBtn = btnText.includes('Comment') || 
                                             btnText.includes('comment') ||
                                             retryBtn.querySelector('i.fa-comment');
                          
                          if (isCommentBtn || !retryBtn.closest('form.search')) {
                            retryBtn.click();
                            console.log('[Cloudflare] Submit button clicked on retry');
                          }
                        }
                      }, 500);
                    }
                  }, 2000);
                }
              } catch (err) {
                console.error('[Cloudflare] Error auto-filling comment:', err);
              }
            })();
          `).catch(err => {
            if (!cloudflareWindow || cloudflareWindow.isDestroyed()) {
              // Окно уже закрыто, это нормально
              return;
            }
            console.error('[Cloudflare] Error executing auto-fill script:', err);
          });
        }, 2000); // Даем больше времени на загрузку страницы и Cloudflare challenge
      }
    });

    cloudflareWindow.once('ready-to-show', () => {
      // Окно остается скрытым, работает в фоне
      // cloudflareWindow.show();
      
      // После загрузки, проверяем cookies еще раз
      setTimeout(() => {
        checkCookiesAndComment();
      }, 1000);
    });

    cloudflareWindow.on('closed', () => {
      console.log('[Cloudflare] Window closed event');
      
      if (cloudflareCookieInterval) {
        clearInterval(cloudflareCookieInterval);
        cloudflareCookieInterval = null;
      }
      
      // Очищаем интервал проверки комментариев
      // Примечание: commentCheckInterval объявлен внутри функции createCloudflareChallengeWindow,
      // поэтому мы очищаем его при проверке cloudflareResolved в самом интервале
      
      // Очищаем ссылку на окно только если оно действительно закрыто
      if (cloudflareWindow && cloudflareWindow.isDestroyed()) {
        cloudflareWindow = null;
      }
      
      if (cloudflareResolve && !cloudflareResolved) {
        console.log('[Cloudflare] Window closed without completion');
        finishCloudflare({ success: false, error: 'Window closed' });
      }
    });

    cloudflareWindow.loadURL(targetUrl);
  });
}

ipcMain.handle('electron:openCloudflareChallenge', async (event, options) => {
  try {
    const result = await createCloudflareChallengeWindow(options);
  return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Fetch HTML with Electron session cookies (bypasses CORS and proxy issues)
ipcMain.handle('electron:fetchHtml', async (event, url) => {
  try {
    const { net } = require('electron');
    
    // Получаем cookies из session
    const cookieList = await session.defaultSession.cookies.get({ url });
    
    // Формируем Cookie заголовок
    const cookieHeader = cookieList
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
    
    console.log(`[fetchHtml] Fetching ${url} with ${cookieList.length} cookies`);
    
    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: url,
        headers: {
          'Cookie': cookieHeader,
          'User-Agent': 'nh-client',
          'Referer': 'https://nhentai.net/',
          'Accept': 'text/html,application/xhtml+xml',
        },
        // net.request автоматически следует редиректам по умолчанию
      });
      
      let html = '';
      let finalUrl = url; // По умолчанию используем исходный URL
      
      request.on('response', (response) => {
        console.log(`[fetchHtml] Response status: ${response.statusCode}`);
        
        // Проверяем заголовок Location для редиректов
        const location = response.headers['location'] || response.headers['Location'];
        if (location) {
          // Если это относительный URL, делаем его абсолютным
          finalUrl = location.startsWith('http') ? location : new URL(location, url).href;
          console.log(`[fetchHtml] Redirect to: ${finalUrl}`);
        }
        
        response.on('data', (chunk) => {
          html += chunk.toString();
        });
        
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 400) {
            // 2xx и 3xx (редиректы) считаем успешными, так как net.request автоматически следует редиректам
            console.log(`[fetchHtml] Success, HTML length: ${html.length}, finalUrl: ${finalUrl}`);
            resolve({ success: true, html, status: response.statusCode, finalUrl });
          } else {
            console.warn(`[fetchHtml] HTTP ${response.statusCode}`);
            resolve({ success: false, error: `HTTP ${response.statusCode}`, status: response.statusCode, finalUrl });
          }
        });
      });
      
      request.on('error', (error) => {
        console.error(`[fetchHtml] Request error:`, error);
        resolve({ success: false, error: error.message, finalUrl: url });
      });
      
      request.end();
    });
  } catch (error) {
    console.error(`[fetchHtml] Error:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('electron:readFile', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('electron:writeFile', async (event, filePath, content) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// File system operations for Electron
ipcMain.handle('electron:getInfo', async (event, filePath) => {
  try {
    const stats = await fs.promises.stat(filePath).catch(() => null);
    if (!stats) {
      return { success: true, exists: false };
    }
    return {
      success: true,
      exists: true,
      isDirectory: stats.isDirectory(),
      size: stats.size,
      modificationTime: stats.mtime.getTime(),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Окна чтения (храним ссылки для управления)
const readerWindows = new Map();

ipcMain.handle('electron:openReaderWindow', async (event, options) => {
  const { bookId, page = 1 } = options;
  const windowKey = `reader-${bookId}`;
  
  // Если окно уже открыто, фокусируем его
  if (readerWindows.has(windowKey)) {
    const existingWindow = readerWindows.get(windowKey);
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus();
      existingWindow.webContents.send('reader:navigate', { bookId, page });
      return { success: true, windowId: existingWindow.id };
    } else {
      readerWindows.delete(windowKey);
    }
  }
  
  // Используем отдельный preload для reader окна
  const readerPreloadPath = path.join(__dirname, 'reader-preload.js');
  const readerHtmlPath = path.join(__dirname, 'reader.html');
  
  // Получаем размер экрана
  const { width: screenWidth, height: screenHeight } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  
  const readerWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    minWidth: 600,
    minHeight: 400,
    frame: false, // Без рамки для полного контроля
    transparent: true, // Прозрачное окно для оверлея
    backgroundColor: '#00000000',
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    webPreferences: {
      preload: readerPreloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
    },
    show: false, // Показываем после загрузки
  });
  
  readerWindows.set(windowKey, readerWindow);
  
  // Отслеживаем maximize/minimize для обновления кнопки
  readerWindow.on('maximize', () => {
    readerWindow.webContents.send('window:maximize');
  });
  
  readerWindow.on('unmaximize', () => {
    readerWindow.webContents.send('window:unmaximize');
  });
  
  // Удаляем из Map при закрытии окна
  readerWindow.on('closed', () => {
    readerWindows.delete(windowKey);
  });
  
  // Показываем окно сразу и разворачиваем на весь экран
  readerWindow.once('ready-to-show', () => {
    readerWindow.maximize();
    readerWindow.show();
  });
  
  // Загружаем через app:// протокол для общего localStorage
  // Используем путь относительно dist для единого протокола с основным окном
  const readerUrl = `app://./electron/reader.html?bookId=${bookId}&page=${page}`;
  readerWindow.loadURL(readerUrl).catch(err => {
    console.error('[Electron Reader] Error loading window:', err);
  });
  
  return { success: true, windowId: readerWindow.id };
});

ipcMain.handle('electron:readDirectory', async (event, dirPath) => {
  try {
    const entries = await fs.promises.readdir(dirPath);
    return { success: true, entries };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('electron:makeDirectory', async (event, dirPath, options) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: options?.intermediates !== false });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('electron:deleteAsync', async (event, filePath, options) => {
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.isDirectory()) {
      await fs.promises.rmdir(filePath, { recursive: true });
    } else {
      await fs.promises.unlink(filePath);
    }
    return { success: true };
  } catch (error) {
    if (options?.idempotent && error.code === 'ENOENT') {
      return { success: true }; // File doesn't exist, but that's ok
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('electron:getPicturesPath', async () => {
  try {
    const picturesPath = app.getPath('pictures');
    return { success: true, path: picturesPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Path utilities for renderer process
ipcMain.handle('electron:pathJoin', async (event, ...paths) => {
  try {
    return path.join(...paths);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('electron:pathNormalize', async (event, p) => {
  try {
    return path.normalize(p);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('electron:pathSep', async () => {
  return path.sep;
});

// Show folder picker dialog
ipcMain.handle('electron:showOpenDialog', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      ...options,
    });
    return { success: true, canceled: result.canceled, filePaths: result.filePaths };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Download file from URL to local path
ipcMain.handle('electron:downloadFile', async (event, url, filePath) => {
  try {
    const { net } = require('electron');
    
    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: url,
      });
      
      const fileStream = fs.createWriteStream(filePath);
      
      request.on('response', (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          response.on('data', (chunk) => {
            fileStream.write(chunk);
          });
          
          response.on('end', () => {
            fileStream.end();
            resolve({ success: true });
          });
    } else {
          fileStream.end();
          fs.unlink(filePath, () => {});
          resolve({ success: false, error: `HTTP ${response.statusCode}` });
        }
      });
      
      request.on('error', (error) => {
        fileStream.end();
        fs.unlink(filePath, () => {});
        resolve({ success: false, error: error.message });
      });
      
      request.end();
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Fetch JSON/API requests with Electron session cookies (bypasses CORS and proxy issues)
ipcMain.handle('electron:fetchJson', async (event, url, options) => {
  try {
    const { net } = require('electron');
    
    const method = options.method || 'GET';
    const headers = options.headers || {};
    
    // Если cookies уже переданы в заголовках (из AsyncStorage), используем их
    // Иначе получаем из session
    if (!headers['Cookie']) {
      // Получаем cookies из session
      const cookieList = await session.defaultSession.cookies.get({ url });
      
      // Формируем Cookie заголовок
      const cookieHeader = cookieList
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
      
      if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
        console.log(`[fetchJson] Using cookies from session (${cookieList.length} cookies)`);
      }
    } else {
      console.log(`[fetchJson] Using cookies from headers (from AsyncStorage)`);
    }
    
    // Фильтруем заголовки: убираем пустые значения и undefined
    const cleanHeaders = {};
    Object.keys(headers).forEach(key => {
      const value = headers[key];
      if (value !== undefined && value !== null && value !== '') {
        cleanHeaders[key] = String(value);
      }
    });
    
    // Формируем финальные заголовки: сначала дефолтные, потом пользовательские (чтобы пользовательские перезаписывали дефолтные)
    const finalHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://nhentai.net/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://nhentai.net',
      ...cleanHeaders, // Пользовательские заголовки перезаписывают дефолтные
    };
    
    console.log(`[fetchJson] ${method} ${url}`);
    console.log(`[fetchJson] Headers:`, JSON.stringify(finalHeaders, null, 2));
    
    return new Promise((resolve) => {
      const request = net.request({
        method: method,
        url: url,
        headers: finalHeaders,
      });
      
      let body = '';
      let hasError = false;
      
      request.on('response', (response) => {
        console.log(`[fetchJson] Response status: ${response.statusCode}`);
        
        response.on('data', (chunk) => {
          body += chunk.toString();
        });
        
        response.on('end', () => {
          if (hasError) return;
          
          const responseHeaders = {};
          if (response.headers) {
            Object.keys(response.headers).forEach(key => {
              const value = response.headers[key];
              if (Array.isArray(value)) {
                responseHeaders[key] = value.join(', ');
              } else {
                responseHeaders[key] = value;
              }
            });
          }
          
          // Проверяем на Cloudflare challenge
          const isCloudflareChallenge = 
            response.statusCode === 403 || 
            response.statusCode === 429 ||
            (response.statusCode === 200 && (
              body.includes('challenges.cloudflare.com') ||
              body.includes('cf-browser-verification') ||
              body.includes('Just a moment') ||
              body.includes('Checking your browser')
            ));
          
          if (isCloudflareChallenge) {
            console.warn(`[fetchJson] Cloudflare challenge detected (status ${response.statusCode})`);
            resolve({
              success: false,
              status: response.statusCode,
              statusText: response.statusMessage || 'Cloudflare Challenge',
              headers: responseHeaders,
              body: body,
              error: 'Cloudflare challenge detected. Please try again later or check your connection.',
            });
            return;
          }
          
          // Логируем ответ для отладки
          if (response.statusCode !== 200) {
            console.log(`[fetchJson] Response body (status ${response.statusCode}):`, body.substring(0, 500));
          }
          
          resolve({
            success: true,
            status: response.statusCode,
            statusText: response.statusMessage || '',
            headers: responseHeaders,
            body: body,
          });
        });
      });
      
      request.on('error', (error) => {
        console.error(`[fetchJson] Request error:`, error);
        hasError = true;
        resolve({ success: false, error: error.message });
      });
      
      // Если есть body, отправляем его ПОСЛЕ установки обработчиков
      if (options.body) {
        if (typeof options.body === 'string') {
          request.write(options.body);
        } else if (options.body instanceof ArrayBuffer) {
          request.write(Buffer.from(options.body));
        } else if (Buffer.isBuffer(options.body)) {
          request.write(options.body);
        }
      }
      
      request.end();
    });
  } catch (error) {
    console.error(`[fetchJson] Error:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('electron:getPath', async (event, name) => {
  try {
    return app.getPath(name);
  } catch (error) {
    return null;
  }
});

ipcMain.handle('electron:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC методы для получения книги (для reader окна)
ipcMain.handle('electron:getBook', async (event, id) => {
  try {
    console.log('[getBook] Starting fetch for book:', id);
    const url = `https://nhentai.net/api/gallery/${id}`;
    
    // Получаем cookies из session
    const cookieList = await session.defaultSession.cookies.get({ url });
    const cookieHeader = cookieList.map(c => `${c.name}=${c.value}`).join('; ');
    
    const { net } = require('electron');
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://nhentai.net/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://nhentai.net',
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('[getBook] Request timeout for book:', id);
        reject(new Error('Request timeout'));
      }, 30000); // 30 секунд таймаут
      
      const request = net.request({ method: 'GET', url, headers });
      let body = '';
      
      request.on('response', (response) => {
        console.log('[getBook] Response status:', response.statusCode);
        
        if (response.statusCode !== 200) {
          clearTimeout(timeout);
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        response.on('data', (chunk) => { 
          body += chunk.toString();
        });
        
        response.on('end', () => {
          clearTimeout(timeout);
          try {
            console.log('[getBook] Parsing JSON, body length:', body.length);
            const data = JSON.parse(body);
            console.log('[getBook] JSON parsed, num_pages:', data.num_pages);
            
            // Для больших книг парсим асинхронно, чтобы не блокировать IPC
            if (data.num_pages > 200) {
              console.log('[getBook] Large book detected, parsing asynchronously...');
              // Используем setImmediate для неблокирующей обработки
              setImmediate(() => {
                try {
                  const book = parseBookData(data);
                  console.log('[getBook] Book parsed asynchronously, pages count:', book.pages.length);
                  resolve(book);
                } catch (error) {
                  console.error('[getBook] Async parse error:', error);
                  reject(error);
                }
              });
            } else {
              // Парсим данные книги синхронно для маленьких книг
              console.log('[getBook] Starting parseBookData...');
              const book = parseBookData(data);
              console.log('[getBook] Book parsed, pages count:', book.pages.length);
              resolve(book);
            }
          } catch (error) {
            console.error('[getBook] Parse error:', error);
            reject(error);
          }
        });
      });
      
      request.on('error', (error) => {
        clearTimeout(timeout);
        console.error('[getBook] Request error:', error);
        reject(error);
      });
      
      request.end();
    });
  } catch (error) {
    console.error('[getBook] Error:', error);
    throw error;
  }
});

ipcMain.handle('electron:getBookFromLocal', async (event, id) => {
  try {
    console.log('[getBookFromLocal] Searching for book:', id);
    const documentsPath = app.getPath('documents');
    const nhDir = path.join(documentsPath, 'NHAppAndroid');
    
    if (!fs.existsSync(nhDir)) {
      console.log('[getBookFromLocal] Directory does not exist:', nhDir);
      return null;
    }
    
    const titles = fs.readdirSync(nhDir);
    console.log('[getBookFromLocal] Found', titles.length, 'titles');
    
    for (const title of titles) {
      const titleDir = path.join(nhDir, title);
      if (!fs.statSync(titleDir).isDirectory()) continue;
      
      const idMatch = title.match(/^(\d+)_/);
      if (idMatch && Number(idMatch[1]) !== id) continue;
      
      const langs = fs.readdirSync(titleDir);
      for (const lang of langs) {
        const langDir = path.join(titleDir, lang);
        if (!fs.statSync(langDir).isDirectory()) continue;
        
        const metaPath = path.join(langDir, 'metadata.json');
        if (!fs.existsSync(metaPath)) continue;
        
        try {
          const metaContent = fs.readFileSync(metaPath, 'utf8');
          const book = JSON.parse(metaContent);
          
          if (book.id !== id) continue;
          
          console.log('[getBookFromLocal] Found book, loading images...');
          const images = fs.readdirSync(langDir)
            .filter(f => f.startsWith('Image'))
            .sort();
          
          console.log('[getBookFromLocal] Found', images.length, 'images');
          
          // Оптимизируем создание страниц для больших книг
          const pages = new Array(images.length);
          for (let idx = 0; idx < images.length; idx++) {
            const img = images[idx];
            const imgPath = path.join(langDir, img);
            const uri = `local:///${imgPath.replace(/\\/g, '/')}`;
            pages[idx] = {
              page: idx + 1,
              url: uri,
              urlThumb: uri,
              width: 800,
              height: 1200,
            };
          }
          
          book.pages = pages;
          book.cover = pages[0]?.url || '';
          console.log('[getBookFromLocal] Book loaded successfully, pages:', pages.length);
          return book;
        } catch (e) {
          console.warn('[getBookFromLocal] Error processing metadata:', e);
          continue;
        }
      }
    }
    
    console.log('[getBookFromLocal] Book not found');
    return null;
  } catch (error) {
    console.error('[getBookFromLocal] Error:', error);
    return null;
  }
});

// Функция для парсинга данных книги (из nhentai.ts)
function parseBookData(item) {
  const media = item.media_id;
  
  // Определяем расширение по токену (как в nhentai.ts) - ПОЛНАЯ версия
  const extByToken = (t) => {
    switch (t) {
      case 'J': return 'jpg.webp';
      case 'j': return 'jpg';
      case 'P': return 'png.webp';
      case 'p': return 'png';
      case 'W': return 'webp.webp';
      case 'w': return 'webp';
      case 'G': return 'gif.webp';
      case 'g': return 'gif';
      default: return 'jpg';
    }
  };
  
  // Выбираем хост для страниц (как в nhentai.ts)
  const pickHost = (mediaId, pageNum) => {
    const hosts = ['i1', 'i2', 'i3', 'i4'];
    return hosts[(mediaId + pageNum) % hosts.length];
  };
  
  const coverExt = extByToken(item.images.cover?.t || 'j');
  const thumbExt = extByToken(item.images.thumbnail?.t || 'j');
  
  const coverBase = `https://t3.nhentai.net/galleries/${media}/cover`;
  const thumbBase = `https://t3.nhentai.net/galleries/${media}/thumb`;
  
  // Оптимизированное создание страниц - создаем массив без использования Array.from для больших книг
  const numPages = item.num_pages || 0;
  const pages = new Array(numPages);
  
  // Используем более эффективный цикл для больших книг
  for (let i = 0; i < numPages; i++) {
    const pageNum = i + 1;
    const img = item.images.pages[i] || {};
    const pageExt = extByToken(img.t || 'j');
    const host = pickHost(media, pageNum);
    
    const pageBase = `https://${host}.nhentai.net/galleries/${media}/${pageNum}`;
    const pageBaseThumb = `https://t1.nhentai.net/galleries/${media}/${pageNum}t`;
    
    pages[i] = {
      page: pageNum,
      url: `${pageBase}.${pageExt}`,
      urlThumb: `${pageBaseThumb}.${pageExt}`,
      width: img.w ?? 0,
      height: img.h ?? 0,
    };
  }
  
  return {
    id: Number(item.id),
    title: {
      english: item.title.english || '',
      japanese: item.title.japanese || '',
      pretty: item.title.pretty || '',
    },
    uploaded: item.upload_date
      ? new Date(item.upload_date * 1000).toISOString()
      : '',
    media,
    favorites: item.num_favorites || 0,
    pagesCount: item.num_pages || 0,
    scanlator: item.scanlator || '',
    tags: item.tags || [],
    cover: `${coverBase}.${coverExt}`,
    coverW: item.images.cover?.w ?? 0,
    coverH: item.images.cover?.h ?? 0,
    thumbnail: `${thumbBase}.${thumbExt}`,
    pages,
  };
}

ipcMain.handle('electron:minimize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) window.minimize();
});

ipcMain.handle('electron:maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
});

ipcMain.handle('electron:close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) window.close();
});

// История чтения - используем общий localStorage через app:// протокол
// Не нужны IPC методы, так как localStorage теперь общий для всех окон

// Инициализация приложения
app.whenReady().then(() => {
  // Регистрируем протоколы ДО создания окна
  registerProtocols();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (devServerProcess) devServerProcess.kill();
});

