// components/SearchBar.tsx (или app/SearchBar, как у тебя)
import { Feather } from "@expo/vector-icons";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import DateRangePicker from "@/components/DateRangePicker";
import { useDrawer } from "@/components/DrawerContext";
import NhModal from "@/components/nhModal";
import { useDateRange } from "@/context/DateRangeContext";
import { SortKey, useSort } from "@/context/SortContext";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";

const BAR_HEIGHT = 52;
const BTN_SIDE = 40;

function hasSeg(pathname: string | null | undefined, seg: string) {
  const p = pathname ?? "";
  return new RegExp(`(^|/)${seg}(\\/|$)`).test(p);
}

function IconBtn({
  onPress,
  onLongPress,
  children,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.iconBtnRound,
        pressed && { backgroundColor: colors.accent + "22" },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function SearchBar() {
  const { colors } = useTheme();
  const { openDrawer } = useDrawer();
  const { sort, setSort } = useSort();
  const router = useRouter();
  const pathname = usePathname();
  const { from, to, setRange, clearRange } = useDateRange();
  const { t } = useI18n();

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "popular", label: t("explore.sort.popular") },
    { key: "popular-week", label: t("explore.sort.popularWeek") },
    { key: "popular-today", label: t("explore.sort.popularToday") },
    { key: "popular-month", label: t("explore.sort.popularMonth") },
    { key: "date", label: t("explore.sort.latest") },
  ];

  const params = useGlobalSearchParams<{ query?: string | string[]; id?: string | string[]; title?: string | string[]; slug?: string | string[] }>();
  const q = typeof params.query === "string" ? params.query : "";
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const bookId = typeof rawId === "string" ? rawId : undefined;
  const rawTitle = Array.isArray(params.title) ? params.title[0] : params.title;
  const bookTitle = typeof rawTitle === "string" ? rawTitle : undefined;
  const rawSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const userName = typeof rawSlug === "string" ? decodeURIComponent(rawSlug) : undefined;

  function getTitle(
    pathname: string | null | undefined,
    q: string,
    bookTitle?: string,
    bookId?: string
  ) {
    const p = pathname ?? "";
    const has = (seg: string) => new RegExp(`(^|/)${seg}(\\/|$)`).test(p);
    if (p === "/" || has("index")) return t("menu.home");
    if (has("explore")) return q ? t("search.results") + ": " + q : t("menu.explore");
    if (has("favorites") || has("favoritesOnline")) return t("menu.favorites");
    if (has("downloaded")) return t("menu.downloaded");
    if (has("recommendations")) return t("menu.recommendations");
    if (has("history")) return t("menu.history");
    if (has("settings")) return t("menu.settings");
    if (has("book")) return `#${bookId} - ${bookTitle}`;
    if (has("search")) return q ? t("menu.search") + ": " + q : t("menu.search");
    if (has("tags")) return t("menu.tags");
    if (has("profile")) return `${t("menu.profile")}: ${userName}`;
    return "NH App";
  }

  const [sortOpen, setSortOpen] = useState(false);
  const [tempSort, setTmp] = useState<SortKey>(sort);
  const [backOpen, setBackOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);

  useEffect(() => setTmp(sort), [sort]);

  const title = useMemo(
    () => getTitle(pathname, q, bookTitle, bookId),
    [pathname, q, bookTitle, bookId]
  );
  const showBack = pathname && pathname !== "/" && pathname !== "/index";

  const hideRight =
    hasSeg(pathname, "settings") ||
    hasSeg(pathname, "tags") ||
    hasSeg(pathname, "book") ||
    hasSeg(pathname, "profile") ||
    hasSeg(pathname, "favorites") ||
    hasSeg(pathname, "favoritesOnline");

  const closeSort = () => setSortOpen(false);
  const openSort = () => {
    setTmp(sort);
    setSortOpen(true);
  };

  const backOne = () => {
    setBackOpen(false);
    router.back();
  };
  const backTwo = () => {
    setBackOpen(false);
    router.back();
    setTimeout(() => router.back(), 0);
  };
  const backHome = () => {
    setBackOpen(false);
    router.replace("/");
  };

  const fmt = (d?: any) => (d ? new Date(d).toLocaleDateString() : "—");
  const rangeLabel = useMemo(() => `${fmt(from)}  •  ${fmt(to)}`, [from, to]);
  const hasDateFilter = !!from || !!to;

  return (
    <View>
      <Animated.View
        style={[
          styles.bar,
          {
            backgroundColor: colors.searchBg,
            height: BAR_HEIGHT,
            borderBottomColor: colors.page,
          },
        ]}
      >
        {showBack ? (
          <IconBtn
            onPress={() => router.back()}
            onLongPress={() => setBackOpen(true)}
          >
            <Feather name="arrow-left" size={20} color={colors.searchTxt} />
          </IconBtn>
        ) : (
          <IconBtn onPress={openDrawer}>
            <Feather name="menu" size={22} color={colors.searchTxt} />
          </IconBtn>
        )}

        <Text numberOfLines={1} style={[styles.title, { color: colors.searchTxt }]}>
          {title}
        </Text>

        {!hideRight && (
          <View style={styles.rightGroup}>
            <IconBtn
              onPress={() =>
                router.push({
                  pathname: "/search",
                  params: q ? { query: q } : {},
                })
              }
            >
              <Feather name="search" size={18} color={colors.searchTxt} />
            </IconBtn>

            <IconBtn onPress={() => setDateModalOpen(true)}>
              <Feather name="calendar" size={18} color={colors.accent} />
            </IconBtn>

            <IconBtn onPress={openSort}>
              <Feather name="filter" size={18} color={colors.accent} />
            </IconBtn>

            <IconBtn onPress={() => router.push("/tags")}>
              <Feather name="tag" size={18} color={colors.accent} />
            </IconBtn>
          </View>
        )}
      </Animated.View>

      {/* Sort modal */}
      <NhModal
        visible={sortOpen}
        onClose={closeSort}
        dimBackground
        sheetStyle={{ backgroundColor: colors.searchBg, borderColor: colors.page }}
        title={t("explore.sortBy")}
        hint={t("common.chooseOption")}
      >
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {SORT_OPTIONS.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[styles.sortRow, styles.rounded]}
              onPress={() => setTmp(key)}
            >
              <Text
                style={[
                  styles.sortTxt,
                  {
                    color: key === tempSort ? colors.accent : colors.searchTxt,
                    fontWeight: key === tempSort ? "700" : "500",
                  },
                ]}
              >
                {label}
              </Text>
              {key === tempSort && <Feather name="check" size={16} color={colors.accent} />}
            </Pressable>
          ))}

          <View style={{ marginTop: 10, paddingHorizontal: 0 }}>
            <Text
              style={{
                color: colors.searchTxt,
                opacity: 0.7,
                marginBottom: 4,
                fontWeight: "700",
              }}
            >
              {t("explore.dateRange") || "Дата (диапазон)"}
            </Text>

            <Pressable
              style={[styles.sortRow, styles.rounded]}
              onPress={() => setDateModalOpen(true)}
            >
              <Text style={[styles.sortTxt, { color: colors.searchTxt }]}>
                {rangeLabel}
              </Text>
              <Feather name="calendar" size={16} color={colors.accent} />
            </Pressable>

            {hasDateFilter && (
              <Pressable
                style={[styles.sortRow, styles.rounded]}
                onPress={clearRange}
              >
                <Text
                  style={[
                    styles.sortTxt,
                    { color: colors.accent, fontWeight: "700" },
                  ]}
                >
                  {t("common.reset") || "Сбросить даты"}
                </Text>
                <Feather name="x" size={16} color={colors.accent} />
              </Pressable>
            )}
          </View>
        </ScrollView>

        <View className="footer" style={styles.sheetFooter}>
          <Pressable
            style={[styles.footerBtn, styles.rounded, { backgroundColor: colors.accent }]}
            onPress={() => {
              setSort(tempSort);
              closeSort();
            }}
          >
            <Text style={[styles.footerBtnTxt, { color: colors.bg }]}>{t("common.ok")}</Text>
          </Pressable>
        </View>
      </NhModal>

      {/* Back modal */}
      <NhModal
        visible={backOpen}
        onClose={() => setBackOpen(false)}
        sheetStyle={{ backgroundColor: colors.searchBg, borderColor: colors.page }}
        title={t("common.back")}
      >
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: 8 }}
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={[styles.sortRow, styles.rounded]} onPress={backOne}>
            <Text style={[styles.sortTxt, { color: colors.searchTxt }]}>{t("searchBar.backOne")}</Text>
          </Pressable>
          <Pressable style={[styles.sortRow, styles.rounded]} onPress={backTwo}>
            <Text style={[styles.sortTxt, { color: colors.searchTxt }]}>{t("searchBar.backTwo")}</Text>
          </Pressable>
          <Pressable style={[styles.sortRow, styles.rounded]} onPress={backHome}>
            <Text style={[styles.sortTxt, { color: colors.searchTxt }]}>{t("searchBar.backHome")}</Text>
          </Pressable>
        </ScrollView>
      </NhModal>

      <NhModal
        visible={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        sheetStyle={{ backgroundColor: colors.searchBg, borderColor: colors.page }}
        title="Выбор даты"
      >
        <DateRangePicker
          initialFrom={from ? new Date(from as any) : null}
          initialTo={to ? new Date(to as any) : null}
          onClear={() => {
            clearRange();
            setDateModalOpen(false);
          }}
          onApply={({ from: f, to: t }) => {
            setRange(f ?? null, t ?? null);
            setDateModalOpen(false);
          }}
        />
      </NhModal>
    </View>
  );
}

const styles = StyleSheet.create({
  rounded: { borderRadius: 12, overflow: "hidden" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    elevation: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
  },
  title: {
    marginLeft: 8,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    textAlignVertical: "center",
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: 6,
  },
  iconBtnRound: {
    width: BTN_SIDE,
    height: BTN_SIDE,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetScroll: {},
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginVertical: 2,
  },
  sortTxt: { fontSize: 15 },
  sheetFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  footerBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 104,
    alignItems: "center",
  },
  footerBtnTxt: { fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
});
export default SearchBar;
