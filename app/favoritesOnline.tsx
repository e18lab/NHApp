import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { Book } from "@/api/nhappApi/types";
import { getFavorites, hasSession } from "@/api/v2";
import { BROWSE_CARDS_PER_PAGE } from "@/utils/browseGridPageSize";
import { galleryCardToBook } from "@/api/v2/compat";
import BookListOnline from "@/components/BookListOnline";
import PaginationBar from "@/components/PaginationBar";
import { subscribeToStorageApplied } from "@/api/nhappApi/cloudStorage";
import { mergeOnlineFavoriteIds } from "@/lib/onlineFavoritesStorage";
import { INFINITE_SCROLL_KEY } from "@/components/settings/keys";
import { scrollToTop } from "@/utils/scrollToTop";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGridConfig } from "@/hooks/useGridConfig";
import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function FavoritesOnlineScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const gridConfig = useGridConfig();

  const [books, setBooks] = useState<Book[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [infiniteScroll, setInfiniteScroll] = useState(false);
  const scrollRef = useRef<FlatList<Book> | null>(null);
  const [q, setQ] = useState("");
  const qDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [hasAuth, setHasAuth] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const loadingRef = useRef(false);
  const [everLoaded, setEverLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const LOAD_SAFETY_MS = 25_000;

  useEffect(() => {
    AsyncStorage.multiGet(["ui.q.favoritesOnline"])
      .then((pairs) => {
        const map = new Map(pairs as any);
        const qq = map.get("ui.q.favoritesOnline");
        if (typeof qq === "string") setQ(qq);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("ui.q.favoritesOnline", q).catch(() => {});
  }, [q]);

  const loadInfiniteScrollSetting = useCallback(() => {
    AsyncStorage.getItem(INFINITE_SCROLL_KEY).then((value) => {
      setInfiniteScroll(value === "true");
    });
  }, []);

  useEffect(() => {
    loadInfiniteScrollSetting();
    const unsub = subscribeToStorageApplied(loadInfiniteScrollSetting);
    return unsub;
  }, [loadInfiniteScrollSetting]);

  const checkAuth = useCallback(async () => {
    try {
      setHasAuth(await hasSession());
    } catch {
      setHasAuth(false);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!authChecked) checkAuth();
    }, [authChecked, checkAuth])
  );

  const loadPage = useCallback(
    async (pageNum: number) => {
      if (!hasAuth) {
        setBooks([]);
        setPage(1);
        setTotalPages(1);
        setEverLoaded(true);
        setLoadError(false);
        return;
      }
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoadingBooks(true);
      setLoadError(false);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(() => {
        if (!loadingRef.current) return;
        loadingRef.current = false;
        setLoadingBooks(false);
        setEverLoaded(true);
        setLoadError(true);
        loadTimeoutRef.current = null;
      }, LOAD_SAFETY_MS);

      try {
        const res = await getFavorites({
          q: q?.trim() ? q.trim() : undefined,
          page: pageNum,
          per_page: BROWSE_CARDS_PER_PAGE,
        });
        const tp = res.num_pages;
        setTotal(res.total ?? 0);
        const newBooks = res.result.map(galleryCardToBook);

        setTotalPages(tp);
        setPage(pageNum);

        if (pageNum === 1 || !infiniteScroll) setBooks([]);
        if (pageNum > 1 && !infiniteScroll) scrollToTop(scrollRef);

        if (newBooks.length === 0) {
          setEverLoaded(true);
          return;
        }

        void mergeOnlineFavoriteIds(newBooks.map((b) => b.id));

        if (pageNum > 1 && infiniteScroll) {
          setBooks((prev) => [...prev, ...newBooks]);
        } else {
          setBooks(newBooks);
        }
      } finally {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        loadingRef.current = false;
        setLoadingBooks(false);
        setEverLoaded(true);
      }
    },
    [hasAuth, infiniteScroll, q]
  );

  useEffect(() => {
    if (!hasAuth || !authChecked) return;
    if (qDebounceRef.current) clearTimeout(qDebounceRef.current);
    qDebounceRef.current = setTimeout(() => {
      loadPage(1);
      scrollToTop(scrollRef);
    }, 250);
    return () => {
      if (qDebounceRef.current) clearTimeout(qDebounceRef.current);
      qDebounceRef.current = null;
    };
  }, [q, hasAuth, authChecked, loadPage]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!hasAuth || !authChecked) return;
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    const t = setTimeout(() => {
      loadPage(1);
      scrollToTop(scrollRef);
    }, 0);
    return () => clearTimeout(t);
  }, [hasAuth, authChecked, loadPage]);

  const onEnd = useCallback(() => {
    if (infiniteScroll && page < totalPages) loadPage(page + 1);
  }, [infiniteScroll, page, totalPages, loadPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPage(1);
    setRefreshing(false);
  }, [loadPage]);

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

  const onAfterUnfavorite = useCallback((removedIds: number[]) => {
    if (!removedIds?.length) return;
    setBooks((prev) => prev.filter((b) => !removedIds.includes(b.id)));
  }, []);

  const showLoading = loadingBooks || (hasAuth && authChecked && !everLoaded);

  if (loadError && books.length === 0 && !loadingBooks && hasAuth) {
    return (
      <View
        style={[
          styles.flex,
          styles.retryWrap,
          { backgroundColor: colors.bg },
        ]}
      >
        <Text style={[styles.retryText, { color: colors.sub }]}>
          Не удалось загрузить. Проверьте сеть или попробуйте позже.
        </Text>
        <Pressable
          onPress={() => {
            setLoadError(false);
            loadPage(1);
          }}
          style={[styles.retryBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.retryBtnText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <BookListOnline
        data={books}
        loading={showLoading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={infiniteScroll ? onEnd : undefined}
        hideToolbar={!showSettings}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.searchRow}>
              <Text style={{ color: colors.sub, fontSize: 13, fontWeight: "700" }}>
                {total ? (t("listSort.totalCount", { count: total }) as string) : ""}
              </Text>

              <View
                style={[
                  styles.searchBtn,
                  {
                    backgroundColor:
                      (colors as any).surfaceElevated ??
                      (colors as any).searchBg ??
                      (colors as any).page ??
                      colors.bg,
                  },
                ]}
              >
                <Feather name="search" size={16} color={colors.sub} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={t("favoritesOnline.searchPlaceholder")}
                  placeholderTextColor={colors.sub}
                  style={[styles.searchInput, { color: colors.sub }]}
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                  returnKeyType="search"
                />
              </View>

              <Pressable
                onPress={() => setShowSettings((v) => !v)}
                style={[
                  styles.iconPill,
                  {
                    backgroundColor:
                      (colors as any).surfaceElevated ??
                      (colors as any).searchBg ??
                      (colors as any).page ??
                      colors.bg,
                  },
                ]}
              >
                <Feather name="sliders" size={16} color={colors.sub} />
              </Pressable>
            </View>
          </View>
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
        gridConfig={{ default: gridConfig }}
        onAfterUnfavorite={onAfterUnfavorite}
        scrollRef={scrollRef}
      />
      {!infiniteScroll && hasAuth && (
        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          onChange={(p) => loadPage(p)}
          scrollRef={scrollRef}
          hideWhenInfiniteScroll={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconPill: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    minHeight: 42,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
    paddingVertical: 0,
  },
  retryWrap: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  retryText: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
});
