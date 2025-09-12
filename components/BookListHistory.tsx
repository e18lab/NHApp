import { Book } from "@/api/nhentai";
import { format, Locale } from "date-fns";
import { enUS, ja, ru, zhCN } from "date-fns/locale";
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
  RefreshControl,
  SectionList,
  SectionListData,
  SectionListRenderItem,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useFavHistory } from "@/hooks/useFavHistory";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import BookCard from "./BookCard";

export type ReadHistoryEntry = [number, number, number, number];
export const READ_HISTORY_KEY = "readHistory";

export interface GridConfig {
  numColumns: number;
  minColumnWidth?: number;
  paddingHorizontal?: number;
  columnGap?: number;
  cardDesign?: "classic" | "stable" | "image";
}

export interface BookListHistoryProps<T extends Book = Book> {
  data: T[];
  historyIndex: Record<number, ReadHistoryEntry>;
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
  gridConfig?: {
    phonePortrait?: GridConfig;
    phoneLandscape?: GridConfig;
    tabletPortrait?: GridConfig;
    tabletLandscape?: GridConfig;
    default?: GridConfig;
  };
  getScore?: (book: T) => number | undefined;
  children?: ReactNode;
  cardDesign?: "classic" | "stable" | "image";
}

type RowItem<T extends Book> = {
  book: T;
  ts: number;
  timeHHmm: string;
};

type SectionRow<T extends Book> = RowItem<T>[];

type SectionShape<T extends Book> = {
  title: string;
  key: string;
  data: SectionRow<T>[];
};

export default function BookListHistory<T extends Book = Book>({
  data,
  historyIndex,
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
  gridConfig,
  getScore,
  children,
  cardDesign,
}: BookListHistoryProps<T>) {
  const { colors } = useTheme();
  const { t, resolved } = useI18n();
  const listRef = useRef<SectionList<SectionRow<T>>>(null);
  const { width, height } = useWindowDimensions();

  const { favoritesSet, toggleFavorite } = useFavHistory();

  const historyMap = useMemo(() => {
    const m: Record<number, { current: number; total: number; ts: number }> =
      {};
    for (const [idStr, entry] of Object.entries(historyIndex || {})) {
      const id = Number(idStr);
      const cur = Math.max(0, Math.floor(Number(entry?.[1]) || 0));
      const total = Math.max(1, Math.floor(Number(entry?.[2]) || 1));
      const ts = Math.floor(Number(entry?.[3]) || 0);
      m[id] = { current: Math.min(cur, total - 1), total, ts };
    }
    return m;
  }, [historyIndex]);

  const { dateLocale, timePattern } = useMemo(() => {
    const loc: Locale =
      resolved === "ru"
        ? ru
        : resolved === "zh"
        ? zhCN
        : resolved === "ja"
        ? ja
        : enUS;
    const timeFmt = resolved === "en" ? "h:mm a" : "HH:mm";
    return { dateLocale: loc, timePattern: timeFmt };
  }, [resolved]);

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

  const layout = useMemo(() => {
    const padH = base.paddingHorizontal ?? 0;
    const gap = base.columnGap ?? 0;
    const chosenDesign: "classic" | "stable" | "image" =
      cardDesign ?? base.cardDesign ?? "classic";
    const minW = base.minColumnWidth ?? (chosenDesign === "image" ? 40 : 80);
    const avail = width - padH * 2;
    const maxCols = Math.max(
      1,
      Math.min(base.numColumns, Math.floor((avail + gap) / (minW + gap)))
    );
    const cardW = (avail - gap * (maxCols - 1)) / maxCols;
    const estH =
      chosenDesign === "image"
        ? Math.round(cardW * 1.05)
        : Math.round(cardW * 1.35);
    return {
      cols: maxCols,
      cardWidth: cardW,
      columnGap: gap,
      paddingHorizontal: padH,
      estCardH: estH,
    };
  }, [width, base, cardDesign]);

  const { cols, cardWidth, columnGap, paddingHorizontal, estCardH } = layout;
  const isSingleCol = cols === 1;
  const contentScale = isSingleCol ? 0.45 : 0.65;
  const chosenDesign: "classic" | "stable" | "image" =
    cardDesign ?? base.cardDesign ?? "classic";

  const sections = useMemo<SectionShape<T>[]>(() => {
    const enriched = data
      .map((b) => {
        const entry = historyIndex[b.id];
        if (!entry) return null;
        const ts = Number(entry[3]) || 0;
        if (!ts) return null;
        const d = new Date(ts * 1000);
        return {
          book: b,
          ts,
          dateKey: format(d, "yyyy-MM-dd"),
          dateTitle: format(d, "d MMM yyyy", { locale: dateLocale }),
          timeHHmm: format(d, timePattern, { locale: dateLocale }),
        };
      })
      .filter(Boolean) as {
      book: T;
      ts: number;
      dateKey: string;
      dateTitle: string;
      timeHHmm: string;
    }[];

    enriched.sort((a, b) => b.ts - a.ts);

    const byDate = new Map<string, { title: string; items: RowItem<T>[] }>();
    for (const it of enriched) {
      if (!byDate.has(it.dateKey))
        byDate.set(it.dateKey, { title: it.dateTitle, items: [] });
      byDate
        .get(it.dateKey)!
        .items.push({ book: it.book, ts: it.ts, timeHHmm: it.timeHHmm });
    }

    const result: SectionShape<T>[] = [];
    for (const [key, { title, items }] of byDate) {
      const rows: SectionRow<T>[] = [];
      for (let i = 0; i < items.length; i += cols)
        rows.push(items.slice(i, i + cols));
      result.push({ title, key, data: rows });
    }

    result.sort((a, b) => (a.key > b.key ? -1 : a.key < b.key ? 1 : 0));
    return result;
  }, [data, historyIndex, cols, dateLocale, timePattern]);

  const rowKey = useCallback((row: SectionRow<T>, index: number) => {
    const first = Array.isArray(row) && row[0];
    return first ? `r-${first.book.id}-${first.ts}-${index}` : `row-${index}`;
  }, []);

  const renderRow: SectionListRenderItem<SectionRow<T>> = ({
    item: row,
    index,
  }) => {
    return (
      <View
        style={{
          flexDirection: "row",
          width: "100%",
          paddingHorizontal,
          marginBottom: columnGap,
          justifyContent: "center",
        }}
      >
        {row.map((cell) => {
          const fav =
            favoritesSet.has(cell.book.id) ||
            isFavorite?.(cell.book.id) ||
            false;
          const entry = historyIndex[cell.book.id];
          const cur = entry ? Number(entry[1]) || 0 : 0;
          const total = entry ? Math.max(1, Number(entry[2]) || 1) : 1;
          const curDisp = Math.min(cur + 1, total);
          const done = entry ? cur >= total - 1 : false;

          return (
            <View
              key={`${cell.book.id}-${cell.ts}`}
              style={{
                width: cardWidth,
                alignItems: "stretch",
                marginHorizontal: columnGap / 2,
              }}
            >
              <View style={styles.timeRow}>
                <Text style={[styles.timeLabel, { color: colors.sub }]}>
                  {cell.timeHHmm}
                </Text>
                {entry && (
                  <View
                    style={[
                      styles.progressPill,
                      { backgroundColor: done ? colors.accent : colors.tagBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.progressPillText,
                        { color: done ? colors.bg : colors.metaText },
                      ]}
                    >
                      {done ? "✔" : `${curDisp}/${total}`}
                    </Text>
                  </View>
                )}
              </View>

              <BookCard
                design={chosenDesign}
                book={cell.book}
                cardWidth={cardWidth}
                isSingleCol={isSingleCol}
                contentScale={contentScale}
                isFavorite={fav}
                onToggleFavorite={(id, next) => {
                  toggleFavorite(id, next);
                  onToggleFavorite?.(id, next);
                }}
                onPress={() => onPress?.(cell.book.id)}
                score={getScore?.(cell.book)}
                showProgressOnCard={false}
                favoritesSet={favoritesSet}
                historyMap={historyMap}
                hydrateFromStorage={false}
              />
            </View>
          );
        })}
      </View>
    );
  };

  const renderSectionHeader = ({
    section,
  }: {
    section: SectionListData<SectionRow<T>>;
  }) => {
    const s = section as unknown as SectionShape<T>;
    return (
      <View style={[styles.sectionHeaderWrap, { paddingHorizontal }]}>
        <View style={[styles.sectionHeader, { backgroundColor: colors.tagBg }]}>
          <Text style={[styles.sectionHeaderText, { color: colors.metaText }]}>
            {s.title}
          </Text>
        </View>
      </View>
    );
  };

  const Empty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{t("historyNotFound")}</Text>
    </View>
  );

  const lastRowKey = useMemo(() => {
    if (!sections.length) return "";
    const lastSection = sections[sections.length - 1];
    const lastIndex = lastSection.data.length - 1;
    return rowKey(lastSection.data[lastIndex], lastIndex);
  }, [sections, rowKey]);

  const lastKeyHandledRef = useRef<string>("");
  const [tick, setTick] = useState(0);

  const onViewableItemsChanged = useCallback(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{ key?: string; isViewable: boolean }>;
    }) => {
      if (!onEndReached || !lastRowKey) return;
      const seen = viewableItems.some(
        (v) => v.isViewable && v.key === lastRowKey
      );
      if (seen && lastKeyHandledRef.current !== lastRowKey) {
        lastKeyHandledRef.current = lastRowKey;
        onEndReached();
        setTick((x) => (x + 1) % 100000);
      }
    },
    [onEndReached, lastRowKey]
  );

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 40,
      minimumViewTime: 80,
      waitForInteraction: true,
    }),
    []
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
      {sections.length === 0 && !loading ? (
        (ListEmptyComponent as ReactElement) ?? <Empty />
      ) : (
        <SectionList
          ref={listRef}
          stickySectionHeadersEnabled={false}
          sections={sections}
          keyExtractor={(row, index) =>
            rowKey(row as unknown as SectionRow<T>, index)
          }
          renderItem={renderRow}
          renderSectionHeader={renderSectionHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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
          contentContainerStyle={{
            paddingTop: paddingHorizontal / 2,
            paddingBottom: 16,
          }}
          removeClippedSubviews
          windowSize={7}
          maxToRenderPerBatch={10}
          initialNumToRender={8}
          updateCellsBatchingPeriod={40}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          extraData={tick}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#888", fontSize: 16 },
  loader: { marginVertical: 16 },

  sectionHeaderWrap: { paddingTop: 8, paddingBottom: 6 },
  sectionHeader: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionHeaderText: {
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  timeRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  timeLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginRight: 8,
  },
  progressPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  progressPillText: { fontWeight: "800", fontSize: 11 },
});
