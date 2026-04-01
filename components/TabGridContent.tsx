/**
 * Сетка книг для одной вкладки (Главная, Рекомендации, Скаченные, Лайкнутые, История, Персонажи).
 * Загружает данные по tabKey и рендерит BookList или переход на полный экран.
 */
import type { Book } from "@/api/nhappApi/types";
import { galleryCardToBook } from "@/api/v2/compat";
import { fetchGalleryBrowsePaginated } from "@/api/v2/galleryBrowse";
import { fetchBooksFromRecommendationLib } from "@/api/nhappApi/recommendationLib";
import { BROWSE_CARDS_PER_PAGE } from "@/utils/browseGridPageSize";
import BookList from "@/components/BookList";
import type { GridConfig } from "@/components/BookList";
import { useDateRange } from "@/context/DateRangeContext";
import { useFilterTags } from "@/context/TagFilterContext";
import { useSort } from "@/context/SortContext";
import { useTheme } from "@/lib/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestStoragePush } from "@/api/nhappApi/cloudStorage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

export type TabGridContentProps = {
  tabKey: "home" | "downloaded" | "favorites" | "history" | "characters";
  gridConfig?: {
    phonePortrait?: GridConfig;
    phoneLandscape?: GridConfig;
    tabletPortrait?: GridConfig;
    tabletLandscape?: GridConfig;
    default?: GridConfig;
  };
};

export function TabGridContent({ tabKey, gridConfig }: TabGridContentProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFav] = useState<Set<number>>(new Set());
  const scrollRef = useRef<FlatList<Book> | null>(null);
  const reqIdRef = useRef(0);

  const { sort } = useSort();
  const { includes, excludes } = useFilterTags() as { includes: { type: string; name: string }[]; excludes: { type: string; name: string }[] };
  const { uploaded, isHydrated } = useDateRange();
  const activeIncludes = includes ?? [];
  const activeExcludes = excludes ?? [];
  const incStr = JSON.stringify(activeIncludes);
  const excStr = JSON.stringify(activeExcludes);

  const loadFavIds = useCallback(() => {
    AsyncStorage.getItem("bookFavorites").then((j) => {
      const list = j ? (JSON.parse(j) as number[]) : [];
      setFav(new Set(list));
      return list;
    });
  }, []);

  useEffect(() => {
    loadFavIds();
  }, [loadFavIds]);

  const fetchHome = useCallback(async () => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      const res = await fetchGalleryBrowsePaginated({
        query: "",
        includes: activeIncludes,
        excludes: activeExcludes,
        uploaded: uploaded ?? null,
        sort: (sort || "date") as any,
        page: 1,
        per_page: 60,
      });
      if (myId !== reqIdRef.current) return;
      setBooks(res.result.map(galleryCardToBook));
    } catch {
      if (myId === reqIdRef.current) setBooks([]);
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, [sort, incStr, excStr, uploaded, activeIncludes, activeExcludes]);

  const fetchFavorites = useCallback(async () => {
    const ids = await AsyncStorage.getItem("bookFavorites").then((j) =>
      j ? (JSON.parse(j) as number[]) : []
    );
    if (ids.length === 0) {
      setBooks([]);
      setLoading(false);
      return;
    }
    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      const pageIds = ids.slice(0, BROWSE_CARDS_PER_PAGE);
      const fetched = await fetchBooksFromRecommendationLib(pageIds);
      const ordered = pageIds
        .map((id) => fetched.find((b: Book) => b.id === id))
        .filter((b): b is Book => !!b);
      if (myId !== reqIdRef.current) return;
      setBooks(ordered);
      setFav(new Set(ids));
    } catch {
      if (myId === reqIdRef.current) setBooks([]);
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tabKey === "home" && isHydrated) {
      fetchHome();
    } else if (tabKey === "favorites") {
      fetchFavorites();
    } else if (tabKey === "downloaded" || tabKey === "history" || tabKey === "characters") {
      setLoading(false);
      setBooks([]);
    }
  }, [tabKey, isHydrated, fetchHome, fetchFavorites]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (tabKey === "home") await fetchHome();
    else if (tabKey === "favorites") await fetchFavorites();
    else loadFavIds();
    setRefreshing(false);
  }, [tabKey, fetchHome, fetchRecommendations, fetchFavorites, loadFavIds]);

  const toggleFav = useCallback((id: number, next: boolean) => {
    setFav((prev) => {
      const cp = new Set(prev);
      next ? cp.add(id) : cp.delete(id);
      AsyncStorage.setItem("bookFavorites", JSON.stringify([...cp]));
      requestStoragePush();
      return cp;
    });
  }, []);

  if (tabKey === "downloaded" || tabKey === "history" || tabKey === "characters") {
    const label =
      tabKey === "downloaded"
        ? "Скаченные"
        : tabKey === "history"
          ? "История"
          : "Персонажи";
    const path =
      tabKey === "downloaded"
        ? "/downloaded"
        : tabKey === "history"
          ? "/history"
          : "/characters";
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.bg }]}>
        <Pressable
          onPress={() => router.push(path as any)}
          style={({ pressed }) => [
            styles.linkButton,
            { backgroundColor: colors.accent + "22", opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.linkLabel, { color: colors.accent }]}>
            Открыть {label}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.gridWrap}>
      <BookList
        data={books}
        loading={loading && books.length === 0}
        refreshing={refreshing}
        onRefresh={onRefresh}
        isFavorite={(id) => favorites.has(id)}
        onToggleFavorite={toggleFav}
        onPress={(id) => {
          const b = books.find((x) => x.id === id);
          router.push({
            pathname: "/book/[id]",
            params: { id: String(id), title: b?.title?.pretty ?? "" },
          });
        }}
        gridConfig={gridConfig}
        scrollRef={scrollRef}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gridWrap: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  linkButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  linkLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});
