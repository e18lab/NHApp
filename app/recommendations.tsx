import { Feather } from "@expo/vector-icons";
import { requestStoragePush } from "@/api/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useI18n } from "@/lib/i18n/I18nContext";
import { useTheme } from "@/lib/ThemeContext";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

import type { Book } from "@/api/nhentai";
import {
  clearRecommendationCache,
  generateRecommendations,
  getCachedRecommendations,
  type RecommendationProfile,
  type RecommendationResult,
} from "@/api/nhappApi/recommendations";
import BookList from "@/components/BookList";
import { scrollToTop } from "@/utils/scrollToTop";
import { useGridConfig } from "@/hooks/useGridConfig";

const FAVORITES_KEY = "bookFavorites";

// ─── How-it-works modal ───────────────────────────────────────────────────────

function HowItWorksModal({
  visible,
  onClose,
  result,
}: {
  visible: boolean;
  onClose: () => void;
  result: RecommendationResult | null;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const profile = result?.profile ?? null;

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay]}>
        {/* Backdrop tap-to-close */}
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: "#00000088" }]}
          onPress={onClose}
        />

        {/* Sheet — plain View so ScrollView keeps full gesture control */}
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.page, borderColor: colors.sub + "33" },
          ]}
        >
          {/* Handle */}
          <View
            style={[styles.handle, { backgroundColor: colors.sub + "44" }]}
          />

          {/* Header */}
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
            <Text style={[styles.sectionLabel, { color: colors.accent }]}>
              {t("recommendations.modal.dataSection")}
            </Text>

            {profile ? (
              <View style={styles.dataGrid}>
                <DataRow
                  icon="heart"
                  label={t("recommendations.modal.favs")}
                  value={String(profile.totalLocalFavorites)}
                  colors={colors}
                />
                <DataRow
                  icon="cloud"
                  label={t("recommendations.modal.onlineFavs")}
                  value={String(profile.totalOnlineFavorites)}
                  colors={colors}
                />
                <DataRow
                  icon="book-open"
                  label={t("recommendations.modal.readHist")}
                  value={String(profile.totalReadHistory)}
                  colors={colors}
                />
                <DataRow
                  icon="star"
                  label={t("recommendations.modal.tagFavs")}
                  value={String(profile.totalTagFavs)}
                  colors={colors}
                />
                <DataRow
                  icon="search"
                  label={t("recommendations.modal.searchHist")}
                  value={String(profile.totalSearchHistory)}
                  colors={colors}
                />
              </View>
            ) : (
              <Text style={[styles.dimText, { color: colors.sub }]}>
                {t("recommendations.loading")}
              </Text>
            )}

            {/* ── Top preferences ──────────────────────────────────────── */}
            {profile && (
              <>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: colors.accent, marginTop: 20 },
                  ]}
                >
                  {t("recommendations.modal.topPrefs")}
                </Text>

                {profile.tags.length > 0 && (
                  <TermList
                    label={t("recommendations.modal.tags")}
                    icon="tag"
                    terms={profile.tags.slice(0, 6)}
                    sourceBadgeColors={sourceBadgeColors}
                    sourceLabelKey={sourceLabelKey}
                    colors={colors}
                  />
                )}
                {profile.artists.length > 0 && (
                  <TermList
                    label={t("recommendations.modal.artists")}
                    icon="pen-tool"
                    terms={profile.artists.slice(0, 4)}
                    sourceBadgeColors={sourceBadgeColors}
                    sourceLabelKey={sourceLabelKey}
                    colors={colors}
                  />
                )}
                {profile.parodies.length > 0 && (
                  <TermList
                    label={t("recommendations.modal.parodies")}
                    icon="film"
                    terms={profile.parodies.slice(0, 3)}
                    sourceBadgeColors={sourceBadgeColors}
                    sourceLabelKey={sourceLabelKey}
                    colors={colors}
                  />
                )}
              </>
            )}

            {/* ── Queries used ─────────────────────────────────────────── */}
            {result && result.queriesUsed.length > 0 && (
              <>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: colors.accent, marginTop: 20 },
                  ]}
                >
                  {t("recommendations.modal.queriesSection")}
                </Text>
                <View
                  style={[
                    styles.queryBox,
                    { backgroundColor: colors.bg, borderColor: colors.sub + "22" },
                  ]}
                >
                  {result.queriesUsed.map((q, i) => (
                    <Text
                      key={i}
                      style={[styles.queryLine, { color: colors.sub }]}
                    >
                      {"› "}
                      {q}
                    </Text>
                  ))}
                </View>
              </>
            )}

            {/* ── Algorithm explanation ─────────────────────────────────── */}
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.accent, marginTop: 20 },
              ]}
            >
              {t("recommendations.modal.algorithm")}
            </Text>
            <Text style={[styles.algorithmText, { color: colors.sub }]}>
              {t("recommendations.modal.algorithmDesc")}
            </Text>

            {/* ── Refresh note ─────────────────────────────────────────── */}
            <View
              style={[
                styles.noteBox,
                {
                  backgroundColor: colors.accent + "18",
                  borderColor: colors.accent + "44",
                },
              ]}
            >
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

function DataRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.dataRow}>
      <Feather
        name={icon as any}
        size={14}
        color={colors.sub}
        style={{ marginRight: 6 }}
      />
      <Text style={[styles.dataLabel, { color: colors.sub }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: colors.menuTxt }]}>{value}</Text>
    </View>
  );
}

function TermList({
  label,
  icon,
  terms,
  sourceBadgeColors,
  sourceLabelKey,
  colors,
}: {
  label: string;
  icon: string;
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
          <Text
            style={[styles.termName, { color: colors.menuTxt }]}
            numberOfLines={1}
          >
            {term.name}
          </Text>
          <View style={styles.termRight}>
            {term.sources.slice(0, 2).map((src) => (
              <View
                key={src}
                style={[
                  styles.sourceBadge,
                  {
                    backgroundColor:
                      (sourceBadgeColors[src] ?? "#6b7280") + "33",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sourceBadgeText,
                    { color: sourceBadgeColors[src] ?? "#6b7280" },
                  ]}
                >
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

  const [books, setBooks] = useState<Book[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const scrollRef = useRef<FlatList<Book> | null>(null);
  const loadingRef = useRef(false);

  // Load current favorites state for heart icons
  const loadFavorites = useCallback(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then((j) => {
      const arr: number[] = j ? JSON.parse(j) : [];
      setFavorites(new Set(arr));
    });
  }, []);

  useEffect(loadFavorites, [loadFavorites]);
  useFocusEffect(loadFavorites);

  const loadRecommendations = useCallback(
    async (forceRefresh = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (forceRefresh) {
        clearRecommendationCache();
        setBooks([]);
      }

      // Use cache if available (and not forcing refresh)
      const cached = getCachedRecommendations();
      if (cached && !forceRefresh) {
        setResult(cached);
        setBooks(cached.books);
        loadingRef.current = false;
        return;
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
    },
    []
  );

  useEffect(() => {
    loadRecommendations(false);
  }, [loadRecommendations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecommendations(true);
    setRefreshing(false);
    scrollToTop(scrollRef);
  }, [loadRecommendations]);

  // Web: respond to the global refresh event
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
    result.profile.totalTagFavs === 0;

  const emptyKey = hasNoSignals ? "noFav" : "default";

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      {/* ── Top bar with "How it works" button ──────────────────────────── */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.bg, borderBottomColor: colors.sub + "22" },
        ]}
      >
        <Pressable
          onPress={() => setModalVisible(true)}
          style={styles.howBtn}
          hitSlop={8}
        >
          <Feather name="info" size={14} color={colors.sub} />
          <Text style={[styles.howBtnText, { color: colors.sub }]}>
            {t("recommendations.howItWorks")}
          </Text>
        </Pressable>
        {result && (
          <Text style={[styles.countText, { color: colors.sub }]}>
            {books.length > 0 ? `${books.length}` : ""}
          </Text>
        )}
      </View>

      {/* ── Loading state ─────────────────────────────────────────────── */}
      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.sub }]}>
            {t("recommendations.loading")}
          </Text>
        </View>
      )}

      {/* ── Book list ─────────────────────────────────────────────────── */}
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
              params: {
                id: String(id),
                title: books.find((b) => b.id === id)?.title.pretty,
              },
            })
          }
          ListEmptyComponent={
            result !== null ? (
              <View style={styles.emptyWrap}>
                <Feather name="star" size={40} color={colors.sub + "66"} />
                <Text
                  style={[styles.emptyTitle, { color: colors.menuTxt }]}
                >
                  {t(`recommendations.emptyTitle.${emptyKey}`)}
                </Text>
                <Text
                  style={[styles.emptySub, { color: colors.sub }]}
                >
                  {t(`recommendations.emptySubtitle.${emptyKey}`)}
                </Text>
              </View>
            ) : null
          }
          gridConfig={{ default: gridConfig }}
          scrollRef={scrollRef}
        />
      )}

      {/* ── How it works modal ────────────────────────────────────────── */}
      <HowItWorksModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        result={result}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  howBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  howBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  countText: {
    fontSize: 12,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },

  // Empty
  emptyWrap: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },

  // Modal overlay
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "88%",
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  // Data rows
  dataGrid: {
    gap: 8,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dataLabel: {
    flex: 1,
    fontSize: 13,
  },
  dataValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Term lists
  termSection: {
    marginBottom: 14,
  },
  termHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  termLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  termRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  termName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    marginRight: 8,
  },
  termRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sourceBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  termScore: {
    fontSize: 11,
    minWidth: 22,
    textAlign: "right",
  },

  // Queries box
  queryBox: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 4,
  },
  queryLine: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  // Algorithm
  algorithmText: {
    fontSize: 13,
    lineHeight: 19,
  },

  // Note box
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    marginTop: 20,
    gap: 7,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  dimText: {
    fontSize: 13,
  },
});
