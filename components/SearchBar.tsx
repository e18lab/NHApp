import { Feather } from "@expo/vector-icons";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CalendarRangePicker } from "@/components/CalendarRangePicker";
import { useDrawer } from "@/components/DrawerContext";
import NhModal from "@/components/nhModal";
import { FilterDropdown } from "@/components/uikit/FilterDropdown";
import type { SelectItem } from "@/components/uikit/FilterDropdown";
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
  disabled,
  children,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.iconBtnRound,
        (pressed && !disabled) && { backgroundColor: colors.accent + "22" },
        disabled && { opacity: 0.6 },
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
  const {
    uploaded,
    customRangeLabel,
    lastCustomFrom,
    lastCustomTo,
    setUploaded,
    setLastCustomRange,
    clearUploaded,
  } = useDateRange();
  const { t } = useI18n();

  const PRESETS: {
    key: SortKey;
    label: string;
    icon?: keyof typeof Feather.glyphMap;
  }[] = [
    { key: "date", label: t("explore.sort.latest") || "Новое", icon: "clock" },
    {
      key: "popular-today",
      label: t("explore.sort.popularToday") || "Сегодня",
      icon: "sun",
    },
    {
      key: "popular-week",
      label: t("explore.sort.popularWeek") || "Неделя",
      icon: "calendar",
    },
    {
      key: "popular-month",
      label: t("explore.sort.popularMonth") || "Месяц",
      icon: "calendar",
    },
    {
      key: "popular",
      label: t("explore.sort.popular") || "Горячее",
      icon: "trending-up",
    },
  ];

  const params = useGlobalSearchParams<{
    query?: string | string[];
    id?: string | string[];
    title?: string | string[];
    slug?: string | string[];
  }>();
  const q = typeof params.query === "string" ? params.query : "";
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const bookId = typeof rawId === "string" ? rawId : undefined;
  const rawTitle = Array.isArray(params.title) ? params.title[0] : params.title;
  const bookTitle = typeof rawTitle === "string" ? rawTitle : undefined;
  const rawSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const userName =
    typeof rawSlug === "string" ? decodeURIComponent(rawSlug) : undefined;

  function getTitle(
    pathname: string | null | undefined,
    q: string,
    bookTitle?: string,
    bookId?: string
  ) {
    const p = pathname ?? "";
    const has = (seg: string) => new RegExp(`(^|/)${seg}(\\/|$)`).test(p);
    if (p === "/" || has("index")) return t("menu.home");
    if (has("explore"))
      return q ? t("search.results") + ": " + q : t("menu.explore");
    if (has("favorites")) return t("menu.favorites");
    if (has("favoritesOnline")) return t("menu.favoritesOnline");
    if (has("downloaded")) return t("menu.downloaded");
    if (has("recommendations")) return t("menu.recommendations");
    if (has("history")) return t("menu.history");
    if (has("characters")) return t("menu.characters");
    if (has("settings")) return t("menu.settings");
    if (has("book")) return `#${bookId} - ${bookTitle}`;
    if (has("search"))
      return q ? t("menu.search") + ": " + q : t("menu.search");
    if (has("tags")) return t("menu.tags");
    if (has("profile")) return `${t("menu.profile")}: ${userName}`;
    return "NHApp";
  }

  const [backOpen, setBackOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const rotationAnim = useRef(new Animated.Value(0)).current;

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
    hasSeg(pathname, "characters") ||
    hasSeg(pathname, "favorites") ||
    hasSeg(pathname, "favoritesOnline");


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

  const hasDateFilter = !!uploaded;

  /** "Within last X" — use uploaded:<X so API returns only recent content */
  const DATE_PRESETS: { value: string; label: string }[] = [
    { value: "<1h", label: t("explore.date.1h") || "1 час" },
    { value: "<24h", label: t("explore.date.24h") || "24 часа" },
    { value: "<3d", label: t("explore.date.3d") || "3 дня" },
    { value: "<7d", label: t("explore.date.7d") || "Неделя" },
    { value: "<30d", label: t("explore.date.30d") || "Месяц" },
    { value: "<90d", label: t("explore.date.90d") || "3 месяца" },
    { value: "<180d", label: t("explore.date.180d") || "6 месяцев" },
    { value: "<365d", label: t("explore.date.1y") || "Год" },
  ];

  const dayMs = 24 * 60 * 60 * 1000;

  const applyCalendarRange = (fromDate: Date, toDate: Date) => {
    const now = Date.now();
    const fromDaysAgo = Math.floor((now - fromDate.getTime()) / dayMs);
    const toDaysAgo = Math.floor((now - toDate.getTime()) / dayMs);
    const rangeQuery = `uploaded:>${toDaysAgo - 1}d uploaded:<${fromDaysAgo + 1}d`;
    const fromStr = fromDate.getDate().toString().padStart(2, "0") + "." + (fromDate.getMonth() + 1).toString().padStart(2, "0") + "." + fromDate.getFullYear();
    const toStr = toDate.getDate().toString().padStart(2, "0") + "." + (toDate.getMonth() + 1).toString().padStart(2, "0") + "." + toDate.getFullYear();
    setUploaded(rangeQuery, `${fromStr} – ${toStr}`);
    setLastCustomRange(
      fromDate.toISOString().slice(0, 10),
      toDate.toISOString().slice(0, 10)
    );
  };

  const dateSubmenuItems: SelectItem[] = [
    {
      type: "submenu" as const,
      label: t("explore.date.customRange") || "Указать даты…",
      icon: (c: string) => <Feather name="calendar" size={15} color={c} />,
      children: [
        {
          type: "custom" as const,
          label: t("explore.dateRangeCustom") || "Диапазон дат",
          backLabel: t("explore.date.backToDateList") || "Назад к выбору дат",
          content: ({ onClose, openSubmenu }) => (
            <CalendarRangePicker
              onApply={applyCalendarRange}
              onClose={onClose}
              onReset={() => {
                clearUploaded();
                onClose();
              }}
              openSubmenu={openSubmenu}
              initialFrom={lastCustomFrom}
              initialTo={lastCustomTo}
            />
          ),
        },
      ],
    },
    ...DATE_PRESETS.map(({ value: v, label }) => ({
      value: v,
      label,
    })),
  ];

  const uploadedLabel =
    DATE_PRESETS.find((p) => p.value === uploaded)?.label ??
    (uploaded && uploaded.startsWith("uploaded:")
      ? (customRangeLabel || (t("explore.dateRangeCustom") || "Диапазон дат"))
      : null);

  const sortSelectItems: SelectItem[] = [
    ...PRESETS.map(({ key, label, icon }) => ({
      value: key,
      label,
      icon: icon
        ? (c: string) => <Feather name={icon as any} size={15} color={c} />
        : undefined,
    })),
    {
      type: "submenu" as const,
      label: hasDateFilter && uploadedLabel ? uploadedLabel : (t("explore.dateRange") || "Фильтр по дате"),
      backLabel: t("explore.date.back") || "Назад",
      icon: (c: string) => <Feather name="calendar" size={15} color={c} />,
      children: dateSubmenuItems,
    },
  ];


  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleRefreshStart = () => {
      setIsRefreshing(true);
      rotationAnim.setValue(0);
      const loopAnim = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: false, 
        })
      );
      loopAnim.start();
      (rotationAnim as any)._loopAnim = loopAnim;
    };

    const handleRefreshEnd = () => {
      setIsRefreshing(false);
      const loopAnim = (rotationAnim as any)._loopAnim;
      if (loopAnim) {
        loopAnim.stop();
        delete (rotationAnim as any)._loopAnim;
      }
      rotationAnim.stopAnimation();
      Animated.timing(rotationAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start();
    };

    globalThis.addEventListener?.("app:refresh-content-start", handleRefreshStart);
    globalThis.addEventListener?.("app:refresh-content-end", handleRefreshEnd);

    return () => {
      globalThis.removeEventListener?.("app:refresh-content-start", handleRefreshStart);
      globalThis.removeEventListener?.("app:refresh-content-end", handleRefreshEnd);
      const loopAnim = (rotationAnim as any)._loopAnim;
      if (loopAnim) {
        loopAnim.stop();
      }
      rotationAnim.stopAnimation();
    };
  }, [rotationAnim]);

  const refreshIconStyle = useMemo(() => {
    const rotate = rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
    return {
      transform: [{ rotate }],
    };
  }, [rotationAnim]);

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

        <Text
          numberOfLines={1}
          style={[styles.title, { color: colors.searchTxt }]}
        >
          {title}
        </Text>

        {!hideRight && (
          <View style={styles.rightGroup}>
            {Platform.OS === "web" && (
              <IconBtn
                onPress={() => {
                  if (isRefreshing) return; 
                  if (typeof globalThis !== "undefined") {
                    globalThis.dispatchEvent?.(
                      new globalThis.CustomEvent("app:refresh-content")
                    );
                  }
                }}
                disabled={isRefreshing}
              >
                <Animated.View style={refreshIconStyle}>
                  <Feather 
                    name="refresh-cw" 
                    size={18} 
                    color={isRefreshing ? colors.accent : colors.searchTxt}
                  />
                </Animated.View>
              </IconBtn>
            )}

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

            <FilterDropdown
              value={uploaded ?? sort}
              secondaryValue={uploaded ? sort : undefined}
              onChange={(val) => {
                const isDatePreset = DATE_PRESETS.some((p) => p.value === val);
                if (isDatePreset) {
                  setUploaded(val === uploaded ? null : val);
                } else {
                  setSort(val as SortKey);
                }
              }}
              options={sortSelectItems}
              keepOpen
              trigger={({ onPress }) => (
                <IconBtn onPress={onPress}>
                  <Feather name="filter" size={18} color={colors.accent} />
                </IconBtn>
              )}
            />

            <IconBtn onPress={() => router.push("/tags")}>
              <Feather name="tag" size={18} color={colors.accent} />
            </IconBtn>
          </View>
        )}
      </Animated.View>

      <NhModal
        visible={backOpen}
        onClose={() => setBackOpen(false)}
        sheetStyle={{
          backgroundColor: colors.searchBg,
          borderColor: colors.page,
        }}
        title={t("common.back")}
      >
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: 8 }}
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={[styles.sortRow, styles.rounded]} onPress={backOne}>
            <Text style={[styles.sortTxt, { color: colors.searchTxt }]}>
              {t("searchBar.backOne")}
            </Text>
          </Pressable>
          <Pressable style={[styles.sortRow, styles.rounded]} onPress={backTwo}>
            <Text style={[styles.sortTxt, { color: colors.searchTxt }]}>
              {t("searchBar.backTwo")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.sortRow, styles.rounded]}
            onPress={backHome}
          >
            <Text style={[styles.sortTxt, { color: colors.searchTxt }]}>
              {t("searchBar.backHome")}
            </Text>
          </Pressable>
        </ScrollView>
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

});

export default SearchBar;
