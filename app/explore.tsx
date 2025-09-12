import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import {
  Book,
  DateSearchPhase,
  DateSearchProgress,
  searchBooks,
} from "@/api/nhentai";
import BookList from "@/components/BookList";
import NoResultsPanel from "@/components/NoResultsPanel";
import PaginationBar from "@/components/PaginationBar";
import { useDateRange } from "@/context/DateRangeContext";
import { useSort } from "@/context/SortContext";
import { useFilterTags } from "@/context/TagFilterContext";
import { useGridConfig } from "@/hooks/useGridConfig";
import { useTheme } from "@/lib/ThemeContext";

// локальный кэш экрана
const EXPLORE_CACHE = new Map<string, { books: Book[]; totalPages: number }>();

type ProbeNow = {
  which: "start" | "end";
  page: number;
  headSec: number;
  tailSec: number;
  lo: number;
  hi: number;
  mid: number;
  decision?: "left" | "right" | "hit";
};
function hasProbe(p: DateSearchProgress): p is DateSearchProgress & {
  bounds: NonNullable<DateSearchProgress["bounds"]>;
  probe: NonNullable<DateSearchProgress["probe"]>;
} {
  return p.phase === "range:probe" && !!p.bounds && !!p.probe;
}

type ResultState = "idle" | "loading" | "no-results" | "timeout" | "error";

export default function ExploreScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const { query: rawQ, solo: rawSolo } = useLocalSearchParams<{
    query?: string | string[];
    solo?: string | string[];
  }>();
  const urlQ = Array.isArray(rawQ) ? rawQ[0] : rawQ;
  const solo = Array.isArray(rawSolo) ? rawSolo[0] : rawSolo;

  const [query, setQuery] = useState(urlQ ?? "");
  const { sort, setSort } = useSort();
  const {
    includes,
    excludes,
    clearAll: clearAllTagFilters,
  } = useFilterTags() as any;
  const { from: dateFrom, to: dateTo, clearRange, isHydrated } = useDateRange();
  const dateFilterActive = !!dateFrom || !!dateTo;

  const useFilters = solo !== "1";
  const activeIncludes = useFilters ? includes : [];
  const activeExcludes = useFilters ? excludes : [];
  const hasTagFilters =
    (activeIncludes?.length ?? 0) > 0 || (activeExcludes?.length ?? 0) > 0;

  const incStr = JSON.stringify(activeIncludes);
  const excStr = JSON.stringify(activeExcludes);

  const [books, setBooks] = useState<Book[]>([]);
  const [totalPages, setTotal] = useState(1);
  const [currentPage, setPage] = useState(1);
  const [favorites, setFav] = useState<Set<number>>(new Set());

  const [resultState, setResultState] = useState<ResultState>("idle");
  const [errorMsg, setErr] = useState<string>("");

  const [stage, setStage] = useState<DateSearchPhase>("idle");
  const [probeNow, setProbeNow] = useState<ProbeNow | null>(null);
  const [windowInfo, setWindowInfo] = useState<{
    startIndex: number;
    endIndex: number;
    total: number;
  } | null>(null);

  const [isPaginating, setPaginating] = useState(false);

  const searching = dateFilterActive && stage !== "idle" && stage !== "done";
  const reqIdRef = useRef(0);
  const gridConfig = useGridConfig();

  useEffect(() => {
    AsyncStorage.getItem("bookFavorites").then(
      (j) => j && setFav(new Set(JSON.parse(j)))
    );
  }, []);

  const cacheKey = useMemo(
    () =>
      JSON.stringify({
        q: query.trim(),
        sort,
        inc: activeIncludes,
        exc: activeExcludes,
        page: currentPage,
        from: dateFrom
          ? new Date(dateFrom as any).toISOString().slice(0, 10)
          : null,
        to: dateTo ? new Date(dateTo as any).toISOString().slice(0, 10) : null,
      }),
    [query, sort, incStr, excStr, currentPage, dateFrom, dateTo]
  );

  const fmt = (sec?: number) =>
    sec ? new Date(sec * 1000).toLocaleDateString() : "—";

  const probeSubtitle = useMemo(() => {
    if (!probeNow) return "";
    const dir =
      probeNow.decision === "right"
        ? "→ вправо"
        : probeNow.decision === "left"
        ? "→ влево"
        : probeNow.decision === "hit"
        ? "✓ попадание"
        : "";
    const head = fmt(probeNow.headSec);
    const tail = fmt(probeNow.tailSec);
    const whichLabel = probeNow.which === "start" ? "Начало" : "Конец";
    return `${whichLabel}: p=${probeNow.page} • ${head} → ${tail} ${dir}`;
  }, [probeNow]);

  const Ring = ({
    progress,
    size = 20,
    stroke = 3,
  }: {
    progress: number;
    size?: number;
    stroke?: number;
  }) => {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ marginLeft: 8 }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeOpacity={0.25}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={stroke}
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - progress)}
          strokeLinecap="round"
          fill="none"
          rotation={-90}
          origin={`${size / 2},${size / 2}`}
        />
      </Svg>
    );
  };

  const DateSearchPanel = () => {
    const pct =
      stage === "meta"
        ? 0.1
        : stage === "range:start"
        ? 0.3
        : stage === "range:end"
        ? 0.6
        : stage === "fetch"
        ? 0.85
        : stage === "done"
        ? 1
        : 0.05;

    const title =
      stage === "meta"
        ? "Подготовка запроса…"
        : stage === "range:start"
        ? "Ищу начало окна…"
        : stage === "range:end"
        ? "Ищу конец окна…"
        : stage === "fetch"
        ? "Загружаю страницы окна…"
        : stage === "done"
        ? "Готово"
        : "Загрузка…";

    return (
      <View
        style={{
          backgroundColor: colors.accent + "10",
          borderBottomColor: colors.page,
          borderBottomWidth: StyleSheet.hairlineWidth,
        }}
      >
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.txt, fontWeight: "700" }}>
              {title}
            </Text>
            {!!probeSubtitle && (
              <Text style={{ color: colors.txt, opacity: 0.8, marginTop: 2 }}>
                {probeSubtitle}
              </Text>
            )}
            {windowInfo && stage === "fetch" && (
              <Text style={{ color: colors.txt, opacity: 0.8, marginTop: 2 }}>
                Окно: индексы {windowInfo.startIndex}…{windowInfo.endIndex} •
                элементов {windowInfo.total}
              </Text>
            )}
          </View>
          <Ring progress={pct} />
        </View>
      </View>
    );
  };

  const fetchPage = useCallback(
    async (page: number, keyForCache: string) => {
      const q = query.trim();
      const myReqId = ++reqIdRef.current;

      const isFirstLoad = books.length === 0;

      if (!dateFilterActive) {
        const cached = EXPLORE_CACHE.get(keyForCache);
        if (cached) {
          if (myReqId !== reqIdRef.current) return;
          setBooks(cached.books);
          setTotal(cached.totalPages);
          setResultState(cached.books.length ? "idle" : "no-results");
          setPaginating(false);
          return;
        }
      }

      setErr("");
      if (dateFilterActive) {
        setStage("meta");
        setProbeNow(null);
        setWindowInfo(null);
      } else {
        setResultState(isFirstLoad ? "loading" : "idle");
      }

      let timeoutHit = false;
      const timer = setTimeout(() => {
        timeoutHit = true;
        if (!dateFilterActive && isFirstLoad) setResultState("timeout");
      }, 15000);

      try {
        const res = await searchBooks({
          query: q || "",
          sort,
          page,
          perPage: 45,
          includeTags: activeIncludes,
          excludeTags: activeExcludes,
          dateFrom: dateFrom ?? undefined,
          dateTo: dateTo ?? undefined,
          sessionKey: `explore::${q || "ALL"}::${incStr}::${excStr}`,
          onProgress: dateFilterActive
            ? (pr: DateSearchProgress) => {
                if (hasProbe(pr)) {
                  const { bounds: b, probe: pv } = pr;
                  setProbeNow({
                    which: pr.which || "start",
                    page: pv.page,
                    headSec: pv.headSec,
                    tailSec: pv.tailSec,
                    lo: b.lo,
                    hi: b.hi,
                    mid: b.mid,
                    decision: b.decision,
                  });
                  return;
                }
                if (pr.phase === "fetch" && pr.window) setWindowInfo(pr.window);
                setStage(pr.phase);
              }
            : undefined,
        });

        clearTimeout(timer);
        if (myReqId !== reqIdRef.current) return;

        setBooks(res.books);
        setTotal(res.totalPages);
        EXPLORE_CACHE.set(keyForCache, {
          books: res.books,
          totalPages: res.totalPages,
        });

        if (!dateFilterActive) {
          setResultState(res.books.length ? "idle" : "no-results");
        } else {
          setTimeout(() => {
            setStage("done");
            setProbeNow(null);
          }, 200);
        }
      } catch (e: any) {
        clearTimeout(timer);
        if (myReqId !== reqIdRef.current) return;
        setErr(e?.message || String(e));
        if (dateFilterActive) setStage("done");
        else setResultState(timeoutHit ? "timeout" : "error");
      } finally {
        setPaginating(false);
      }
    },
    [
      query,
      sort,
      incStr,
      excStr,
      dateFrom,
      dateTo,
      dateFilterActive,
      activeIncludes,
      activeExcludes,
      books.length,
    ]
  );

  useEffect(() => {
    if (!isHydrated) return;
    fetchPage(currentPage, cacheKey);
  }, [isHydrated, cacheKey, currentPage, fetchPage]);

  useEffect(() => {
    setQuery(urlQ ?? "");
  }, [urlQ]);

  useEffect(() => {
    setPage(1);
  }, [query, sort, incStr, excStr, dateFrom, dateTo]);

  const onRefresh = useCallback(async () => {
    if (!isHydrated) return;
    await fetchPage(currentPage, cacheKey);
  }, [isHydrated, currentPage, cacheKey, fetchPage]);

  const toggleFav = useCallback(
    (id: number, next: boolean) => {
      setFav((prev) => {
        const cp = new Set(prev);
        next ? cp.add(id) : cp.delete(id);
        AsyncStorage.setItem("bookFavorites", JSON.stringify([...cp]));
        return cp;
      });

      setBooks((prev) => {
        const patched = prev.map((b) =>
          b.id === id
            ? {
                ...b,
                favorites: Math.max(
                  0,
                  (typeof b.favorites === "number" ? b.favorites : 0) +
                    (next ? 1 : -1)
                ),
              }
            : b
        );
        const cached = EXPLORE_CACHE.get(cacheKey);
        if (cached)
          EXPLORE_CACHE.set(cacheKey, {
            books: patched,
            totalPages: cached.totalPages,
          });
        return patched;
      });
    },
    [cacheKey]
  );

  const showNoResults =
    (!dateFilterActive && resultState === "no-results") ||
    (dateFilterActive && !searching && books.length === 0);

  // Причина для текста в панели
  const reason = dateFilterActive
    ? "dates"
    : hasTagFilters
    ? "filters"
    : "general";

  const noResTitle =
    reason === "dates"
      ? "В выбранном диапазоне дат ничего не найдено"
      : reason === "filters"
      ? "По выбранным фильтрам ничего не найдено"
      : query.trim()
      ? `По запросу «${query.trim()}» ничего не найдено`
      : "Ничего не найдено";

  const noResSubtitle =
    "Попробуй изменить запрос, снять часть фильтров или расширить диапазон.";

  const noResActions = useMemo(() => {
    const base = [
      { label: "Открыть фильтры", onPress: () => router.push("/tags") },
      { label: "Свежие", onPress: () => setSort("date") },
      { label: "Популярное за месяц", onPress: () => setSort("popular-month") },
    ];
    if (reason === "dates")
      return [{ label: "Сбросить даты", onPress: clearRange }, ...base];
    if (reason === "filters") {
      return [
        {
          label: "Сбросить фильтры",
          onPress: () => {
            clearAllTagFilters?.() ?? router.push("/tags");
          },
        },
        ...base,
      ];
    }
    return [
      {
        label: "Изменить запрос",
        onPress: () =>
          router.push({ pathname: "/search", params: { query: query.trim() } }),
      },
      ...base,
    ];
  }, [router, query, setSort, clearRange, reason, clearAllTagFilters]);

  // «Скелетон» показываем только если данных ещё вообще нет (первая загрузка),
  // при пагинации оставляем старый список без моргания
  const showListSkeleton =
    (!dateFilterActive && resultState === "loading" && books.length === 0) ||
    (dateFilterActive && books.length === 0 && searching);

  return (
    <View style={styles.container}>
      {dateFilterActive && searching && <DateSearchPanel />}

      {showNoResults && (
        <NoResultsPanel
          title={noResTitle}
          subtitle={noResSubtitle}
          iconName={
            reason === "dates"
              ? "calendar"
              : reason === "filters"
              ? "filter"
              : "search"
          }
          actions={noResActions}
        />
      )}

      {(!dateFilterActive || !searching) && (
        <>
          <BookList
            /* НЕ даём ремоунтиться: никаких key на BookList */
            data={books}
            loading={showListSkeleton}
            refreshing={false}
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
            gridConfig={{ default: gridConfig }}
          />
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            onChange={(p) => {
              // никаких очисток данных — просто отмечаем, что идёт пагинация
              setPaginating(true);
              if (dateFilterActive) {
                setStage("fetch");
                setProbeNow(null);
                setWindowInfo(null);
              }
              setPage(p);
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
