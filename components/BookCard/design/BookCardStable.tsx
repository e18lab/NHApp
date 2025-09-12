// components/BookCard/design/BookCardStable.tsx
import { useI18n } from "@/lib/i18n/I18nContext";
import { AntDesign, Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { enUS, ja, ru, zhCN } from "date-fns/locale";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  ImageStyle,
  InteractionManager,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Book, Tag } from "@/api/nhentai";
import SmartImage from "@/components/SmartImage";
import { buildImageFallbacks } from "@/components/buildImageFallbacks";
import { useFilterTags } from "@/context/TagFilterContext";
import { useTheme } from "@/lib/ThemeContext";
import { makeCardStyles } from "../BookCard.styles";

const FAV_KEY = "bookFavorites";
const READ_HISTORY_KEY = "readHistory";
type ReadHistoryEntry = [number, number, number, number];
type HistoryState = { current: number; total: number; ts: number } | null;

const CN_FLAG = require("@/assets/images/flags/CN.png");
const GB_FLAG = require("@/assets/images/flags/GB.png");
const JP_FLAG = require("@/assets/images/flags/JP.png");
const FLAG_MAP: Record<string, any> = {
  chinese: CN_FLAG,
  english: GB_FLAG,
  japanese: JP_FLAG,
};

export interface BookCardStableProps {
  book: Book;
  cardWidth?: number;
  isSingleCol?: boolean;
  contentScale?: number;
  isFavorite?: boolean;
  selectedTags?: Tag[];
  onToggleFavorite?: (id: number, next: boolean) => void;
  onPress?: (id: number) => void;
  score?: number;
  background?: string;
  showProgressOnCard?: boolean;
  favoritesSet?: Set<number>;
  vertical?: boolean | "true" | "false";
  historyMap?: Record<number, { current: number; total: number; ts: number }>;
  hydrateFromStorage?: boolean;
}

function BookCardStableInner({
  book,
  cardWidth = 160,
  isSingleCol = false,
  contentScale = 1,
  isFavorite = false,
  selectedTags = [],
  onToggleFavorite,
  onPress,
  score,
  background,
  showProgressOnCard = true,
  favoritesSet,
  historyMap,
  hydrateFromStorage = false,
}: BookCardStableProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors, cardWidth, contentScale), [colors, cardWidth, contentScale]);

  const { t, resolved } = useI18n();
  const dateLocale = resolved === "ru" ? ru : resolved === "zh" ? zhCN : resolved === "ja" ? ja : enUS;

  const TAG_COLORS = useMemo<Record<string, string>>(
    () => ({
      language: "#FF7D7F",
      artist: "#FB8DF4",
      character: "#F3E17F",
      parody: "#BCEA83",
      group: "#86F0C6",
      category: "#92EFFF",
      tag: (colors as any).tagText ?? "#AAB",
    }),
    [colors]
  );

  const incColor = (colors as any).incTxt ?? colors.accent;
  const excColor = (colors as any).excTxt ?? "#FF5A5F";

  const initialLiked = favoritesSet ? favoritesSet.has(book.id) : isFavorite;
  const [liked, setLiked] = useState<boolean>(initialLiked);
  const [showAllTags, setShowAllTags] = useState(false);
  const [rh, setRh] = useState<HistoryState>(() => (historyMap && historyMap[book.id] ? historyMap[book.id] : null));

  useEffect(() => {
    if (favoritesSet) setLiked(favoritesSet.has(book.id));
  }, [favoritesSet, book.id]);

  useEffect(() => {
    if (historyMap && historyMap[book.id]) setRh(historyMap[book.id]);
  }, [historyMap, book.id]);

  useEffect(() => {
    if (!hydrateFromStorage || favoritesSet || historyMap) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        if (cancelled) return;
        const [favRaw, histRaw] = await Promise.all([AsyncStorage.getItem(FAV_KEY), AsyncStorage.getItem(READ_HISTORY_KEY)]);
        if (cancelled) return;
        const favArr: number[] = favRaw ? JSON.parse(favRaw) : [];
        setLiked(favArr.includes(book.id));
        if (histRaw) {
          try {
            const parsed = JSON.parse(histRaw) as ReadHistoryEntry[];
            const found = parsed.find((e) => e?.[0] === book.id);
            if (found) {
              const [, current, total, ts] = found;
              const t = Math.max(1, Number(total) || book.pagesCount || 1);
              const c = Math.min(Math.max(0, Number(current) || 0), t - 1);
              const ti = Number(ts) || Math.floor(Date.now() / 1000);
              setRh({ current: c, total: t, ts: ti });
            } else {
              setRh(null);
            }
          } catch {
            setRh(null);
          }
        } else {
          setRh(null);
        }
      } catch {}
    });
    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [hydrateFromStorage, favoritesSet, historyMap, book.id, book.pagesCount]);

  const toggleLike = useCallback(async () => {
    if (favoritesSet) {
      const next = !liked;
      setLiked(next);
      onToggleFavorite?.(book.id, next);
      return;
    }
    setLiked((prev) => !prev);
    onToggleFavorite?.(book.id, !liked);
    try {
      const raw = await AsyncStorage.getItem(FAV_KEY);
      const arr: number[] = raw ? JSON.parse(raw) : [];
      const has = arr.includes(book.id);
      const nextArr = has ? arr.filter((x) => x !== book.id) : [...arr, book.id];
      await AsyncStorage.setItem(FAV_KEY, JSON.stringify(nextArr));
    } catch {}
  }, [book.id, liked, onToggleFavorite, favoritesSet]);

  const maxTags = cardWidth < 110 ? 1 : cardWidth < 250 ? 2 : cardWidth < 400 ? 3 : 4;

  const { filters } = useFilterTags();
  const filtersLookup = useMemo(() => {
    const m = new Map<string, "include" | "exclude" | undefined>();
    for (const f of filters) m.set(`${f.type}:${f.name}`, f.mode === "include" ? "include" : f.mode === "exclude" ? "exclude" : undefined);
    return m;
  }, [filters]);

  const modeOf = useCallback((t: { type: string; name: string }): "include" | "exclude" | undefined => {
    return filtersLookup.get(`${t.type}:${t.name}`);
  }, [filtersLookup]);

  const orderedTags = useMemo(() => {
    if (!book.tags?.length) return [] as Tag[];
    const uniq = new Map<number, Tag>();
    for (const t of book.tags) uniq.set(t.id, t);
    const order = ["artist", "character", "parody", "group", "category", "tag"];
    const all = Array.from(uniq.values());
    const res: Tag[] = [];
    for (const tp of order) for (const v of all) if (v.type === tp) res.push(v);
    return res;
  }, [book.tags]);

  const visibleTags = useMemo(() => (showAllTags ? orderedTags : orderedTags.slice(0, maxTags)), [orderedTags, showAllTags, maxTags]);

  const selectedIdSet = useMemo(() => new Set(selectedTags.map((t) => t.id)), [selectedTags]);
  const capFirstTwo = !showAllTags && visibleTags.length >= 2;

  const collapsedMaxFor = useCallback((index: number, len: number) => {
    if (len <= 1) return Math.max(90, Math.round(cardWidth * 0.88));
    if (len === 2) return Math.max(90, Math.round(cardWidth * 0.44));
    if (index < 2) return Math.max(90, Math.round(cardWidth * 0.4));
    return Math.max(70, Math.round(cardWidth * 0.28));
  }, [cardWidth]);

  const variants = useMemo(() => buildImageFallbacks(book.thumbnail), [book.thumbnail]);

  const primaryLang = useMemo(() => {
    if (!book.languages?.length) return undefined;
    const base = book.languages[0].name.toLowerCase();
    if (base === "translated" && book.languages[1]) return book.languages[1].name.toLowerCase();
    return base;
  }, [book.languages]);

  const flagSrc = primaryLang ? FLAG_MAP[primaryLang] : undefined;

  const heartSize = Math.max(16, Math.round(cardWidth * 0.12 * contentScale));
  const favsDisplay = book.favorites;

  const progress = useMemo(() => {
    if (!rh) return null;
    const done = rh.current >= rh.total - 1;
    const ratio = Math.max(0, Math.min(1, (rh.current + 1) / rh.total));
    return { done, ratio, currentDisp: rh.current + 1, total: rh.total, ts: rh.ts };
  }, [rh]);

  const isNew = useMemo(() => {
    const uploaded = new Date(book.uploaded).getTime();
    return uploaded > Date.now() - 86_400_000;
  }, [book.uploaded]);

  const dateText = useMemo(() => format(new Date(book.uploaded), "d MMM yyyy", { locale: dateLocale }), [book.uploaded, dateLocale]);

  const cardWrap = useMemo<StyleProp<ViewStyle>>(() => {
    const out: Array<StyleProp<ViewStyle>> = [styles.card];
    if (background) out.push({ backgroundColor: background });
    if (isSingleCol) out.push({ alignSelf: "stretch" });
    return out;
  }, [styles.card, background, isSingleCol]);

  const imageWrap = useMemo<StyleProp<ViewStyle>>(() => {
    if (isSingleCol) return [styles.imageWrap, { aspectRatio: 0.7, height: undefined }];
    return styles.imageWrap;
  }, [isSingleCol, styles.imageWrap]);

  const cover = useMemo<StyleProp<ImageStyle>>(() => {
    if (isSingleCol) return [styles.cover, { aspectRatio: 0.68, height: undefined }];
    return styles.cover;
  }, [isSingleCol, styles.cover]);

  const progressTrack = useMemo<ViewStyle>(() => ({ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, backgroundColor: "#00000055" }), []);

  const progressFill = useCallback(
    (ratio: number): ViewStyle => ({ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round(ratio * 100)}%`, backgroundColor: colors.accent }),
    [colors.accent]
  );

  const onPressCard = useCallback(() => onPress?.(book.id), [onPress, book.id]);

  return (
    <Pressable style={cardWrap} onPress={onPressCard}>
      <View style={imageWrap}>
        <SmartImage sources={variants} style={cover} />
        <LinearGradient colors={["#00000000", `${colors.bg}40`, `${colors.bg}99`]} style={styles.coverGradient} pointerEvents="none" />
        {isNew && <Text style={styles.newBadge}>{t("book.new")}</Text>}
        {flagSrc && (
          <View style={styles.langBadge}>
            <Image source={flagSrc} style={styles.langImg} resizeMode="cover" />
          </View>
        )}
        {onToggleFavorite && (
          <View style={styles.favWrap}>
            <Pressable style={styles.favBtn} hitSlop={6} onPress={toggleLike}>
              <AntDesign name={liked ? "heart" : "hearto"} size={heartSize} color={liked ? "#ff5a5f" : "#fff"} />
            </Pressable>
            <Text style={styles.favCount}>{favsDisplay}</Text>
          </View>
        )}
        {showProgressOnCard && progress && !progress.done && (
          <View style={progressTrack}>
            <View style={progressFill(progress.ratio)} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {book.title.pretty}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={styles.metaIcon.fontSize as number} color={styles.metaIcon.color as string} />
            <Text style={styles.metaText}>{dateText}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="book-open" size={styles.metaIcon.fontSize as number} color={styles.metaIcon.color as string} />
            <Text style={styles.metaText}>{book.pagesCount}</Text>
          </View>
          {!onToggleFavorite && (
            <View style={styles.metaItem}>
              <Feather name="heart" size={styles.metaIcon.fontSize as number} color={styles.metaIcon.color as string} />
              <Text style={styles.metaText}>{book.favorites}</Text>
            </View>
          )}
        </View>

        {visibleTags.length > 0 && (
          <View style={styles.tagsRow}>
            <View style={[styles.tagsWrap, showAllTags && styles.tagsWrapExpanded]}>
              {visibleTags.map((tag, i) => {
                const mode = modeOf({ type: tag.type, name: tag.name });
                const borderColor = mode === "include" ? incColor : mode === "exclude" ? excColor : "transparent";
                const maxPx = !showAllTags ? collapsedMaxFor(i, visibleTags.length) : undefined;
                const showRibbon = typeof score === "number" && i === 0;

                return (
                  <React.Fragment key={tag.id}>
                    {showRibbon && (
                      <View style={[styles.ribbon, score! >= 80 ? styles.ribbonBorderGood : score! >= 60 ? styles.ribbonBorderOk : styles.ribbonBorderWarn]}>
                        <Text style={[styles.ribbonText, score! >= 80 ? styles.ribbonGood : score! >= 60 ? styles.ribbonOk : styles.ribbonWarn]}>{score}%</Text>
                      </View>
                    )}

                    <Pressable
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        router.push({
                          pathname: "/explore",
                          params: { query: tag.name, solo: "1", id: String(book.id), title: book.title.pretty },
                        });
                      }}
                      onLongPress={() => Clipboard.setStringAsync(tag.name)}
                    >
                      <View
                        style={[
                          styles.tagPill,
                          showAllTags ? [styles.tagExpanded, styles.tapPillOpen] : styles.tagOneLine,
                          !showAllTags && { maxWidth: maxPx },
                          !showAllTags && capFirstTwo && i < 2 && styles.tagCap50,
                          { borderWidth: 1, borderColor },
                          selectedIdSet.has(tag.id) && styles.tagSelected,
                        ]}
                      >
                        <Text numberOfLines={showAllTags ? undefined : 1} ellipsizeMode={showAllTags ? undefined : "tail"} style={[styles.tagText, { color: TAG_COLORS[tag.type] ?? TAG_COLORS.tag }]}>
                          {tag.name}
                        </Text>
                      </View>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>

            {!showAllTags && book.tags.length > maxTags && (
              <Pressable
                style={styles.plusWrap}
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  setShowAllTags(true);
                }}
              >
                <Text numberOfLines={1} style={[styles.tagPlus, { color: TAG_COLORS.tag }]}>
                  +{book.tags.length - maxTags}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const areEqual = (prev: BookCardStableProps, next: BookCardStableProps) => {
  if (prev.book.id !== next.book.id) return false;
  if (prev.cardWidth !== next.cardWidth) return false;
  if (prev.contentScale !== next.contentScale) return false;
  if (prev.isFavorite !== next.isFavorite) return false;
  if (prev.background !== next.background) return false;
  if (prev.score !== next.score) return false;
  if (prev.showProgressOnCard !== next.showProgressOnCard) return false;

  const prevFav = prev.favoritesSet ? prev.favoritesSet.has(prev.book.id) : prev.isFavorite;
  const nextFav = next.favoritesSet ? next.favoritesSet.has(next.book.id) : next.isFavorite;
  if (prevFav !== nextFav) return false;

  const prevHist = prev.historyMap?.[prev.book.id];
  const nextHist = next.historyMap?.[next.book.id];
  const histChanged =
    (!!prevHist || !!nextHist) &&
    (!prevHist || !nextHist || prevHist.current !== nextHist.current || prevHist.total !== nextHist.total || prevHist.ts !== nextHist.ts);
  if (histChanged) return false;

  if (prev.selectedTags?.length !== next.selectedTags?.length) return false;
  if (prev.selectedTags && next.selectedTags) {
    const a = prev.selectedTags.map((t) => t.id).join(",");
    const b = next.selectedTags.map((t) => t.id).join(",");
    if (a !== b) return false;
  }

  return true;
};

const BookCardStable = memo(BookCardStableInner, areEqual);
export default BookCardStable;
