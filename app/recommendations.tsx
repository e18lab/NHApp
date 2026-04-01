import { Feather } from "@expo/vector-icons";
import { requestStoragePush } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useI18n } from "@/lib/i18n/I18nContext";
import { useTheme } from "@/lib/ThemeContext";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Book } from "@/api/nhappApi/types";
import {
  clearRecommendationCache,
  generateRecommendations,
  getCachedRecommendations,
  previewTagCalibrationScore,
  readTagPopularityCalibration,
  tagPopularityMultiplier,
  writeTagPopularityCalibration,
  type ActiveFilter,
  type RecommendationResult,
  type ScoredTerm,
  type TagCalibrationPreviewRow,
} from "@/api/nhappApi/recommendations";
import Slider from "@react-native-community/slider";
import BookList from "@/components/BookList";
import { scrollToTop } from "@/utils/scrollToTop";
import { useGridConfig } from "@/hooks/useGridConfig";
import { useFilterTags } from "@/context/TagFilterContext";

const FAVORITES_KEY = "bookFavorites";

function fmtRatio(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const a = Math.abs(n);
  if (a < 1e-4 && a > 0) return n.toExponential(3);
  if (a < 1) return n.toFixed(6).replace(/\.?0+$/, "");
  return n.toFixed(4).replace(/\.?0+$/, "");
}

function fmtCalibScore(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a > 0 && a < 0.02) return n.toPrecision(4);
  if (a < 100) return n.toFixed(2).replace(/\.?0+$/, "");
  return String(Math.round(n));
}

function TagTermListWithFormula({
  rows,
  calibration,
  label,
  icon,
  sourceBadgeColors,
  sourceLabelKey,
  colors,
}: {
  rows: TagCalibrationPreviewRow[];
  calibration: number;
  label: string;
  icon: string;
  sourceBadgeColors: Record<string, string>;
  sourceLabelKey: Record<string, string>;
  colors: { menuTxt: string; sub: string };
}) {
  const items = useMemo(() => {
    const exp = 1 - Math.max(0, Math.min(1, calibration / 100));
    const scored = rows.map((r) => ({
      ...r,
      display: previewTagCalibrationScore(r.rawScore, r.popularity, calibration),
      atZero: r.rawScore / r.popularity,
      w: tagPopularityMultiplier(r.popularity, calibration),
      exp,
    }));
    scored.sort((a, b) => b.display - a.display);
    return scored.slice(0, 6);
  }, [rows, calibration]);

  const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

  return (
    <View style={styles.termSection}>
      <View style={styles.termHeader}>
        <Feather name={icon as any} size={12} color={colors.sub} />
        <Text style={[styles.termLabel, { color: colors.sub }]}>{label}</Text>
      </View>
      {items.map((row) => (
        <View key={row.name} style={styles.termBlock}>
          <View style={styles.termRow}>
            <Text style={[styles.termName, { color: colors.menuTxt }]} numberOfLines={2}>
              {row.name}
            </Text>
            <View style={styles.termRight}>
              {row.sources.slice(0, 2).map((src) => (
                <View key={src} style={[styles.sourceBadge, { backgroundColor: (sourceBadgeColors[src] ?? "#6b7280") + "33" }]}>
                  <Text style={[styles.sourceBadgeText, { color: sourceBadgeColors[src] ?? "#6b7280" }]}>
                    {sourceLabelKey[src] ?? src}
                  </Text>
                </View>
              ))}
              <Text style={[styles.termScore, { color: colors.sub }]}>{fmtCalibScore(row.display)}</Text>
            </View>
          </View>
          <Text style={[styles.termFormula, { color: colors.sub + "cc", fontFamily: mono }]} selectable>
            {`${row.rawScore}/(${row.popularity}^${row.exp.toFixed(3)})=${fmtCalibScore(row.display)} · w=${fmtRatio(row.w)}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── "How it works" modal ─────────────────────────────────────────────────────

function HowItWorksModal({
  visible,
  onClose,
  result,
  coldStart,
  tagPopCalibration,
  onTagPopCalibrationCommit,
}: {
  visible: boolean;
  onClose: () => void;
  result: RecommendationResult | null;
  coldStart: boolean;
  tagPopCalibration: number;
  onTagPopCalibrationCommit: (value: number) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const profile = result?.profile ?? null;
  const [localTagCal, setLocalTagCal] = useState(tagPopCalibration);

  useEffect(() => {
    setLocalTagCal(tagPopCalibration);
  }, [tagPopCalibration, visible]);

  const sourceBadgeColors: Record<string, string> = {
    tagFavs: "#a855f7",
    localFavorites: "#ec4899",
    onlineFavorites: "#3b82f6",
    readHistory: "#f59e0b",
    searchHistory: "#6b7280",
  };

  const sourceLabelKey: Record<string, string> = {
    tagFavs: t("recommendations.modal.tagFavs"),
    localFavorites: t("recommendations.modal.favs"),
    onlineFavorites: t("recommendations.modal.onlineFavs"),
    readHistory: t("recommendations.modal.readHist"),
    searchHistory: t("recommendations.modal.searchHist"),
  };

  const pagePref = profile?.pagePreference ?? null;
  const yearPref = profile?.yearPreference ?? null;
  const filterIncludes: ActiveFilter[] = result?.filterIncludes ?? [];
  const filterExcludes: ActiveFilter[] = result?.filterExcludes ?? [];

  const fallbackTagTerms: ScoredTerm[] = useMemo(
    () => (profile?.tags ?? []).slice(0, 6),
    [profile?.tags]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: "#00000088" }]}
          onPress={onClose}
        />
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.page, borderColor: colors.sub + "33" },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.sub + "44" }]} />

          <View style={styles.modalHeader}>
            <Feather name="cpu" size={20} color={colors.accent} />
            <Text style={[styles.modalTitle, { color: colors.menuTxt }]}>
              {t("recommendations.modal.title")}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Feather name="x" size={20} color={colors.sub} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Data sources ─────────────────────────────────────────── */}
            <SectionLabel label={t("recommendations.modal.dataSection")} colors={colors} />
            {profile ? (
              <View style={styles.dataGrid}>
                <DataRow icon="heart" label={t("recommendations.modal.favs")} value={String(profile.totalLocalFavorites)} colors={colors} />
                <DataRow icon="cloud" label={t("recommendations.modal.onlineFavs")} value={String(profile.totalOnlineFavorites)} colors={colors} />
                <DataRow icon="book-open" label={t("recommendations.modal.readHist")} value={String(profile.totalReadHistory)} colors={colors} />
                <DataRow icon="star" label={t("recommendations.modal.tagFavs")} value={String(profile.totalTagFavs)} colors={colors} />
                <DataRow icon="search" label={t("recommendations.modal.searchHist")} value={String(profile.totalSearchHistory)} colors={colors} />
              </View>
            ) : (
              <Text style={[styles.dimText, { color: colors.sub }]}>{t("recommendations.loading")}</Text>
            )}

            {coldStart && profile && (
              <View
                style={[
                  styles.coldStartBox,
                  { backgroundColor: colors.accent + "14", borderColor: colors.accent + "44" },
                ]}
              >
                <Feather name="info" size={14} color={colors.accent} style={{ marginTop: 2 }} />
                <Text style={[styles.coldStartText, { color: colors.menuTxt }]}>
                  {t("recommendations.modal.coldStartHint")}
                </Text>
              </View>
            )}

            {/* ── Active tag filters ───────────────────────────────────── */}
            {(filterIncludes.length > 0 || filterExcludes.length > 0) && (
              <>
                <SectionLabel label={t("recommendations.modal.filtersSection")} colors={colors} mt={20} />
                <View style={[styles.filterBox, { backgroundColor: colors.bg, borderColor: colors.sub + "22" }]}>
                  {filterIncludes.map((f) => (
                    <FilterPill key={`inc:${f.type}:${f.name}`} f={f} mode="include" label={t("recommendations.modal.filterInclude")} colors={colors} />
                  ))}
                  {filterExcludes.map((f) => (
                    <FilterPill key={`exc:${f.type}:${f.name}`} f={f} mode="exclude" label={t("recommendations.modal.filterExclude")} colors={colors} />
                  ))}
                </View>
              </>
            )}

            {/* ── Page preference ──────────────────────────────────────── */}
            {pagePref && (
              <>
                <SectionLabel label={t("recommendations.modal.pageSection")} colors={colors} mt={20} />
                <View
                  style={[styles.infoBox, { backgroundColor: colors.bg, borderColor: colors.sub + "22" }]}
                >
                  <View style={styles.infoRow}>
                    <Feather name="file-text" size={13} color={colors.sub} />
                    <Text style={[styles.infoLabel, { color: colors.sub }]}>
                      {t("recommendations.modal.pageAvg")}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.menuTxt }]}>
                      {pagePref.avg} {t("recommendations.modal.pages")}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Feather name="sliders" size={13} color={colors.sub} />
                    <Text style={[styles.infoLabel, { color: colors.sub }]}>
                      {t("recommendations.modal.pageRange")}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.menuTxt }]}>
                      {pagePref.minPreferred}–{pagePref.maxPreferred}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Feather name="align-left" size={13} color={colors.sub} />
                    <Text style={[styles.infoLabel, { color: colors.sub }]}>
                      {t("recommendations.modal.pageTendency")}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.accent }]}>
                      {t(`recommendations.modal.pageLabel.${pagePref.label}`)}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* ── Year preference ──────────────────────────────────────── */}
            {yearPref && yearPref.topYears.length > 0 && (
              <>
                <SectionLabel label={t("recommendations.modal.yearSection")} colors={colors} mt={20} />
                <View
                  style={[styles.infoBox, { backgroundColor: colors.bg, borderColor: colors.sub + "22" }]}
                >
                  {yearPref.topYears.map((year, i) => (
                    <View key={year} style={styles.infoRow}>
                      <Feather
                        name="calendar"
                        size={13}
                        color={i === 0 ? colors.accent : colors.sub}
                      />
                      <Text style={[styles.infoLabel, { color: colors.sub }]}>
                        {year}
                      </Text>
                      <Text style={[styles.infoValue, { color: i === 0 ? colors.accent : colors.menuTxt }]}>
                        {yearPref.yearCounts[year]} {t("recommendations.modal.books")}
                        {i === 0 ? " ★" : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* ── Tag popularity calibration (above detected preferences) ─ */}
            <SectionLabel label={t("recommendations.modal.tagPopCalibration")} colors={colors} mt={20} />
            <Text style={[styles.calibHint, { color: colors.sub }]}>
              {t("recommendations.modal.tagPopCalibrationHint")}
            </Text>
            <View style={[styles.calibSliderWrap, { backgroundColor: colors.bg, borderColor: colors.sub + "22" }]}>
              <View style={styles.calibEnds}>
                <Text style={[styles.calibEndText, { color: colors.sub }]}>
                  {t("recommendations.modal.tagPopCalibrationLow")}
                </Text>
                <Text style={[styles.calibValue, { color: colors.accent }]}>{Math.round(localTagCal)}</Text>
                <Text style={[styles.calibEndText, { color: colors.sub }]}>
                  {t("recommendations.modal.tagPopCalibrationHigh")}
                </Text>
              </View>
              <Slider
                style={styles.calibSlider}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={localTagCal}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.sub + "33"}
                thumbTintColor={colors.accent}
                onValueChange={setLocalTagCal}
                onSlidingComplete={(v) => onTagPopCalibrationCommit(Math.round(v))}
              />
            </View>

            {/* ── Top preferences ──────────────────────────────────────── */}
            {profile && (
              <>
                <SectionLabel label={t("recommendations.modal.topPrefs")} colors={colors} mt={20} />
                {profile.tagCalibrationPreview && profile.tagCalibrationPreview.length > 0 ? (
                  <TagTermListWithFormula
                    rows={profile.tagCalibrationPreview}
                    calibration={localTagCal}
                    label={t("recommendations.modal.tags")}
                    icon="tag"
                    sourceBadgeColors={sourceBadgeColors}
                    sourceLabelKey={sourceLabelKey}
                    colors={colors}
                  />
                ) : fallbackTagTerms.length > 0 ? (
                  <TermList label={t("recommendations.modal.tags")} icon="tag" terms={fallbackTagTerms} sourceBadgeColors={sourceBadgeColors} sourceLabelKey={sourceLabelKey} colors={colors} />
                ) : null}
                {profile.artists.length > 0 && (
                  <TermList label={t("recommendations.modal.artists")} icon="pen-tool" terms={profile.artists.slice(0, 4)} sourceBadgeColors={sourceBadgeColors} sourceLabelKey={sourceLabelKey} colors={colors} />
                )}
                {profile.parodies.length > 0 && (
                  <TermList label={t("recommendations.modal.parodies")} icon="film" terms={profile.parodies.slice(0, 3)} sourceBadgeColors={sourceBadgeColors} sourceLabelKey={sourceLabelKey} colors={colors} />
                )}
              </>
            )}

            {/* ── Queries used ─────────────────────────────────────────── */}
            {result && result.queriesUsed.length > 0 && (
              <>
                <SectionLabel label={t("recommendations.modal.queriesSection")} colors={colors} mt={20} />
                <View style={[styles.queryBox, { backgroundColor: colors.bg, borderColor: colors.sub + "22" }]}>
                  {result.queriesUsed.map((q, i) => (
                    <Text key={i} style={[styles.queryLine, { color: colors.sub }]}>
                      {"› "}{q}
                    </Text>
                  ))}
                  {result && (
                    <Text style={[styles.queryLine, { color: colors.sub + "88", marginTop: 4 }]}>
                      {t("recommendations.modal.generation")} #{result.refreshGeneration + 1}
                    </Text>
                  )}
                </View>
              </>
            )}

            {/* ── Algorithm ─────────────────────────────────────────────── */}
            <SectionLabel label={t("recommendations.modal.algorithm")} colors={colors} mt={20} />
            <Text style={[styles.algorithmText, { color: colors.sub }]}>
              {coldStart
                ? t("recommendations.modal.algorithmColdDesc")
                : t("recommendations.modal.algorithmDesc")}
            </Text>

            {/* ── Diversity note ────────────────────────────────────────── */}
            <View style={[styles.noteBox, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "44" }]}>
              <Feather name="refresh-cw" size={13} color={colors.accent} />
              <Text style={[styles.noteText, { color: colors.accent }]}>
                {t("recommendations.modal.refreshNote")}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FilterPill({ f, mode, label, colors }: { f: ActiveFilter; mode: "include" | "exclude"; label: string; colors: any }) {
  const isInclude = mode === "include";
  const color = isInclude ? "#22c55e" : "#ef4444";
  return (
    <View style={[styles.filterPill, { backgroundColor: color + "18", borderColor: color + "44" }]}>
      <Feather name={isInclude ? "check-circle" : "x-circle"} size={11} color={color} />
      <Text style={[styles.filterPillMode, { color }]}>{label}</Text>
      <Text style={[styles.filterPillType, { color: colors.sub }]}>{f.type}</Text>
      <Text style={[styles.filterPillName, { color: colors.menuTxt }]} numberOfLines={1}>{f.name}</Text>
    </View>
  );
}

function SectionLabel({ label, colors, mt }: { label: string; colors: any; mt?: number }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.accent, marginTop: mt ?? 0 }]}>
      {label}
    </Text>
  );
}

function DataRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={styles.dataRow}>
      <Feather name={icon as any} size={14} color={colors.sub} style={{ marginRight: 6 }} />
      <Text style={[styles.dataLabel, { color: colors.sub }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: colors.menuTxt }]}>{value}</Text>
    </View>
  );
}

function TermList({ label, icon, terms, sourceBadgeColors, sourceLabelKey, colors }: {
  label: string; icon: string;
  terms: { name: string; score: number; sources: string[] }[];
  sourceBadgeColors: Record<string, string>;
  sourceLabelKey: Record<string, string>;
  colors: any;
}) {
  return (
    <View style={styles.termSection}>
      <View style={styles.termHeader}>
        <Feather name={icon as any} size={12} color={colors.sub} />
        <Text style={[styles.termLabel, { color: colors.sub }]}>{label}</Text>
      </View>
      {terms.map((term) => (
        <View key={term.name} style={styles.termRow}>
          <Text style={[styles.termName, { color: colors.menuTxt }]} numberOfLines={1}>
            {term.name}
          </Text>
          <View style={styles.termRight}>
            {term.sources.slice(0, 2).map((src) => (
              <View key={src} style={[styles.sourceBadge, { backgroundColor: (sourceBadgeColors[src] ?? "#6b7280") + "33" }]}>
                <Text style={[styles.sourceBadgeText, { color: sourceBadgeColors[src] ?? "#6b7280" }]}>
                  {sourceLabelKey[src] ?? src}
                </Text>
              </View>
            ))}
            <Text style={[styles.termScore, { color: colors.sub }]}>
              {Math.round(term.score)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RecommendationsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const gridConfig = useGridConfig();

  const { epoch } = useFilterTags();

  const [books, setBooks] = useState<Book[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [tagPopCalibration, setTagPopCalibration] = useState(100);
  const scrollRef = useRef<FlatList<Book> | null>(null);
  const loadingRef = useRef(false);
  /** Last filter epoch applied on this screen — used to refresh only when filters change, not on every focus. */
  const appliedEpochRef = useRef<number | null>(null);

  const loadFavorites = useCallback(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then((j) => {
      const arr: number[] = j ? JSON.parse(j) : [];
      setFavorites(new Set(arr));
    });
  }, []);

  useFocusEffect(loadFavorites);

  useEffect(() => {
    readTagPopularityCalibration().then(setTagPopCalibration);
  }, []);

  const loadRecommendations = useCallback(async (forceRefresh = false) => {
    if (loadingRef.current) return;

    if (!forceRefresh) {
      const cached = getCachedRecommendations();
      if (cached) {
        setResult(cached);
        setBooks(cached.books);
        return;
      }
    }

    loadingRef.current = true;

    if (forceRefresh) {
      clearRecommendationCache();
      setBooks([]);
    }

    setLoading(true);
    try {
      const rec = await generateRecommendations();
      setResult(rec);
      setBooks(rec.books);
    } catch (e) {
      console.error("[recommendations] generate failed:", e);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  const onTagPopCalibrationCommit = useCallback(
    async (value: number) => {
      await writeTagPopularityCalibration(value);
      setTagPopCalibration(value);
      clearRecommendationCache();
      await loadRecommendations(true);
    },
    [loadRecommendations]
  );

  // Load once or restore from module cache; only bust cache when filters (epoch) change — not when returning from a book/tags.
  useFocusEffect(
    useCallback(() => {
      const first = appliedEpochRef.current === null;
      const filtersChanged = !first && appliedEpochRef.current !== epoch;
      appliedEpochRef.current = epoch;
      loadRecommendations(filtersChanged);
    }, [loadRecommendations, epoch])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecommendations(true);
    setRefreshing(false);
    scrollToTop(scrollRef);
  }, [loadRecommendations]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleRefresh = async () => {
      globalThis.dispatchEvent?.(new globalThis.CustomEvent("app:refresh-content-start"));
      try { await onRefresh(); }
      finally { globalThis.dispatchEvent?.(new globalThis.CustomEvent("app:refresh-content-end")); }
    };
    globalThis.addEventListener?.("app:refresh-content", handleRefresh);
    return () => globalThis.removeEventListener?.("app:refresh-content", handleRefresh);
  }, [onRefresh]);

  const toggleFavorite = useCallback((id: number, next: boolean) => {
    setFavorites((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...copy]));
      requestStoragePush();
      return copy;
    });
  }, []);

  const hasNoSignals =
    result !== null &&
    result.books.length === 0 &&
    result.profile.totalLocalFavorites === 0 &&
    result.profile.totalOnlineFavorites === 0 &&
    result.profile.totalReadHistory === 0 &&
    result.profile.totalTagFavs === 0 &&
    result.profile.totalSearchHistory === 0;

  const emptyKey = hasNoSignals ? "noFav" : "default";

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: colors.bg, borderBottomColor: colors.sub + "22" }]}>
        <Pressable onPress={() => setModalVisible(true)} style={styles.howBtn} hitSlop={8}>
          <Feather name="info" size={14} color={colors.sub} />
          <Text style={[styles.howBtnText, { color: colors.sub }]}>
            {t("recommendations.howItWorks")}
          </Text>
        </Pressable>
        {result && books.length > 0 && (
          <Text style={[styles.countText, { color: colors.sub }]}>{books.length}</Text>
        )}
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.sub }]}>
            {t("recommendations.loading")}
          </Text>
        </View>
      )}

      {/* Book list — classic card */}
      {!loading && (
        <BookList
          data={books}
          loading={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isFavorite={(id) => favorites.has(id)}
          onToggleFavorite={toggleFavorite}
          onPress={(id) =>
            router.push({
              pathname: "/book/[id]",
              params: { id: String(id), title: books.find((b) => b.id === id)?.title.pretty },
            })
          }
          ListEmptyComponent={
            result !== null ? (
              <View style={styles.emptyWrap}>
                <Feather name="star" size={40} color={colors.sub + "66"} />
                <Text style={[styles.emptyTitle, { color: colors.menuTxt }]}>
                  {t(`recommendations.emptyTitle.${emptyKey}`)}
                </Text>
                <Text style={[styles.emptySub, { color: colors.sub }]}>
                  {t(`recommendations.emptySubtitle.${emptyKey}`)}
                </Text>
              </View>
            ) : null
          }
          gridConfig={{ default: gridConfig }}
          scrollRef={scrollRef}
        />
      )}

      {/* Modal */}
      <HowItWorksModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        result={result}
        coldStart={hasNoSignals}
        tagPopCalibration={tagPopCalibration}
        onTagPopCalibrationCommit={onTagPopCalibrationCommit}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  howBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 2 },
  howBtnText: { fontSize: 13, fontWeight: "500" },
  countText: { fontSize: 12 },

  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, fontWeight: "500" },

  emptyWrap: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", textAlign: "center", marginTop: 8 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 18 },

  calibHint: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  calibSliderWrap: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  calibEnds: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  calibEndText: { fontSize: 11, flex: 1 },
  calibValue: { fontSize: 14, fontWeight: "800", paddingHorizontal: 8 },
  calibSlider: { width: "100%", height: 40 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "88%",
    paddingBottom: 32,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: "700" },
  closeBtn: { padding: 4 },
  modalBody: { paddingHorizontal: 20, paddingBottom: 8 },

  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },

  dataGrid: { gap: 8 },
  coldStartBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginTop: 14,
  },
  coldStartText: { flex: 1, fontSize: 13, lineHeight: 19 },
  dataRow: { flexDirection: "row", alignItems: "center" },
  dataLabel: { flex: 1, fontSize: 13 },
  dataValue: { fontSize: 13, fontWeight: "600" },

  // Info box (page / year sections)
  infoBox: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 8, marginBottom: 2 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoLabel: { flex: 1, fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: "600" },

  // Term lists
  termSection: { marginBottom: 14 },
  termHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  termLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  termBlock: { marginBottom: 10 },
  termRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 2 },
  termName: { flex: 1, fontSize: 13, fontWeight: "500", marginRight: 8 },
  termFormula: { fontSize: 9, lineHeight: 13, marginTop: 2, paddingRight: 4 },
  termRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  sourceBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  sourceBadgeText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  termScore: { fontSize: 11, minWidth: 22, textAlign: "right" },

  queryBox: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 4 },
  queryLine: { fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  algorithmText: { fontSize: 13, lineHeight: 19 },

  noteBox: { flexDirection: "row", alignItems: "flex-start", borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 10, marginTop: 20, gap: 7 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  dimText: { fontSize: 13 },

  filterBox: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 8, gap: 6 },
  filterPill: { flexDirection: "row", alignItems: "center", borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 5, gap: 5 },
  filterPillMode: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  filterPillType: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  filterPillName: { flex: 1, fontSize: 12, fontWeight: "500" },
});
