// Electron Reader - полноценный вьювер с зумом, режимами и навигацией
// Основан на старом проекте nhapp-viewer

(function() {
  'use strict';
  
  const electronReader = window.electronReader;
  
  if (!electronReader) {
    console.error('[Reader] electronReader API not available');
    document.body.innerHTML = '<div style="color: white; padding: 20px;">Ошибка: electronReader API не доступен</div>';
    return;
  }

  // ── Constants ──────────────────────────────────────────────────────────
  const SETTINGS_KEY = 'reader_settings';
  const READ_HISTORY_KEY = 'readHistory';
  
  // ── State ──────────────────────────────────────────────────────────────
  let bookId = null;
  let idx = 0; // текущая страница (0-based)
  let angle = 0; // 0 / 90 / 180 / 270
  let zoom = 1; // 0.5 – 5
  let dual = false; // две страницы
  let longlist = false; // вертикальная лента
  let offset = { x: 0, y: 0 };
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let pages = [];
  let totalPages = 0;
  let bookTitle = '';
  let wheelBlock = false;
  let preloadedImages = new Set();
  
  // ── DOM Elements ───────────────────────────────────────────────────────
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
  
  // ── Settings ───────────────────────────────────────────────────────────
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
  
  // ── История чтения ─────────────────────────────────────────────────────
  // Используем общий localStorage через app:// протокол
  let historyUpdateTimeout = null;
  let lastSavedPage = null;
  
  function updateReadHistory() {
    if (!bookId || !totalPages) return;
    
    const currentPage = idx + 1;
    
    // Пропускаем если страница не изменилась
    if (lastSavedPage === currentPage) return;
    
    // Debounce: обновляем максимум раз в секунду
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
        
        // Удаляем старую запись для этой книги
        arr = arr.filter(([id]) => id !== bookId);
        
        // Добавляем новую запись
        const timestamp = Math.floor(Date.now() / 1000);
        arr.unshift([bookId, currentPage, totalPages, timestamp]);
        
        // Сохраняем в общий localStorage (через app:// протокол)
        localStorage.setItem(READ_HISTORY_KEY, JSON.stringify(arr));
        
        lastSavedPage = currentPage;
        console.log('[Reader] History updated:', bookId, currentPage, totalPages);
      } catch (e) {
        console.warn('[Reader] Failed to update history:', e);
      }
    }, 1000); // Debounce 1 секунда
  }
  
  function getLastProgressFromHistory() {
    if (!bookId) return null;
    
    try {
      const raw = localStorage.getItem(READ_HISTORY_KEY);
      if (!raw) return null;
      
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return null;
      
      const entry = arr.find(([id]) => id === bookId);
      return entry ? entry[1] : null; // возвращаем currentPage
    } catch {
      return null;
    }
  }
  
  // ── Инициализация ──────────────────────────────────────────────────────
  async function init() {
    const params = new URLSearchParams(window.location.search);
    bookId = parseInt(params.get('bookId') || params.get('id') || '0');
    let startPage = parseInt(params.get('page') || '1');
    
    if (!bookId) {
      showError('Не указан ID книги');
      return;
    }
    
    // Загружаем настройки
    loadSettings();
    
    // Если не указана страница, пробуем загрузить из истории
    if (!params.get('page')) {
      const lastPage = getLastProgressFromHistory();
      if (lastPage) {
        startPage = lastPage;
        console.log('[Reader] Restoring from history, page:', lastPage);
      }
    }
    
    idx = startPage - 1; // 0-based
    
    // Слушаем навигацию
    electronReader.onNavigate((data) => {
      if (data.bookId === bookId && data.page) {
        idx = data.page - 1;
        renderPage();
        preloadNeighbors();
        updateReadHistory();
      }
    });
    
    // Загружаем книгу
    await loadBook(bookId);
    
    // Управление окном
    setupWindowControls();
    
    // Управление инструментами
    setupTools();
    
    // Клавиатура и колесо
    setupKeyboard();
    setupWheel();
    
    // Drag для зума
    setupDrag();
    
    // Сохраняем историю при закрытии (синхронно)
    window.addEventListener('beforeunload', () => {
      if (historyUpdateTimeout) {
        clearTimeout(historyUpdateTimeout);
      }
      // Синхронное сохранение при закрытии
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
  
  // ── Загрузка книги ─────────────────────────────────────────────────────
  async function loadBook(id) {
    try {
      console.log('[Reader] Loading book:', id);
      updateInfo('Загрузка...');
      
      // Локально
      let book = null;
      try {
        book = await Promise.race([
          electronReader.getBookFromLocal(id),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        if (book) console.log('[Reader] Loaded from local');
      } catch (e) {
        console.warn('[Reader] Local load failed:', e.message);
      }
      
      // С сервера
      if (!book) {
        console.log('[Reader] Loading from server...');
        updateInfo('Загрузка с сервера...');
        try {
          book = await Promise.race([
            electronReader.getBook(id),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
          ]);
        } catch (e) {
          console.error('[Reader] Server load failed:', e.message);
          showError('Ошибка загрузки: ' + e.message);
          return;
        }
      }
      
      if (!book || !book.pages || !Array.isArray(book.pages)) {
        showError('Книга не найдена');
        return;
      }
      
      pages = book.pages;
      totalPages = pages.length;
      bookTitle = book.title?.pretty || `#${id}`;
      bookTitleEl.textContent = bookTitle;
      
      console.log('[Reader] Book loaded, pages:', totalPages);
      
    renderPage();
    preloadNeighbors();
    // История сохранится автоматически при первой отрисовке
    
  } catch (error) {
    console.error('[Reader] Error:', error);
    showError('Ошибка загрузки: ' + error.message);
  }
}
  
  // ── Preload соседних изображений ───────────────────────────────────────
  function preloadNeighbors() {
    if (longlist) return; // В long-list mode все картинки загружаются через lazy
    
    // Preload ±2 страницы от текущей
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
  
  // ── Отрисовка страницы ─────────────────────────────────────────────────
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
    
    // Создаем figure с изображениями
    const figure = document.createElement('figure');
    figure.style.transform = `rotate(${angle}deg) scale(${zoom}) translate(${offset.x}px, ${offset.y}px)`;
    figure.style.transition = 'transform 0.2s ease-out';
    figure.style.display = 'flex';
    figure.style.gap = 'var(--spacing-sm)';
    figure.style.cursor = zoom > 1 ? 'grab' : 'default';
    
    if (dual && second) {
      figure.classList.add('dual');
    }
    
    // Первое изображение
    const img1 = document.createElement('img');
    img1.src = current.url;
    img1.alt = `Page ${idx + 1}`;
    img1.draggable = false;
    figure.appendChild(img1);
    
    // Второе изображение (dual mode)
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
    
    // Обновляем UI
    updateUI();
    
    // Сохраняем настройки при изменении режима
    saveSettings();
    
    // Обновляем историю
    updateReadHistory();
  }
  
  // ── Long-list mode ─────────────────────────────────────────────────────
  function renderLonglist() {
    stageEl.className = 'stage longlist';
    
    const container = document.createElement('div');
    container.className = 'longlist-container';
    
    // Отображаем все страницы
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
    
    // Скроллим до текущей страницы
    requestAnimationFrame(() => {
      const currentImg = container.querySelector(`img[alt="Page ${idx + 1}"]`);
      if (currentImg) {
        currentImg.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    
    updateUI();
    saveSettings();
  }
  
  // ── Навигация ──────────────────────────────────────────────────────────
  function next() {
    if (longlist) return;
    idx = Math.min(totalPages - 1, idx + (dual ? 2 : 1));
    zoom = 1;
    offset = { x: 0, y: 0 };
    renderPage();
    preloadNeighbors();
    updateReadHistory(); // Сохраняем историю при навигации
  }
  
  function prev() {
    if (longlist) return;
    idx = Math.max(0, idx - (dual ? 2 : 1));
    zoom = 1;
    offset = { x: 0, y: 0 };
    renderPage();
    preloadNeighbors();
    updateReadHistory(); // Сохраняем историю при навигации
  }
  
  // ── UI Updates ─────────────────────────────────────────────────────────
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
  
  // ── Инструменты ────────────────────────────────────────────────────────
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
  
  // ── Управление окном ───────────────────────────────────────────────────
  function setupWindowControls() {
    minimizeBtn.onclick = () => electronReader.minimize();
    maximizeBtn.onclick = () => electronReader.maximize();
    closeBtn.onclick = () => electronReader.close();
    
    // Навигационные кнопки
    prevBtn.onclick = () => prev();
    nextBtn.onclick = () => next();
    
    electronReader.onWindowMaximize(() => {
      maximizeBtn.textContent = '❐';
    });
    
    electronReader.onWindowUnmaximize(() => {
      maximizeBtn.textContent = '□';
    });
  }
  
  // ── Клавиатура ─────────────────────────────────────────────────────────
  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          electronReader.close();
        }
      }
      
      if (longlist) return; // В long-list режиме используем естественный скролл
      
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
  
  // ── Колесо мыши ────────────────────────────────────────────────────────
  function setupWheel() {
    document.addEventListener('wheel', (e) => {
      if (longlist) return; // естественный скролл
      
      // Ctrl + wheel = zoom
      if (e.ctrlKey) {
        e.preventDefault();
        const newZoom = Math.min(5, Math.max(0.5, zoom - e.deltaY * 0.001));
        zoom = newZoom;
        if (zoom <= 1) offset = { x: 0, y: 0 };
        renderPage();
        return;
      }
      
      // Обычный wheel = навигация
      if (wheelBlock) return;
      wheelBlock = true;
      e.deltaY > 0 ? next() : prev();
      setTimeout(() => (wheelBlock = false), 160);
    }, { passive: false });
  }
  
  // ── Drag (zoom > 1) ────────────────────────────────────────────────────
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
    
    // Клик на пустое пространство = закрыть окно
    stageEl.addEventListener('click', (e) => {
      if (e.target === stageEl && !longlist && zoom <= 1) {
        electronReader.close();
      }
    });
  }
  
  // ── Инициализация ──────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
