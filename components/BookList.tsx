import { Book } from "@/api/nhentai";
import { useFavHistory } from "@/hooks/useFavHistory";
import { useTheme } from "@/lib/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  ReactElement,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import BookCard from "./BookCard";

export interface GridConfig {
  numColumns: number;
  minColumnWidth?: number;
  paddingHorizontal?: number;
  columnGap?: number;
  cardDesign?: "classic" | "stable" | "image";
}

export interface BookListProps<T extends Book = Book> {
  data: T[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onEndReached?: () => void;
  ListEmptyComponent?: ReactNode;
  ListFooterComponent?: ReactElement | null;
  ListHeaderComponent?: ReactElement | null;
  isFavorite?: (id: number) => boolean;
  onToggleFavorite?: (id: number, next: boolean) => void;
  onPress?: (id: number) => void;
  renderItem?: ListRenderItem<T>;
  gridConfig?: {
    phonePortrait?: GridConfig;
    phoneLandscape?: GridConfig;
    tabletPortrait?: GridConfig;
    tabletLandscape?: GridConfig;
    default?: GridConfig;
  };
  horizontal?: boolean;
  background?: string;
  getScore?: (book: T) => number | undefined;
  columnWrapperStyle?: any;
  children?: ReactNode;
  cardDesign?: "classic" | "stable" | "image";
}

export default function BookList<T extends Book = Book>({
  data,
  loading,
  refreshing,
  onRefresh,
  onEndReached,
  ListEmptyComponent,
  ListFooterComponent,
  ListHeaderComponent,
  isFavorite,
  onToggleFavorite,
  onPress,
  renderItem,
  gridConfig,
  horizontal = false,
  background,
  getScore,
  columnWrapperStyle,
  children,
  cardDesign,
}: BookListProps<T>) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<T>>(null);
  const { width, height } = useWindowDimensions();

  const { favoritesSet, historyMap, toggleFavorite } = useFavHistory();

  const themeBg =
    background ??
    (colors as any).page ??
    (colors as any).surfaceElevated ??
    (colors as any).bg ??
    "#1C1C1C";

  const base = useMemo<GridConfig>(() => {
    const isPortrait = height > width;
    const isTablet = width > 600;
    return isTablet
      ? gridConfig?.tabletLandscape ??
          gridConfig?.tabletPortrait ??
          gridConfig?.default ?? { numColumns: 4 }
      : !isPortrait
      ? gridConfig?.phoneLandscape ?? gridConfig?.default ?? { numColumns: 3 }
      : gridConfig?.phonePortrait ?? gridConfig?.default ?? { numColumns: 2 };
  }, [width, height, gridConfig]);

  const chosenDesign: "classic" | "stable" | "image" =
    cardDesign ?? base.cardDesign ?? "classic";

  const {
    cols,
    cardWidth,
    columnGap,
    paddingHorizontal,
    uniqueData,
    estCardH,
  } = useMemo(() => {
    const padH = base.paddingHorizontal ?? 0;
    const gap = base.columnGap ?? 0;
    const minW = base.minColumnWidth ?? (chosenDesign === "image" ? 40 : 80);
    const avail = Math.max(0, width - padH * 2);

    const uniq = (() => {
      const seen = new Set<number>();
      return data.filter((b) =>
        seen.has(b.id) ? false : (seen.add(b.id), true)
      );
    })();

    if (horizontal) {
      const cap = width >= 1000 ? 260 : width >= 768 ? 240 : 210;
      const visible = Math.max(1, base.numColumns || 3);
      const w = (avail - gap * (visible - 1)) / visible;
      const cw = Math.min(Math.max(minW, w), cap);
      const estH =
        chosenDesign === "image"
          ? Math.round(cw * 1.05)
          : Math.round(cw * 1.35);
      return {
        cols: 1,
        cardWidth: cw,
        columnGap: gap,
        paddingHorizontal: padH,
        uniqueData: uniq,
        estCardH: estH,
      };
    }

    const maxCols = Math.max(
      1,
      Math.min(base.numColumns, Math.floor((avail + gap) / (minW + gap)))
    );
    const cw = (avail - gap * (maxCols - 1)) / maxCols;
    const estH =
      chosenDesign === "image" ? Math.round(cw * 1.05) : Math.round(cw * 1.35);

    return {
      cols: maxCols,
      cardWidth: cw,
      columnGap: gap,
      paddingHorizontal: padH,
      uniqueData: uniq,
      estCardH: estH,
    };
  }, [data, width, base, horizontal, chosenDesign]);

  const isSingleCol = !horizontal && cols === 1;
  const contentScale = isSingleCol ? 0.45 : 0.65;

  const [containerW, setContainerW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [scrollX, setScrollX] = useState(0);

  const fadeLeft = useRef(new Animated.Value(0)).current;
  const fadeRight = useRef(new Animated.Value(0)).current;

  const updateFades = (x: number, cW: number, vW: number) => {
    const canScroll = horizontal && cW > vW + 1;
    const toLeft = canScroll ? Math.min(1, x / 24) : 0;
    const toRight = canScroll ? Math.min(1, (cW - vW - x) / 24) : 0;
    Animated.timing(fadeLeft, {
      toValue: toLeft,
      duration: 160,
      useNativeDriver: true,
    }).start();
    Animated.timing(fadeRight, {
      toValue: toRight,
      duration: 160,
      useNativeDriver: true,
    }).start();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!horizontal) return;
    const x = e.nativeEvent.contentOffset.x;
    setScrollX(x);
    updateFades(x, contentW, containerW);
  };

  const renderCard: ListRenderItem<T> = useCallback(
    ({ item, index }) => {
      const isLastInRow = !horizontal && (index + 1) % cols === 0;
      const isLastHoriz = horizontal && index === uniqueData.length - 1;
      const favChecked =
        favoritesSet.has(item.id) || isFavorite?.(item.id) || false;

      return (
        <View
          style={{
            width: cardWidth,
            marginRight: horizontal
              ? isLastHoriz
                ? 0
                : columnGap
              : isLastInRow
              ? 0
              : columnGap,
            marginBottom: horizontal ? 0 : columnGap,
            ...(isSingleCol && { alignSelf: "center" }),
          }}
        >
          <BookCard
            design={chosenDesign}
            book={item}
            cardWidth={cardWidth}
            isSingleCol={isSingleCol}
            contentScale={contentScale}
            isFavorite={favChecked}
            onToggleFavorite={(id, next) => {
              toggleFavorite(id, next);
              onToggleFavorite?.(id, next);
            }}
            onPress={() => onPress?.(item.id)}
            score={getScore?.(item)}
            favoritesSet={favoritesSet}
            historyMap={historyMap}
            hydrateFromStorage={false}
          />
        </View>
      );
    },
    [
      horizontal,
      cols,
      uniqueData.length,
      favoritesSet,
      isFavorite,
      cardWidth,
      columnGap,
      isSingleCol,
      chosenDesign,
      contentScale,
      toggleFavorite,
      onToggleFavorite,
      onPress,
      getScore,
      historyMap,
    ]
  );

  const Empty = () => (
    <View style={styles.empty}>
      <Animated.Text style={styles.emptyText}>
        Ничего не найдено ¯\_(ツ)_/¯
      </Animated.Text>
    </View>
  );

  const listKey = horizontal
    ? `row-${Math.round(cardWidth)}-${chosenDesign}`
    : `cols-${cols}-${chosenDesign}`;

  const rowHeight = estCardH + (horizontal ? 0 : columnGap);
  const getItemLayout = !horizontal
    ? (_: any, index: number) => {
        const row = Math.floor(index / cols);
        const offset = paddingHorizontal / 2 + row * rowHeight;
        return { length: rowHeight, offset, index };
      }
    : (_: any, index: number) => ({
        length: cardWidth + columnGap,
        offset: (cardWidth + columnGap) * index,
        index,
      });

  const topPad = paddingHorizontal / 2;
  const bottomPad = paddingHorizontal / 2;
  const fadeWidth = 36;

  return (
    <View
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
      style={[
        horizontal ? styles.rowContainer : styles.container,
        { backgroundColor: themeBg, position: "relative" },
      ]}
    >
      {uniqueData.length === 0 && !loading ? (
        (ListEmptyComponent as ReactElement) ?? <Empty />
      ) : (
        <>
          <FlatList
            ref={listRef}
            key={listKey}
            horizontal={horizontal}
            showsHorizontalScrollIndicator={false}
            decelerationRate={horizontal ? "fast" : undefined}
            snapToAlignment={horizontal ? "start" : undefined}
            data={uniqueData}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem ?? renderCard}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={{
              paddingHorizontal,
              paddingTop: topPad,
              paddingBottom: bottomPad || undefined,
            }}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loading ? (
                <ActivityIndicator style={styles.loader} />
              ) : (
                ListFooterComponent
              )
            }
            ListHeaderComponent={ListHeaderComponent}
            numColumns={horizontal ? undefined : cols}
            columnWrapperStyle={
              !horizontal && cols > 1
                ? [{ justifyContent: "center" }, columnWrapperStyle]
                : undefined
            }
            getItemLayout={getItemLayout as any}
            onContentSizeChange={(w) => {
              setContentW(w);
              updateFades(scrollX, w, containerW);
            }}
            onScroll={horizontal ? onScroll : undefined}
            scrollEventThrottle={16}
            removeClippedSubviews
            windowSize={7}
            maxToRenderPerBatch={10}
            initialNumToRender={Math.min(12, uniqueData.length)}
            updateCellsBatchingPeriod={40}
          />

          {horizontal && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.fade,
                  {
                    left: 0,
                    width: fadeWidth,
                    top: 0,
                    bottom: 0,
                    opacity: fadeLeft,
                  },
                ]}
              >
                <LinearGradient
                  colors={[themeBg, "transparent"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.fade,
                  {
                    right: 0,
                    width: fadeWidth,
                    top: 0,
                    bottom: 0,
                    opacity: fadeRight,
                  },
                ]}
              >
                <LinearGradient
                  colors={["transparent", themeBg]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </>
          )}
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rowContainer: { flexGrow: 0 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#888", fontSize: 16 },
  loader: { marginVertical: 16 },
  fade: { position: "absolute", zIndex: 5 },
});
