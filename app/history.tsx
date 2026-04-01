import LoadingSpinner from "@/components/LoadingSpinner";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, SectionList, StyleSheet, Text, View } from "react-native";

import { fetchBooksFromRecommendationLib } from "@/api/nhappApi/recommendationLib";
import type { Book } from "@/api/nhappApi/types";
import BookListHistory, { READ_HISTORY_KEY, ReadHistoryEntry } from "@/components/BookListHistory";
import BookList from "@/components/BookList";
import ListSortBar, { isListSortValue, ListSortValue } from "@/components/ListSortBar";
import { useGridConfig } from "@/hooks/useGridConfig";
import { useTheme } from "@/lib/ThemeContext";
import { scrollToTop } from "@/utils/scrollToTop";

const PER_PAGE = 2000;

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const gridConfig = useGridConfig();

  const [books, setBooks] = useState<Book[]>([]);
  const [ids, setIds] = useState<number[]>([]);
  const [histIndex, setHistIndex] = useState<Record<number, ReadHistoryEntry>>({});
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sort, setSort] = useState<ListSortValue>("added_desc");
  const scrollRef = useRef<SectionList<any> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("ui.sort.history")
      .then((v) => {
        if (isListSortValue(v)) setSort(v);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("ui.sort.history", sort).catch(() => {});
  }, [sort]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(ids.length / PER_PAGE)), [ids.length]);

  const loadHistoryIndex = useCallback(async () => {
    const raw = await AsyncStorage.getItem(READ_HISTORY_KEY);
    if (!raw) {
      setIds([]);
      setHistIndex({});
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setIds([]);
      setHistIndex({});
      return;
    }
    const arr = Array.isArray(parsed) ? (parsed as ReadHistoryEntry[]) : [];
    const byId = new Map<number, ReadHistoryEntry>();
    for (const e of arr) {
      if (!e || !Array.isArray(e)) continue;
      const [id, curr, total, ts] = e;
      const prev = byId.get(id);
      if (!prev || (prev[3] || 0) < (ts || 0)) byId.set(id, [id, curr, total, ts]);
    }
    const sortedIds = [...byId.values()].sort((a, b) => (b[3] || 0) - (a[3] || 0)).map((e) => e[0]);
    const indexObj: Record<number, ReadHistoryEntry> = {};
    for (const [id, entry] of byId) indexObj[id] = entry;
    setIds(sortedIds);
    setHistIndex(indexObj);
  }, []);

  useEffect(() => {
    loadHistoryIndex();
  }, [loadHistoryIndex]);

  useFocusEffect(
    useCallback(() => {
      loadHistoryIndex();
    }, [loadHistoryIndex])
  );

  const reqIdRef = useRef(0);

  const loadBooks = useCallback(
    async (pageNum: number) => {
      if (ids.length === 0) {
        setBooks([]);
        setPage(1);
        return;
      }
      const start = (pageNum - 1) * PER_PAGE;
      const pageIds = ids.slice(start, start + PER_PAGE);
      if (pageIds.length === 0) return;

      const myReq = ++reqIdRef.current;
      if (pageNum === 1) setBooks([]);
      if (pageNum > 1) setIsLoadingMore(true);

      try {
        const ordered = await fetchBooksFromRecommendationLib(pageIds, {
          placeholdersForMissing: true,
        });
        if (reqIdRef.current !== myReq) return;
        setBooks((prev) => (pageNum === 1 ? ordered : [...prev, ...ordered]));
        setPage(pageNum);
      } catch {
        if (reqIdRef.current === myReq && pageNum === 1) setBooks([]);
      } finally {
        if (pageNum > 1) setIsLoadingMore(false);
      }
    },
    [ids]
  );

  useEffect(() => {
    loadBooks(1);
  }, [ids, loadBooks]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) return;
    if (page >= totalPages) return;
    loadBooks(page + 1);
  }, [isLoadingMore, page, totalPages, loadBooks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistoryIndex();
    await loadBooks(1);
    setRefreshing(false);
    scrollToTop(scrollRef);
  }, [loadHistoryIndex, loadBooks]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleRefresh = async () => {
      globalThis.dispatchEvent?.(
        new globalThis.CustomEvent("app:refresh-content-start")
      );
      try {
        await onRefresh();
      } finally {
        globalThis.dispatchEvent?.(
          new globalThis.CustomEvent("app:refresh-content-end")
        );
      }
    };
    globalThis.addEventListener?.("app:refresh-content", handleRefresh);
    return () => {
      globalThis.removeEventListener?.("app:refresh-content", handleRefresh);
    };
  }, [onRefresh]);

  const footer = useMemo(() => (isLoadingMore ? <View style={{ marginVertical: 16 }}><LoadingSpinner size="small" /></View> : null), [isLoadingMore]);

  const initialLoading = ids.length > 0 && books.length === 0 && !refreshing;

  const sortedBooks = useMemo(() => {
    const base = [...books];
    const getYear = (b: any) => {
      const d = b?.uploaded ? new Date(b.uploaded) : null;
      const y = d && Number.isFinite(d.getTime()) ? d.getFullYear() : 0;
      return y || 0;
    };
    const getTitle = (b: any) => String(b?.title?.pretty ?? "").toLowerCase();

    switch (sort) {
      case "added_desc":
        return base; // already newest first by history ts
      case "added_asc":
        return base.reverse();
      case "year_asc":
        return base.sort((a, b) => getYear(a) - getYear(b));
      case "year_desc":
        return base.sort((a, b) => getYear(b) - getYear(a));
      case "alpha_asc":
        return base.sort((a, b) => getTitle(a).localeCompare(getTitle(b)));
      case "alpha_desc":
        return base.sort((a, b) => getTitle(b).localeCompare(getTitle(a)));
    }
  }, [books, sort]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      {sort === "added_desc" ? (
        <BookListHistory
          data={books}
          historyIndex={histIndex}
          loading={initialLoading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={handleLoadMore}
          ListHeaderComponent={
            <ListSortBar count={sortedBooks.length} sort={sort} onChangeSort={setSort} />
          }
          onPress={(id) =>
            router.push({
              pathname: "/book/[id]",
              params: { id: String(id), title: books.find((b) => b.id === id)?.title.pretty },
            })
          }
          ListEmptyComponent={ids.length === 0 ? <Text style={{ textAlign: "center", marginTop: 40, color: colors.sub }}>История пуста</Text> : null}
          ListFooterComponent={footer}
          gridConfig={{ default: gridConfig }}
          scrollRef={scrollRef}
        />
      ) : (
        <BookList
          data={sortedBooks}
          loading={initialLoading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={handleLoadMore}
          ListHeaderComponent={
            <ListSortBar count={sortedBooks.length} sort={sort} onChangeSort={setSort} />
          }
          onPress={(id) =>
            router.push({
              pathname: "/book/[id]",
              params: { id: String(id), title: sortedBooks.find((b) => b.id === id)?.title.pretty },
            })
          }
          ListEmptyComponent={ids.length === 0 ? <Text style={{ textAlign: "center", marginTop: 40, color: colors.sub }}>История пуста</Text> : null}
          ListFooterComponent={footer}
          gridConfig={{ default: gridConfig }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
