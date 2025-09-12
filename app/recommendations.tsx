import { CandidateBook, getRecommendations } from "@/api/nhentai";
import BookList from "@/components/BookList";
import NoResultsPanel from "@/components/NoResultsPanel";
import { useFilterTags } from "@/context/TagFilterContext";
import { useGridConfig } from "@/hooks/useGridConfig";
import { useTheme } from "@/lib/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type RecBook = CandidateBook & { explain: string[]; score: number };

export default function RecommendationsScreen() {
  const { colors } = useTheme();
  const { includes, excludes } = useFilterTags();
  const router = useRouter();

  const [books, setBooks] = useState<RecBook[]>([]);
  const [favIds, setFavIds] = useState<number[]>([]);
  const [favorites, setFav] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const gridConfig = useGridConfig();

  const perPage = 50;

  useEffect(() => {
    AsyncStorage.getItem("bookFavorites").then((j) => {
      const arr = j ? (JSON.parse(j) as number[]) : [];
      setFavIds(arr);
      setFav(new Set(arr));
    });
  }, []);

  useEffect(() => {
    if (favIds.length === 0) {
      setBooks([]);
      setLoading(false);
      setHasMore(false);
      return;
    }
    fetchRecs();
  }, [favIds]);

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    setPage(1);
    setHasMore(true);
    try {
      const { books: recs } = await getRecommendations({
        ids: favIds,
        includeTags: includes,
        excludeTags: excludes,
        page: 1,
        perPage,
      });
      setBooks(recs);
      setHasMore(recs.length === perPage);
    } catch (e) {
      setBooks([]);
      setHasMore(false);
      console.error("Failed to fetch recommendations:", e);
    } finally {
      setLoading(false);
    }
  }, [favIds, includes, excludes]);

  const loadMoreRecommendations = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const { books: recs } = await getRecommendations({
        ids: favIds,
        includeTags: includes,
        excludeTags: excludes,
        page: nextPage,
        perPage,
      });
      setBooks((prev) => [...prev, ...recs]);
      setPage(nextPage);
      setHasMore(recs.length === perPage);
    } catch (e) {
      setHasMore(false);
      console.error("Failed to load more recommendations:", e);
    } finally {
      setLoading(false);
    }
  }, [favIds, includes, excludes, page, loading, hasMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRecs();
    setRefreshing(false);
  }, [fetchRecs]);

  /* toggle favorite */
  const toggleFav = useCallback((id: number, next: boolean) => {
    setFav((prev) => {
      const cp = new Set(prev);
      next ? cp.add(id) : cp.delete(id);
      AsyncStorage.setItem("bookFavorites", JSON.stringify([...cp]));
      return cp;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("bookFavorites").then(
        (j) => j && setFav(new Set(JSON.parse(j)))
      );
    }, [])
  );

  const maxScore =
    books.length > 0 ? Math.max(...books.map((b) => b.score)) : 1;

  const emptyTitle =
    favIds.length === 0
      ? "Нет рекомендаций — добавь книги в избранное"
      : "Рекомендаций пока нет";
  const emptySubtitle =
    favIds.length === 0
      ? "Поставь несколько лайков — я подберу похожее."
      : "Попробуй изменить фильтры или обновить список.";
  const emptyActions = useMemo(
    () => [
      { label: "Открыть избранное", onPress: () => router.push("/favorites") },
      { label: "Открыть фильтры", onPress: () => router.push("/tags") },
    ],
    [router]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {loading && books.length === 0 ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <>
          <BookList
            data={books}
            loading={loading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onToggleFavorite={toggleFav}
            onEndReached={hasMore ? loadMoreRecommendations : undefined}
            getScore={(b) =>
              typeof b.score === "number"
                ? Math.round((b.score / maxScore) * 100)
                : undefined
            }
            onPress={(id) =>
              router.push({
                pathname: "/book/[id]",
                params: {
                  id: String(id),
                  title: books.find((b) => b.id === id)?.title.pretty,
                },
              })
            }
            ListEmptyComponent={
              !loading && books.length === 0 ? (
                <NoResultsPanel
                  title={emptyTitle}
                  subtitle={emptySubtitle}
                  iconName="star"
                  actions={emptyActions}
                />
              ) : null
            }
            gridConfig={{ default: gridConfig }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
