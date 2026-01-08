import ExpoImage from "@/components/ExpoImageCompat";
import { BookPage, getBook, loadBookFromLocal } from "@/api/nhentai";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Feather, Ionicons } from "@expo/vector-icons";
import { windowControls, isElectron } from "@/electron/bridge";

// Обходное решение для проблемы с reanimated в Electron
// Мокируем makeShareable если он недоступен - делаем это до импортов
if (typeof window !== 'undefined' && Platform.OS === 'web') {
  // Используем Object.defineProperty для добавления makeShareable в reanimated
  // до того, как он будет использован
  const mockMakeShareable = (value: any) => value;
  
  // Перехватываем require для react-native-reanimated
  const originalRequire = (window as any).require || require;
  
  try {
    // Пытаемся получить reanimated модуль
    let reanimatedModule: any;
    
    try {
      reanimatedModule = originalRequire('react-native-reanimated');
    } catch (e) {
      // Если require не работает, пробуем через require.cache
      const cacheKey = Object.keys(require.cache || {}).find(
        (key) => key.includes('react-native-reanimated')
      );
      if (cacheKey) {
        reanimatedModule = require.cache[cacheKey]?.exports;
      }
    }
    
    // Добавляем makeShareable если его нет
    if (reanimatedModule) {
      if (typeof reanimatedModule.makeShareable === 'undefined') {
        Object.defineProperty(reanimatedModule, 'makeShareable', {
          value: mockMakeShareable,
          writable: true,
          configurable: true,
        });
      }
      
      // Также для default экспорта
      const defaultExport = reanimatedModule?.default || reanimatedModule;
      if (defaultExport && typeof defaultExport.makeShareable === 'undefined') {
        Object.defineProperty(defaultExport, 'makeShareable', {
          value: mockMakeShareable,
          writable: true,
          configurable: true,
        });
      }
      
      // Добавляем в глобальный объект для доступа из других модулей
      (window as any).__REANIMATED_MOCKED__ = true;
    }
  } catch (e) {
    // Игнорируем ошибки
    console.warn('[ReadElectron] Reanimated mock setup failed:', e);
  }
  
  // Также добавляем глобальный мок для случаев, когда reanimated загружается позже
  if (typeof (window as any).__REANIMATED_MAKE_SHAREABLE_MOCK__ === 'undefined') {
    (window as any).__REANIMATED_MAKE_SHAREABLE_MOCK__ = mockMakeShareable;
  }
}

export default function ReadElectronScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const params = useLocalSearchParams<{
    bookId?: string;
    id?: string;
    page?: string;
  }>();
  
  // Поддерживаем оба варианта параметров: bookId и id
  const bookId = Number(params.bookId || params.id);
  const initialPage = params.page ? Number(params.page) : 1;
  
  const { width: W, height: H } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState(initialPage - 1);
  const [pages, setPages] = useState<BookPage[]>([]);
  const [bookTitle, setBookTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showUI, setShowUI] = useState(true);
  
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Загрузка данных книги (не блокируем открытие окна)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const local = await loadBookFromLocal(bookId);
        const book = local || await getBook(bookId);
        
        if (cancelled) return;
        
        if (book) {
          setPages(book.pages);
          setBookTitle(book.title?.pretty || `#${bookId}`);
          setCurrentPage(Math.max(0, Math.min(initialPage - 1, book.pages.length - 1)));
        }
      } catch (error) {
        console.error("[ReadElectron] Error loading book:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    
    return () => {
      cancelled = true;
    };
  }, [bookId, initialPage]);
  
  // Автоскрытие UI через 2 секунды (как в Telegram)
  const resetUITimeout = useCallback(() => {
    if (uiTimeoutRef.current) {
      clearTimeout(uiTimeoutRef.current);
    }
    setShowUI(true);
    uiTimeoutRef.current = setTimeout(() => {
      setShowUI(false);
    }, 2000);
  }, []);
  
  useEffect(() => {
    resetUITimeout();
    return () => {
      if (uiTimeoutRef.current) {
        clearTimeout(uiTimeoutRef.current);
      }
    };
  }, [resetUITimeout]);
  
  // Показ UI при движении мыши (как в Telegram)
  useEffect(() => {
    if (!isElectron() || Platform.OS !== 'web') return;
    
    let mouseMoveTimer: NodeJS.Timeout | null = null;
    
    const handleMouseMove = () => {
      // Показываем UI при движении мыши
      setShowUI(true);
      resetUITimeout();
      
      // Троттлинг для оптимизации
      if (mouseMoveTimer) {
        clearTimeout(mouseMoveTimer);
      }
      mouseMoveTimer = setTimeout(() => {
        mouseMoveTimer = null;
      }, 100);
    };
    
    const handleClick = (e: MouseEvent) => {
      // Скрываем UI при клике на пустое пространство (не на кнопки или UI элементы)
      const target = e.target as HTMLElement;
      const isUIElement = target.closest('[data-ui-element]');
      const isButton = target.closest('button') || target.closest('[role="button"]');
      
      if (!isUIElement && !isButton) {
        setShowUI(false);
        if (uiTimeoutRef.current) {
          clearTimeout(uiTimeoutRef.current);
        }
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      if (mouseMoveTimer) {
        clearTimeout(mouseMoveTimer);
      }
    };
  }, [resetUITimeout]);
  
  // Добавляем draggable хедер через прямое изменение DOM (для Electron)
  useEffect(() => {
    if (!isElectron() || Platform.OS !== 'web') return;
    
    const topBarElement = document.querySelector('[data-top-bar]') as HTMLElement;
    const topBarLeftElement = document.querySelector('[data-top-bar-left]') as HTMLElement;
    const topBarTitleElement = document.querySelector('[data-top-bar-title]') as HTMLElement;
    const topBarButtons = document.querySelectorAll('[data-top-bar-button]');
    
    if (topBarElement && showUI) {
      // Делаем хедер draggable
      topBarElement.style.webkitAppRegion = 'drag';
      topBarElement.style.appRegion = 'drag';
      
      // Левая часть тоже draggable
      if (topBarLeftElement) {
        topBarLeftElement.style.webkitAppRegion = 'drag';
        topBarLeftElement.style.appRegion = 'drag';
      }
      
      // Заголовок тоже draggable
      if (topBarTitleElement) {
        topBarTitleElement.style.webkitAppRegion = 'drag';
        topBarTitleElement.style.appRegion = 'drag';
      }
      
      // Кнопки не должны быть draggable
      topBarButtons.forEach((btn) => {
        (btn as HTMLElement).style.webkitAppRegion = 'no-drag';
        (btn as HTMLElement).style.appRegion = 'no-drag';
      });
    }
    
    return () => {
      if (topBarElement) {
        topBarElement.style.webkitAppRegion = '';
        topBarElement.style.appRegion = '';
      }
      if (topBarLeftElement) {
        topBarLeftElement.style.webkitAppRegion = '';
        topBarLeftElement.style.appRegion = '';
      }
      if (topBarTitleElement) {
        topBarTitleElement.style.webkitAppRegion = '';
        topBarTitleElement.style.appRegion = '';
      }
      topBarButtons.forEach((btn) => {
        (btn as HTMLElement).style.webkitAppRegion = '';
        (btn as HTMLElement).style.appRegion = '';
      });
    };
  }, [showUI]);
  
  const currentPageData = pages[currentPage];
  const totalPages = pages.length;
  
  const goToPage = useCallback((pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex < pages.length) {
      setCurrentPage(pageIndex);
      resetUITimeout();
    }
  }, [pages.length, resetUITimeout]);
  
  const goPrev = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);
  
  const goNext = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);
  
  const toggleFullscreen = useCallback(async () => {
    if (isElectron() && Platform.OS === 'web') {
      const element = document.documentElement;
      if (!document.fullscreenElement) {
        await element.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  }, [isFullscreen]);
  
  const handleClose = useCallback(async () => {
    if (isElectron()) {
      await windowControls.close();
    }
  }, []);
  
  // Клавиатурная навигация и отслеживание полноэкранного режима
  useEffect(() => {
    if (!isElectron() || Platform.OS !== 'web') return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          handleClose();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    window.addEventListener('keydown', handleKeyPress);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [goPrev, goNext, handleClose, toggleFullscreen]);
  
  // Thumbnails для нижней панели (показываем текущую и соседние)
  const thumbnails = useMemo(() => {
    const thumbCount = 5;
    const start = Math.max(0, currentPage - Math.floor(thumbCount / 2));
    const end = Math.min(pages.length, start + thumbCount);
    return pages.slice(start, end).map((page, idx) => ({
      page,
      index: start + idx,
      isActive: start + idx === currentPage,
    }));
  }, [pages, currentPage]);
  
  if (!loading && !currentPageData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.text }}>Page not found</Text>
      </View>
    );
  }
  
  return (
    <View 
      style={[styles.container, { backgroundColor: '#000000' }]}
      onTouchStart={resetUITimeout}
    >
      {/* Основное изображение */}
      <View style={styles.imageContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#ffffff" />
        ) : (
          <ExpoImage
            source={{ uri: currentPageData.url }}
            style={styles.mainImage}
            contentFit="contain"
            cachePolicy="disk"
            priority="high"
          />
        )}
      </View>
      
      {/* Левая навигация */}
      {!loading && currentPage > 0 && (
        <Pressable
          style={[styles.navButton, styles.navButtonLeft]}
          onPress={goPrev}
          data-ui-element="true"
        >
          <Feather name="chevron-left" size={32} color="#ffffff" />
        </Pressable>
      )}
      
      {/* Правая навигация */}
      {!loading && currentPage < totalPages - 1 && (
        <Pressable
          style={[styles.navButton, styles.navButtonRight]}
          onPress={goNext}
          data-ui-element="true"
        >
          <Feather name="chevron-right" size={32} color="#ffffff" />
        </Pressable>
      )}
      
      {/* Верхняя панель (draggable хедер с заголовком и кнопками управления) */}
      {showUI && (
        <View 
          style={[styles.topBar, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}
          data-ui-element="true"
          data-top-bar="true"
        >
          <View 
            style={styles.topBarLeft}
            data-top-bar-left="true"
          >
            <Pressable 
              onPress={handleClose} 
              style={styles.closeButton}
              data-ui-element="true"
              data-top-bar-button="true"
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
            <Text 
              style={styles.title} 
              numberOfLines={1}
              data-top-bar-title="true"
            >
              {bookTitle}
            </Text>
          </View>
          <View style={styles.topBarRight}>
            <Pressable 
              onPress={toggleFullscreen} 
              style={styles.iconButton}
              data-ui-element="true"
              data-top-bar-button="true"
            >
              <Ionicons 
                name={isFullscreen ? "contract" : "expand"} 
                size={24} 
                color="#ffffff" 
              />
            </Pressable>
          </View>
        </View>
      )}
      
      {/* Нижняя панель (информация и thumbnails) */}
      {showUI && !loading && (
        <View 
          style={[styles.bottomBar, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}
          data-ui-element="true"
        >
          {/* Информация о странице */}
          <View style={styles.pageInfo}>
            <Text style={styles.pageInfoText}>
              {t("read.page") || "Page"} {currentPage + 1} {t("read.of") || "of"} {totalPages}
            </Text>
          </View>
          
          {/* Thumbnails */}
          {thumbnails.length > 0 && (
            <View style={styles.thumbnailsContainer}>
              {thumbnails.map(({ page, index, isActive }) => (
                <Pressable
                  key={index}
                  onPress={() => goToPage(index)}
                  style={[
                    styles.thumbnail,
                    isActive && styles.thumbnailActive,
                  ]}
                  data-ui-element="true"
                >
                  <ExpoImage
                    source={{ uri: page.urlThumb || page.url }}
                    style={styles.thumbnailImage}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 16,
    zIndex: 20,
  },
  pageInfo: {
    marginBottom: 12,
    alignItems: 'center',
  },
  pageInfoText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  thumbnailsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: '#ffffff',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});
