import { Book, getRandomBook } from "@/api/nhentai";
import { useFilterTags } from "@/context/TagFilterContext";
import { useGridConfig } from "@/hooks/useGridConfig";
import { useTheme } from "@/lib/ThemeContext";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { updateReadHistory } from "@/app/read";

import { getMe } from "@/api/nhentaiOnline";
import { useBookData } from "@/hooks/book/useBookData";
import { useColumns } from "@/hooks/book/useColumns";
import { useDownload } from "@/hooks/book/useDownload";
import { useFab } from "@/hooks/book/useFab";
import { useFavorites } from "@/hooks/book/useFavorites";
import { useRelatedComments } from "@/hooks/book/useRelatedComments";
import { useWindowLayout } from "@/hooks/book/useWindowLayout";
import { openReaderWindow, isElectron } from "@/electron/bridge";

import Footer from "@/components/book/Footer";
import Hero from "@/components/book/Hero";
import PageItem, { GAP } from "@/components/book/PageItem";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function BookScreen() {
  const { id, random } = useLocalSearchParams<{
    id: string;
    random?: string;
  }>();
  const [myUserId, setMyUserId] = useState<number | undefined>(undefined);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | undefined>(undefined);
  const [myUsername, setMyUsername] = useState<string | undefined>(undefined);

  const idNum = Number(id);
  const fromRandom = random === "1";

  const router = useRouter();
  const { colors } = useTheme();
  const baseGrid = useGridConfig();

  const { t } = useI18n();

  const { filters, cycle } = useFilterTags();

  const { win, wide, innerPadding } = useWindowLayout();
  const { book, setBook, local, setLocal } = useBookData(idNum);
  const {
    related,
    relLoading,
    refetchRelated,
    allComments,
    visibleCount,
    setVisibleCount,
    cmtLoading,
    refetchComments,
  } = useRelatedComments(book);
  const { favorites, toggleFav, liked, toggleLike } = useFavorites(idNum);
  const { dl, pr, handleDownloadOrDelete, cancel } = useDownload(
    book,
    local,
    setLocal,
    setBook
  );

  const { cols, cycleCols, listRef, setScrollY } = useColumns(wide);

  const {
    fabScale,
    onScroll: onScrollFab,
    scrollTop,
    scrollToComments,
    handleFabPress,
    scrollDirection,
    listRef: fabListRef,
    setCommentSectionOffset,
  } = useFab();

  const [listW, setListW] = useState(win.w);
  const [rndLoading, setRndLoading] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const scrollPositionRef = useRef<number>(0);
  const prevDataLengthRef = useRef<number>(0);
  const prevColsRef = useRef<number>(cols);
  const lastSavedPageRef = useRef<number | null>(null);
  const historyUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Callback для отслеживания видимых элементов - выносим наружу
  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (!book?.id || !book?.pages || viewableItems.length === 0) return;
    
    // Находим первую видимую страницу
    const firstVisible = viewableItems[0];
    if (!firstVisible?.item) return;
    
    const currentPage = firstVisible.item.page;
    
    // Сохраняем историю с debounce (максимум раз в 2 секунды)
    if (lastSavedPageRef.current !== currentPage) {
      if (historyUpdateTimeoutRef.current) {
        clearTimeout(historyUpdateTimeoutRef.current);
      }
      
      historyUpdateTimeoutRef.current = setTimeout(() => {
        updateReadHistory(book.id, currentPage, book.pages.length);
        lastSavedPageRef.current = currentPage;
        console.log('[Book] History saved:', book.id, currentPage, book.pages.length);
      }, 2000) as any;
    }
  }, [book?.id, book?.pages]);
  
  // Отслеживаем изменение размера окна для адаптивной сетки
  useEffect(() => {
    setListW(win.w);
  }, [win.w]);

  // Сохраняем позицию прокрутки при изменении сетки
  useEffect(() => {
    if (prevColsRef.current !== cols && scrollPositionRef.current > 0) {
      // При изменении количества колонок сохраняем позицию
      const currentScrollY = scrollPositionRef.current;
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (listRef.current && currentScrollY > 0) {
            listRef.current.scrollToOffset({ offset: currentScrollY, animated: false });
          }
        }, 150);
      });
    }
    prevColsRef.current = cols;
  }, [cols]);

  const modeOf = useCallback(
    (t: { type: string; name: string }): "include" | "exclude" | undefined => {
      const m = filters.find(
        (f) => f.type === t.type && f.name === t.name
      )?.mode;
      return m === "include" || m === "exclude" ? m : undefined;
    },
    [filters]
  );

  useEffect(() => {
    if (book?.title?.pretty) {
      router.setParams({ title: book.title.pretty });
    }
  }, [book?.title?.pretty]);

  useEffect(() => {
    let alive = true;
    getMe()
      .then((me) => {
        if (!alive) return;
        setMyUserId(me?.id ?? undefined);
        setMyAvatarUrl(me?.avatar_url ?? undefined);
        setMyUsername(me?.username ?? undefined);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const headerEl = useMemo(() => {
    if (!book) return null;
    return (
      <Hero
        book={book}
        containerW={listW || win.w}
        pad={innerPadding}
        wide={wide}
        cols={cols}
        cycleCols={cycleCols}
        liked={liked}
        toggleLike={toggleLike}
        dl={dl}
        pr={pr}
        local={local}
        handleDownloadOrDelete={handleDownloadOrDelete}
        modeOf={modeOf}
        onTagPress={(name: any) =>
          router.push({
            pathname: "/explore",
            params: { query: name, solo: "1" },
          })
        }
        win={win}
        innerPadding={innerPadding}
        cycle={cycle}
        cancel={cancel}
      />
    );
  }, [
    book,
    listW,
    win,
    innerPadding,
    wide,
    cols,
    liked,
    dl,
    pr,
    local,
    handleDownloadOrDelete,
    modeOf,
    router,
    cycle,
  ]);

  const handleCommentSectionLayout = useCallback((offset: number) => {
    setCommentSectionOffset(offset);
  }, [setCommentSectionOffset]);

  const horizPad = Math.max(0, innerPadding - GAP / 2);

  // Вычисляем ограниченное количество элементов для отображения (кратное колонкам, ближе к 24)
  const limitedPages = useMemo(() => {
    if (!book?.pages || showAllPages) {
      return book?.pages || [];
    }
    
    const targetCount = 24;
    // Вычисляем количество строк для достижения примерно 24 элементов
    const rows = Math.floor(targetCount / cols);
    // Округляем до ближайшего кратного колонкам
    const limitedCount = rows * cols;
    
    return book.pages.slice(0, limitedCount);
  }, [book?.pages, cols, showAllPages]);

  // Сохраняем позицию прокрутки при изменении данных
  useEffect(() => {
    if (showAllPages && prevDataLengthRef.current > 0) {
      // При показе всех страниц сохраняем позицию
      const currentScrollY = scrollPositionRef.current;
      // Небольшая задержка для завершения рендеринга
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (listRef.current && currentScrollY > 0) {
            listRef.current.scrollToOffset({ offset: currentScrollY, animated: false });
          }
        }, 100);
      });
    }
    prevDataLengthRef.current = limitedPages.length;
  }, [showAllPages, limitedPages.length]);

  // Компонент кнопки "Показать всё"
  const showAllButton = useMemo(() => {
    if (showAllPages || !book?.pages || limitedPages.length >= book.pages.length) {
      return null;
    }
    
    return (
      <View style={{ paddingVertical: 20, paddingHorizontal: horizPad, alignItems: 'center' }}>
        <Pressable
          onPress={() => {
            setShowAllPages(true);
          }}
          android_ripple={{ color: "#ffffff22", borderless: false }}
          style={({ pressed }) => [
            {
              backgroundColor: colors.accent,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
              minWidth: 120,
              alignItems: 'center',
              justifyContent: 'center',
            },
            pressed &&
              (Platform.select({
                android: { opacity: 0.96, transform: [{ scale: 0.995 }] },
                ios: { opacity: 0.85 },
              }) as any),
          ]}
        >
          <Text style={{ color: colors.bg, fontSize: 14, fontWeight: "600" }}>
            {t("book.showAll") || "Показать всё"}
          </Text>
        </Pressable>
      </View>
    );
  }, [showAllPages, book?.pages, limitedPages.length, horizPad, colors, t]);

  const footerEl = useMemo(() => {
    return (
      <Footer
        galleryId={book?.id ?? idNum}
        related={related}
        relLoading={relLoading}
        refetchRelated={refetchRelated}
        favorites={favorites}
        toggleFav={toggleFav}
        baseGrid={baseGrid}
        allComments={allComments}
        visibleCount={visibleCount}
        setVisibleCount={setVisibleCount}
        cmtLoading={cmtLoading}
        innerPadding={innerPadding}
        myUserId={myUserId}
        myAvatarUrl={myAvatarUrl}
        myUsername={myUsername}
        refetchComments={refetchComments}
        onCommentSectionLayout={handleCommentSectionLayout}
      />
    );
  }, [
    related,
    relLoading,
    refetchRelated,
    favorites,
    toggleFav,
    baseGrid,
    allComments,
    visibleCount,
    setVisibleCount,
    cmtLoading,
    innerPadding,
    myUserId,
    myAvatarUrl,
    myUsername,
    book?.id,
    idNum,
    refetchComments,
    handleCommentSectionLayout,
  ]);

  // Используем useMemo для пересчета itemW при изменении размера окна или количества колонок
  // Это обеспечивает адаптивную сетку, которая пересчитывается при изменении размера окна
  const itemW = useMemo(() => {
    // Получаем доступную ширину с учетом отступов
    const availableWidth = Math.max(100, (listW || win.w) - 2 * horizPad);
    
    // Вычисляем ширину элемента: (доступная ширина - зазоры между элементами) / количество колонок
    // Для 1 колонки: вся доступная ширина
    // Для нескольких колонок: (ширина - (колонки-1) * GAP) / колонки
    if (cols === 1) {
      return availableWidth;
    }
    
    const calculatedWidth = Math.floor((availableWidth - (cols - 1) * GAP) / cols);
    
    // Минимальная ширина 100px для читаемости
    // Максимальная - не больше доступной ширины
    return Math.max(100, Math.min(calculatedWidth, availableWidth));
  }, [cols, listW, win.w, horizPad]);

  // Функция для вычисления высоты элемента на основе его размеров
  // Это позволяет заранее знать размеры до загрузки изображений
  const getItemHeight = useCallback((page: Book["pages"][number]) => {
    const aspectRatio = page.width / page.height;
    const isVertical = page.height > page.width;
    const isSuperLong = isVertical && page.height > page.width * 3;
    const maxHeight = isSuperLong ? itemW * 2.5 : undefined;
    const imageHeight = maxHeight
      ? Math.min(itemW / aspectRatio, maxHeight)
      : itemW / aspectRatio;
    
    // Высота контейнера = высота изображения + номер страницы (12px) + отступы (4px + GAP)
    return imageHeight + 12 + 4 + GAP;
  }, [itemW]);

  // Вычисляем высоты всех элементов для оптимизации фона (showBackground)
  const itemHeights = useMemo(() => {
    if (!book?.pages) return [];
    return book.pages.map(page => getItemHeight(page));
  }, [book?.pages, getItemHeight]);

  // getItemLayout убран, так как он вызывает проблемы с пропадающими элементами при использовании numColumns
  // Фиксированные размеры контейнеров в PageItem обеспечивают стабильность прокрутки

  // Вычисляем высоты изображений (без учета отступов) для оптимизации фона
  // Используем limitedPages для соответствия с отображаемыми данными
  const imageHeights = useMemo(() => {
    if (!limitedPages.length) return [];
    return limitedPages.map(page => {
      const aspectRatio = page.width / page.height;
      const isVertical = page.height > page.width;
      const isSuperLong = isVertical && page.height > page.width * 3;
      const maxHeight = isSuperLong ? itemW * 2.5 : undefined;
      return maxHeight
        ? Math.min(itemW / aspectRatio, maxHeight)
        : itemW / aspectRatio;
    });
  }, [limitedPages, itemW]);

  const renderItem = useCallback(
    ({ item, index }: { item: Book["pages"][number]; index: number }) => {
      const onPress = async () => {
        // Для Electron открываем отдельное окно, для Android - обычная навигация
        if (isElectron() && book?.id) {
          await openReaderWindow(book.id, item.page);
        } else {
          router.push({
            pathname: "/read",
            params: { id: String(book?.id), page: String(item.page) },
          });
        }
      };

      // Определяем, нужно ли показывать фон для оптимизации
      let showBackground = false;
      
      if (cols > 1) {
        // Для сетки проверяем размеры элементов в строке
        const rowIndex = Math.floor(index / cols);
        const rowStart = rowIndex * cols;
        const rowEnd = Math.min(rowStart + cols, imageHeights.length);
        
        // Получаем высоты всех элементов в строке
        const rowHeights = imageHeights.slice(rowStart, rowEnd);
        if (rowHeights.length > 0) {
          const minHeight = Math.min(...rowHeights);
          const maxHeight = Math.max(...rowHeights);
          const currentHeight = imageHeights[index];
          
          // Если все элементы одинакового размера (разница < 5px) - не показываем фон
          const allSameSize = Math.abs(maxHeight - minHeight) < 5;
          
          if (!allSameSize) {
            // Если размеры разные, показываем фон только у маленьких элементов
            // У больших элементов убираем фон для оптимизации
            const isSmaller = currentHeight < maxHeight - 5; // Текущий элемент меньше максимального
            showBackground = isSmaller;
          }
          // Если все одинаковые - showBackground остается false
        }
      } else {
        // Для одной колонки показываем фон только для супер длинных
        const aspectRatio = item.width / item.height;
        const isVertical = item.height > item.width;
        const isSuperLong = isVertical && item.height > item.width * 3;
        showBackground = isSuperLong;
      }

      return (
        <PageItem
          page={item}
          itemW={itemW}
          cols={cols}
          metaColor={colors.metaText}
          onPress={onPress}
          showBackground={showBackground}
        />
      );
    },
    [book?.id, cols, itemW, colors.metaText, router, imageHeights]
  );

  // Обработчик изменения размера контента для обновления позиции комментариев
  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    // Позиция комментариев примерно равна высоте контента минус высота footer
    // Это приблизительно, но работает для прокрутки к комментариям
    if (contentHeight > 0) {
      // Комментарии находятся в footer, который добавляется в конец списка
      // Используем примерно 75-80% контента как позицию начала комментариев
      // (header + страницы + related books + секция комментариев)
      const estimatedCommentOffset = contentHeight * 0.75;
      setCommentSectionOffset(estimatedCommentOffset);
    }
  }, [setCommentSectionOffset]);

  const goRandomAgain = useCallback(async () => {
    if (rndLoading) return;
    try {
      setRndLoading(true);
      const b = await getRandomBook();
      router.replace({
        pathname: "/book/[id]",
        params: { id: String(b.id), title: b.title.pretty, random: "1" },
      });
    } finally {
      setRndLoading(false);
    }
  }, [rndLoading, router]);

  if (!book) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bg }}
      onLayout={(e) => {
        const newWidth = e.nativeEvent.layout.width;
        if (Math.abs(newWidth - listW) > 1) {
          setListW(newWidth);
        }
      }}
    >
      <FlatList
        ref={(ref) => {
          (listRef as any).current = ref;
          (fabListRef as any).current = ref;
        }}
        data={limitedPages}
        key={`book-${book?.id}-${cols}`}
        numColumns={cols}
        {...(Platform.OS !== 'android' && {
          maintainVisibleContentPosition: {
            minIndexForVisible: 0,
            autoscrollToTopThreshold: null,
          },
        })}
        keyExtractor={(p) => String(p.page)}
        renderItem={renderItem}
        onScroll={(e) => {
          onScrollFab(e);
          setScrollY(e.nativeEvent.contentOffset.y);
        }}
        onContentSizeChange={(w, h) => {
          handleContentSizeChange(w, h);
          // При изменении размера контента обновляем позицию комментариев
          if (h > 0) {
            setCommentSectionOffset(h * 0.8);
          }
        }}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50, // Элемент считается видимым если видно 50%
          minimumViewTime: 500, // Минимум 500ms видимости
        }}
        onLayout={(e) => {
          // Обновляем ширину при изменении layout для адаптивности
          const newWidth = e.nativeEvent.layout.width;
          if (Math.abs(newWidth - listW) > 1) {
            setListW(newWidth);
          }
        }}
        scrollEventThrottle={16}
        columnWrapperStyle={cols > 1 ? { 
          alignItems: "stretch", // Растягиваем элементы до высоты самого высокого в строке
          paddingHorizontal: 0,
          justifyContent: 'center', // Центрируем элементы по горизонтали, если строка не полная
        } : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 40,
          paddingHorizontal: horizPad,
          // Убираем flexGrow чтобы контент не растягивался
        }}
        ListHeaderComponent={headerEl}
        ListFooterComponent={
          <>
            {showAllButton}
            {footerEl}
          </>
        }
        removeClippedSubviews={false}
        initialNumToRender={cols === 1 ? 10 : 24}
        maxToRenderPerBatch={cols === 1 ? 10 : 24}
        updateCellsBatchingPeriod={50}
        windowSize={11}
      />

      <Animated.View
        style={[
          styles.fab,
          { transform: [{ scale: fabScale }], opacity: fabScale },
        ]}
      >
        <Pressable
          onPress={handleFabPress}
          style={[styles.fabBtn, { backgroundColor: colors.accent }]}
        >
          <Ionicons 
            name={scrollDirection === "down" ? "arrow-down" : "arrow-up"} 
            size={24} 
            color={colors.bg} 
          />
        </Pressable>
      </Animated.View>

      {fromRandom && (
        <View style={[styles.tryWrap, { bottom: 40 }]}>
          <View style={styles.tryRounded}>
            <Pressable
              disabled={rndLoading}
              onPress={goRandomAgain}
              android_ripple={{ color: "#ffffff22", borderless: false }}
              style={({ pressed }) => [
                styles.tryBtn,
                { backgroundColor: colors.accent },
                pressed &&
                  (Platform.select({
                    android: { opacity: 0.96, transform: [{ scale: 0.995 }] },
                    ios: { opacity: 0.85 },
                  }) as any),
              ]}
            >
              {rndLoading ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <>
                  <Feather name="shuffle" size={16} color={colors.bg} />
                  <Text style={[styles.tryTxt, { color: colors.bg }]}>
                    {t("book.fromRandomCta")}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const FAB_SIZE = 48;
const styles = StyleSheet.create({
  fab: { position: "absolute", right: 16, bottom: 36 },
  fabBtn: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },

  tryWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  tryRounded: {
    borderRadius: 12,
    overflow: "hidden",
  },
  tryBtn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 4,
  },
  tryTxt: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
});
