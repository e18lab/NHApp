import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";

import { requestStoragePush } from "@/api/nhappApi/cloudStorage";
import type { Book } from "@/api/nhappApi/types";
import { fetchBooksFromRecommendationLib } from "@/api/nhappApi/recommendationLib";
import BookList from "@/components/BookList";
import ListSortBar, { isListSortValue, ListSortValue } from "@/components/ListSortBar";
import { scrollToTop } from "@/utils/scrollToTop";
import { useGridConfig } from "@/hooks/useGridConfig";
import { useTheme } from "@/lib/ThemeContext";

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [ids, setIds] = useState<number[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<ListSortValue>("added_desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const gridConfig = useGridConfig();
  const scrollRef = useRef<FlatList<Book> | null>(null);
  const reqIdRef = useRef(0);

  const loadFavoriteIds = useCallback(() => {
    AsyncStorage.getItem("bookFavorites").then((j) => {
      const list = j ? (JSON.parse(j) as number[]) : [];
      setIds(list);
      setFavorites(new Set(list));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("ui.sort.favorites")
      .then((v) => {
        if (isListSortValue(v)) setSort(v);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("ui.sort.favorites", sort).catch(() => {});
  }, [sort]);

  useEffect(loadFavoriteIds, [loadFavoriteIds]);
  useFocusEffect(loadFavoriteIds);

  const loadBooks = useCallback(
    async (pageNum: number, perPage: number = 200) => {
      if (ids.length === 0) {
        setBooks([]);
        setTotalPages(1);
        return;
      }
      // Bookmarks are stored in AsyncStorage as "added order" (oldest → newest).
      // For "added_desc" (newest → oldest) we page from the end.
      const idsByAddedDesc = ids.slice().reverse();
      const basis = sort === "added_desc" ? idsByAddedDesc : ids;
      const start = (pageNum - 1) * perPage;
      const pageIds = basis.slice(start, start + perPage);
      if (pageIds.length === 0) return;

      const myReq = ++reqIdRef.current;
      const totalPg = Math.max(1, Math.ceil(ids.length / perPage));

      try {
        const ordered = await fetchBooksFromRecommendationLib(pageIds, { placeholdersForMissing: true });
        if (reqIdRef.current !== myReq) return;
        setBooks((prev) => (pageNum === 1 ? ordered : [...prev, ...ordered]));
        setTotalPages(totalPg);
        setPage(pageNum);
      } catch (e) {
        console.error("Failed loading favorites:", e);
        if (reqIdRef.current === myReq && pageNum === 1) setBooks([]);
      }
    },
    [ids, sort]
  );

  useEffect(() => {
    loadBooks(1);
  }, [ids, loadBooks]);

  const handleLoadMore = () => {
    if (page < totalPages) {
      loadBooks(page + 1);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBooks(1);
    setRefreshing(false);
    scrollToTop(scrollRef);
  }, [loadBooks]);

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

  const toggleFavorite = useCallback((id: number, next: boolean) => {
    setFavorites((prev) => {
      const copy = new Set(prev);
      if (next) {
        copy.add(id);
        // Keep deterministic "added" ordering: oldest → newest (append).
        const newList = [...ids.filter((x) => x !== id), id];
        setIds(newList);
        AsyncStorage.setItem("bookFavorites", JSON.stringify(newList));
        requestStoragePush();
      } else {
        copy.delete(id);
        setBooks((prevBooks) => prevBooks.filter((b) => b.id !== id));
        const newList = ids.filter((x) => x !== id);
        setIds(newList);
        AsyncStorage.setItem("bookFavorites", JSON.stringify(newList));
        requestStoragePush();
      }
      return copy;
    });
  }, [ids]);

  const sortedBooks = React.useMemo(() => {
    const base = [...books];
    const idx = new Map<number, number>();
    for (let i = 0; i < ids.length; i++) idx.set(ids[i], i);
    const getYear = (b: any) => {
      const d = b?.uploaded ? new Date(b.uploaded) : null;
      const y = d && Number.isFinite(d.getTime()) ? d.getFullYear() : 0;
      return y || 0;
    };
    const getTitle = (b: any) => String(b?.title?.pretty ?? "").toLowerCase();

    switch (sort) {
      case "added_asc":
        // oldest → newest
        base.sort((a, b) => (idx.get(a.id) ?? 1e9) - (idx.get(b.id) ?? 1e9));
        return base;
      case "added_desc":
        // newest → oldest
        base.sort((a, b) => (idx.get(b.id) ?? 1e9) - (idx.get(a.id) ?? 1e9));
        return base;
      case "year_asc":
        base.sort((a, b) => getYear(a) - getYear(b));
        break;
      case "year_desc":
        base.sort((a, b) => getYear(b) - getYear(a));
        break;
      case "alpha_asc":
        base.sort((a, b) => getTitle(a).localeCompare(getTitle(b)));
        break;
      case "alpha_desc":
        base.sort((a, b) => getTitle(b).localeCompare(getTitle(a)));
        break;
    }
    return base;
  }, [books, sort, ids]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <BookList
        data={sortedBooks}
        loading={ids.length > 0 && books.length === 0}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={handleLoadMore}
        ListHeaderComponent={
          <ListSortBar count={sortedBooks.length} sort={sort} onChangeSort={setSort} />
        }
        isFavorite={(id) => favorites.has(id)}
        onToggleFavorite={toggleFavorite}
        onPress={(id) =>
          router.push({ pathname: "/book/[id]", params: { id: String(id), title: books.find(b => b.id === id)?.title.pretty } })
        }
        ListEmptyComponent={
          ids.length === 0 ? (
            <Text
              style={{ textAlign: "center", marginTop: 40, color: colors.sub }}
            >
              Ещё нет избранного
            </Text>
          ) : null
        }
        gridConfig={{ default: gridConfig }}
        scrollRef={scrollRef}
      />
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
