


(function() {
  'use strict';
  const electronReader = window.electronReader;
  if (!electronReader) {
    console.error('[Reader] electronReader API not available');
    document.body.innerHTML = '<div style="color: white; padding: 20px;">Ошибка: electronReader API не доступен</div>';
    return;
  }

  const SETTINGS_KEY = 'reader_settings';
  const READ_HISTORY_KEY = 'readHistory';
  let bookId = null;
  let idx = 0; 
  let angle = 0; 
  let zoom = 1; 
  let dual = false; 
  let longlist = false; 
  let offset = { x: 0, y: 0 };
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let pages = [];
  let totalPages = 0;
  let bookTitle = '';
  let wheelBlock = false;
  let preloadedImages = new Set();
  const bookTitleEl = document.getElementById('bookTitle');
  const infoEl = document.getElementById('info');
  const stageEl = document.getElementById('stage');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const minimizeBtn = document.getElementById('minimizeBtn');
  const maximizeBtn = document.getElementById('maximizeBtn');
  const closeBtn = document.getElementById('closeBtn');
  const rotateBtn = document.getElementById('rotateBtn');
  const dualBtn = document.getElementById('dualBtn');
  const longlistBtn = document.getElementById('longlistBtn');
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const settings = JSON.parse(raw);
        dual = settings.dual || false;
        longlist = settings.longlist || false;
        angle = settings.angle || 0;
        console.log('[Reader] Settings loaded:', { dual, longlist, angle });
      }
    } catch (e) {
      console.warn('[Reader] Failed to load settings:', e);
    }
  }
  function saveSettings() {
    try {
      const settings = { dual, longlist, angle };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[Reader] Failed to save settings:', e);
    }
  }
  let historyUpdateTimeout = null;
  let lastSavedPage = null;
  function updateReadHistory() {
    if (!bookId || !totalPages) return;
    const currentPage = idx + 1;
    if (lastSavedPage === currentPage) return;
    if (historyUpdateTimeout) {
      clearTimeout(historyUpdateTimeout);
    }
    historyUpdateTimeout = setTimeout(() => {
      try {
        const raw = localStorage.getItem(READ_HISTORY_KEY);
        let arr = [];
        if (raw) {
          try {
            arr = JSON.parse(raw);
            if (!Array.isArray(arr)) arr = [];
          } catch {
            arr = [];
          }
        }
        arr = arr.filter(([id]) => id !== bookId);
        const timestamp = Math.floor(Date.now() / 1000);
        arr.unshift([bookId, currentPage, totalPages, timestamp]);
        localStorage.setItem(READ_HISTORY_KEY, JSON.stringify(arr));
        lastSavedPage = currentPage;
        console.log('[Reader] History updated:', bookId, currentPage, totalPages);
      } catch (e) {
        console.warn('[Reader] Failed to update history:', e);
      }
    }, 1000); 
  }
  function getLastProgressFromHistory() {
    if (!bookId) return null;
    try {
      const raw = localStorage.getItem(READ_HISTORY_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return null;
      const entry = arr.find(([id]) => id === bookId);
      return entry ? entry[1] : null; 
    } catch {
      return null;
    }
  }
  async function init() {
    const params = new URLSearchParams(window.location.search);
    bookId = parseInt(params.get('bookId') || params.get('id') || '0');
    let startPage = parseInt(params.get('page') || '1');
    if (!bookId) {
      showError('Не указан ID книги');
      return;
    }
    loadSettings();
    if (!params.get('page')) {
      const lastPage = getLastProgressFromHistory();
      if (lastPage) {
        startPage = lastPage;
        console.log('[Reader] Restoring from history, page:', lastPage);
      }
    }
    idx = startPage - 1; 
    electronReader.onNavigate((data) => {
      if (data.bookId === bookId && data.page) {
        idx = data.page - 1;
        renderPage();
        preloadNeighbors();
        updateReadHistory();
      }
    });
    await loadBook(bookId);
    setupWindowControls();
    setupTools();
    setupKeyboard();
    setupWheel();
    setupDrag();
    window.addEventListener('beforeunload', () => {
      if (historyUpdateTimeout) {
        clearTimeout(historyUpdateTimeout);
      }
      try {
        const raw = localStorage.getItem(READ_HISTORY_KEY);
        let arr = [];
        if (raw) {
          try {
            arr = JSON.parse(raw);
            if (!Array.isArray(arr)) arr = [];
          } catch {
            arr = [];
          }
        }
        arr = arr.filter(([id]) => id !== bookId);
        const timestamp = Math.floor(Date.now() / 1000);
        arr.unshift([bookId, idx + 1, totalPages, timestamp]);
        localStorage.setItem(READ_HISTORY_KEY, JSON.stringify(arr));
      } catch (e) {
        console.warn('[Reader] Failed to save history on close:', e);
      }
    });
  }
  async function loadBook(id) {
    try {
      console.log('[Reader] Loading book:', id);
      updateInfo('Загрузка...');
      let book = null;
      let isLocalBook = false;
      try {
        console.log('[Reader] Attempting to load from local storage...');
        book = await electronReader.getBookFromLocal(id);
        if (book) {
          isLocalBook = true;
          if (book.pages && book.pages.length > 0) {
            const localPagesCount = book.pages.filter(p => p.url && p.url.startsWith('local://')).length;
            const remotePagesCount = book.pages.length - localPagesCount;
            if (remotePagesCount === 0) {
              console.log('[Reader] ✅ Loaded from local (OFFLINE MODE - all pages are local)');
              console.log('[Reader] Total pages:', book.pages.length);
              console.log('[Reader] First page URL:', book.pages[0]?.url);
              console.log('[Reader] Second page URL:', book.pages[1]?.url);
              updateInfo('Загружено локально');
            } else {
              console.error('[Reader] ❌ CRITICAL: Local book but some pages are REMOTE!');
              console.error('[Reader] Local pages:', localPagesCount);
              console.error('[Reader] Remote pages:', remotePagesCount);
              console.log('[Reader] Fixing remote URLs...');
              for (let i = 0; i < book.pages.length; i++) {
                const page = book.pages[i];
                if (!page.url || !page.url.startsWith('local://')) {
                  console.warn(`[Reader] Page ${i + 1} has remote URL: ${page.url}`);
                }
              }
              console.log('[Reader] ⚠️ Using local book despite remote pages (this should not happen!)');
            }
          } else {
            console.warn('[Reader] ⚠️ Local book has no pages!');
          }
        } else {
          console.log('[Reader] Book not found in local storage');
        }
      } catch (e) {
        console.error('[Reader] ❌ Local load error:', e.message);
        console.error('[Reader] Error stack:', e.stack);
        book = null;
        isLocalBook = false;
      }
      if (!book) {
        console.warn('[Reader] ⚠️ Book not found in local storage');
        console.warn('[Reader] Searching directories for book ID:', id);
        console.log('[Reader] Attempting to load from server as fallback...');
        updateInfo('Загрузка с сервера...');
        try {
          book = await Promise.race([
            electronReader.getBook(id),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 35000))
          ]);
          console.log('[Reader] ✅ Loaded from server');
        } catch (e) {
          console.error('[Reader] ❌ Server load failed:', e.message);
          if (e.message && (
            e.message.includes('ERR_NAME_NOT_RESOLVED') || 
            e.message.includes('ERR_INTERNET_DISCONNECTED') ||
            e.message.includes('ERR_NETWORK') ||
            e.message.includes('timeout')
          )) {
            showError('Книга не найдена локально и нет подключения к интернету.\n\nПроверьте:\n1. Что книга скачана\n2. Что файлы находятся в папке загрузок\n3. Попробуйте переподключить интернет для проверки');
          } else {
            showError('Ошибка загрузки: ' + e.message);
          }
          return;
        }
      } else {
        console.log('[Reader] ✅ Using LOCAL book, NOT loading from server');
        if (!isLocalBook) {
          console.warn('[Reader] ⚠️ WARNING: book found but isLocalBook is false! Setting to true...');
          isLocalBook = true;
        }
      }
      if (!book || !book.pages || !Array.isArray(book.pages)) {
        showError('Книга не найдена');
        return;
      }
      const localPagesCount = book.pages.filter(p => p.url && p.url.startsWith('local://')).length;
      const remotePagesCount = book.pages.length - localPagesCount;
      console.log('[Reader] Book loaded:');
      console.log('  - Total pages:', book.pages.length);
      console.log('  - Local pages:', localPagesCount);
      console.log('  - Remote pages:', remotePagesCount);
      if (book.pages[0]) {
        console.log('  - First page URL:', book.pages[0].url);
      }
      if (remotePagesCount > 0 && isLocalBook) {
        console.warn('[Reader] ⚠️ WARNING: Local book but some pages are remote!');
        console.warn('[Reader] This should not happen for downloaded books!');
      }
      pages = book.pages;
      totalPages = pages.length;
      bookTitle = book.title?.pretty || `#${id}`;
      bookTitleEl.textContent = bookTitle;
      console.log('[Reader] ✅ Ready to display book');
    renderPage();
    preloadNeighbors();
  } catch (error) {
    console.error('[Reader] Error:', error);
    showError('Ошибка загрузки: ' + error.message);
  }
}
  function preloadNeighbors() {
    if (longlist) return; 
    const range = 2;
    const start = Math.max(0, idx - range);
    const end = Math.min(totalPages - 1, idx + range);
    for (let i = start; i <= end; i++) {
      if (preloadedImages.has(i)) continue;
      const page = pages[i];
      if (!page) continue;
      const img = new Image();
      img.onload = () => {
        preloadedImages.add(i);
        console.log('[Reader] Preloaded page:', i + 1);
      };
      img.onerror = () => {
        console.warn('[Reader] Failed to preload page:', i + 1);
      };
      img.src = page.url;
    }
  }
  function renderPage() {
    if (longlist) {
      renderLonglist();
      return;
    }
    const current = pages[idx];
    const second = dual ? pages[idx + 1] : null;
    if (!current) {
      stageEl.innerHTML = '<div class="loading"><span>Страница не найдена</span></div>';
      return;
    }
    const figure = document.createElement('figure');
    figure.style.transform = `rotate(${angle}deg) scale(${zoom}) translate(${offset.x}px, ${offset.y}px)`;
    figure.style.transition = 'transform 0.2s ease-out';
    figure.style.display = 'flex';
    figure.style.gap = 'var(--spacing-sm)';
    figure.style.cursor = zoom > 1 ? 'grab' : 'default';
    if (dual && second) {
      figure.classList.add('dual');
    }
    const img1 = document.createElement('img');
    if (idx === 0) {
      console.log('[Reader] Rendering first page with URL:', current.url);
      if (!current.url || !current.url.startsWith('local://')) {
        console.warn('[Reader] ⚠️ WARNING: First page URL is not local:// !');
        console.warn('[Reader] This means the book is loading from internet!');
      }
    }
    img1.src = current.url;
    img1.alt = `Page ${idx + 1}`;
    img1.draggable = false;
    figure.appendChild(img1);
    if (dual && second) {
      const img2 = document.createElement('img');
      img2.src = second.url;
      img2.alt = `Page ${idx + 2}`;
      img2.draggable = false;
      figure.appendChild(img2);
    }
    stageEl.innerHTML = '';
    stageEl.className = 'stage';
    stageEl.appendChild(figure);
    updateUI();
    saveSettings();
    updateReadHistory();
  }
  function renderLonglist() {
    stageEl.className = 'stage longlist';
    const container = document.createElement('div');
    container.className = 'longlist-container';
    pages.forEach((page) => {
      const img = document.createElement('img');
      img.src = page.url;
      img.alt = `Page ${page.page}`;
      img.draggable = false;
      img.loading = 'lazy';
      container.appendChild(img);
    });
    stageEl.innerHTML = '';
    stageEl.appendChild(container);
    requestAnimationFrame(() => {
      const currentImg = container.querySelector(`img[alt="Page ${idx + 1}"]`);
      if (currentImg) {
        currentImg.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    updateUI();
    saveSettings();
  }
  function next() {
    if (longlist) return;
    idx = Math.min(totalPages - 1, idx + (dual ? 2 : 1));
    zoom = 1;
    offset = { x: 0, y: 0 };
    renderPage();
    preloadNeighbors();
    updateReadHistory(); 
  }
  function prev() {
    if (longlist) return;
    idx = Math.max(0, idx - (dual ? 2 : 1));
    zoom = 1;
    offset = { x: 0, y: 0 };
    renderPage();
    preloadNeighbors();
    updateReadHistory(); 
  }
  function updateUI() {
    const showDual = dual && pages[idx + 1] && idx + 1 !== totalPages;
    if (longlist) {
      infoEl.textContent = `Long-list mode (${totalPages} страниц)`;
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
      rotateBtn.style.display = 'none';
      dualBtn.style.display = 'none';
    } else {
      infoEl.textContent = `${idx + 1}${showDual ? `-${idx + 2}` : ''}/${totalPages} | Zoom ${(zoom * 100).toFixed(0)}%`;
      prevBtn.style.display = idx > 0 ? 'flex' : 'none';
      nextBtn.style.display = idx < totalPages - 1 ? 'flex' : 'none';
      rotateBtn.style.display = 'flex';
      dualBtn.style.display = 'flex';
    }
    dualBtn.className = dual ? 'active' : '';
    longlistBtn.className = longlist ? 'active' : '';
  }
  function updateInfo(text) {
    infoEl.textContent = text;
  }
  function showError(message) {
    stageEl.innerHTML = `<div class="loading"><span>${message}</span></div>`;
    updateInfo(message);
  }
  function setupTools() {
    rotateBtn.onclick = () => {
      angle = (angle + 90) % 360;
      renderPage();
    };
    dualBtn.onclick = () => {
      dual = !dual;
      renderPage();
      preloadNeighbors();
    };
    longlistBtn.onclick = () => {
      longlist = !longlist;
      if (longlist) {
        dual = false;
        zoom = 1;
        angle = 0;
        offset = { x: 0, y: 0 };
      }
      stageEl.className = longlist ? 'stage longlist' : 'stage';
      renderPage();
    };
  }
  function setupWindowControls() {
    minimizeBtn.onclick = () => electronReader.minimize();
    maximizeBtn.onclick = () => electronReader.maximize();
    closeBtn.onclick = () => electronReader.close();
    prevBtn.onclick = () => prev();
    nextBtn.onclick = () => next();
    electronReader.onWindowMaximize(() => {
      maximizeBtn.textContent = '❐';
    });
    electronReader.onWindowUnmaximize(() => {
      maximizeBtn.textContent = '□';
    });
  }
  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          electronReader.close();
        }
      }
      if (longlist) return; 
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key.toLowerCase() === 'r') {
        angle = (angle + 90) % 360;
        renderPage();
      }
      if (e.key.toLowerCase() === 'd') {
        dual = !dual;
        renderPage();
        preloadNeighbors();
      }
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
    });
  }
  function setupWheel() {
    document.addEventListener('wheel', (e) => {
      if (longlist) return; 
      if (e.ctrlKey) {
        e.preventDefault();
        const newZoom = Math.min(5, Math.max(0.5, zoom - e.deltaY * 0.001));
        zoom = newZoom;
        if (zoom <= 1) offset = { x: 0, y: 0 };
        renderPage();
        return;
      }
      if (wheelBlock) return;
      wheelBlock = true;
      e.deltaY > 0 ? next() : prev();
      setTimeout(() => (wheelBlock = false), 160);
    }, { passive: false });
  }
  function setupDrag() {
    stageEl.addEventListener('mousedown', (e) => {
      if (zoom <= 1 || longlist) return;
      if (e.target.closest('.nav') || e.target.closest('.tools') || 
          e.target.closest('.title-bar') || e.target.closest('.info')) return;
      e.preventDefault();
      isDragging = true;
      dragStart = { x: e.clientX - offset.x, y: e.clientY - offset.y };
      stageEl.style.cursor = 'grabbing';
    });
    stageEl.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      offset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      };
      renderPage();
    });
    stageEl.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        stageEl.style.cursor = zoom > 1 ? 'grab' : 'default';
      }
    });
    stageEl.addEventListener('mouseleave', () => {
      if (isDragging) {
        isDragging = false;
        stageEl.style.cursor = zoom > 1 ? 'grab' : 'default';
      }
    });
    stageEl.addEventListener('click', (e) => {
      if (e.target === stageEl && !longlist && zoom <= 1) {
        electronReader.close();
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
