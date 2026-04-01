import raw from "@/api/nhentai-tags.json";
import { useFilterTags } from "@/context/TagFilterContext";
import { useTagLibrary } from "@/context/TagLibraryContext";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import { FlashList, ListRenderItem } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import NhModal from "@/components/nhModal";
import { CollectionsEditor } from "@/components/tags/CollectionsEditor";
import { CollectionsList } from "@/components/tags/CollectionsList";
import { SearchBar } from "@/components/tags/SearchBar";
import { SidebarSelected } from "@/components/tags/SidebarSelected";
import { Tabs } from "@/components/tags/Tabs";
import { TagRow } from "@/components/tags/TagRow";
import {
  rusOf,
  scoreByQuery,
  toPlural,
  toSingular,
} from "@/components/tags/helpers";
import {
  Draft,
  MainTab,
  TagEntry,
  TagItem,
  TagKind,
  TagMode,
} from "@/components/tags/types";
import { useFavs } from "@/components/tags/useFavs";
type TagsDb = {
  tags: TagEntry[];
  artists: TagEntry[];
  characters: TagEntry[];
  parodies: TagEntry[];
  groups: TagEntry[];
};
const db = raw as TagsDb;
const prepare = (t: TagEntry): TagItem => ({
  ...t,
  type: toPlural(String(t.type)),
  enLow: t.name.toLowerCase(),
  ruLow: rusOf(t.name).toLowerCase(),
});
const PRE_SORTED: Record<TagKind, TagEntry[]> = {
  tags: [...db.tags].sort((a, b) => b.count - a.count),
  artists: [...db.artists].sort((a, b) => b.count - a.count),
  characters: [...db.characters].sort((a, b) => b.count - a.count),
  parodies: [...db.parodies].sort((a, b) => b.count - a.count),
  groups: [...db.groups].sort((a, b) => b.count - a.count),
};
const ALL: TagItem[] = [
  ...PRE_SORTED.tags.map(prepare),
  ...PRE_SORTED.artists.map(prepare),
  ...PRE_SORTED.characters.map(prepare),
  ...PRE_SORTED.parodies.map(prepare),
  ...PRE_SORTED.groups.map(prepare),
];
const findTag = (typePlural: string, name: string) =>
  ALL.find((x) => x.type === toPlural(typePlural) && x.name === name);
const useResponsive = () => {
  const win = useWindowDimensions();
  const scr = Dimensions.get("screen");
  const shortest = Math.min(scr.width, scr.height);
  const isTablet = scr.width >= 900 || shortest >= 600;
  return { isTablet, width: win.width };
};
export default function TagsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isTablet } = useResponsive();
  const {
    filters,
    includes,
    excludes,
    cycle,
    clear,
    lastChangedKey,
    epoch,
    filtersReady,
  } = useFilterTags();
  const {
    collections,
    createCollection,
    renameCollection,
    deleteCollection,
    replaceCollectionItems,
  } = useTagLibrary();
  const { isFav, toggleFav, favsHash } = useFavs();
  const globalModeMap = useMemo(() => {
    const m = new Map<string, TagMode>();
    includes.forEach((f) => m.set(`${f.type}:${f.name}`, "include"));
    excludes.forEach((f) => m.set(`${f.type}:${f.name}`, "exclude"));
    return m;
  }, [includes, excludes]);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const h = setTimeout(
      () => setQDebounced(q.trim().toLowerCase()),
      q.length < 3 ? 60 : 120
    );
    return () => clearTimeout(h);
  }, [q]);
  const [tab, setTab] = useState<MainTab>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const buildList = useCallback((base: TagItem[], needle: string) => {
    if (!needle) return base.slice(0, 300);
    const filtered = base.filter(
      (t) => t.enLow.includes(needle) || t.ruLow.includes(needle)
    );
    filtered.sort((a, b) => scoreByQuery(b, needle) - scoreByQuery(a, needle));
    return filtered.slice(0, 300);
  }, []);
  const listAll = useMemo(
    () => buildList(ALL, qDebounced),
    [qDebounced, buildList]
  );
  const listFavs = useMemo(
    () =>
      buildList(
        ALL.filter((t) => isFav({ type: t.type, name: t.name })),
        qDebounced
      ),
    [qDebounced, isFav, buildList]
  );
  const activeList: TagItem[] = tab === "favs" ? listFavs : listAll;
  const filteredCollections = useMemo(() => {
    const n = qDebounced;
    if (!n) return collections;
    return collections.filter((c) => (c.name || "").toLowerCase().includes(n));
  }, [collections, qDebounced]);
  const cycleFull = useCallback(
    (src: {
      type: string;
      name: string;
      id?: number | string;
      url?: string;
      count?: number;
    }) => {
      const full = { ...src, type: toSingular(String(src.type)) };
      cycle(full);
    },
    [cycle]
  );
  const setGlobal = useCallback(
    (tItem: TagEntry, target: TagMode | undefined) => {
      const enriched =
        "id" in tItem && tItem.id !== undefined
          ? tItem
          : (findTag(String(toPlural(String(tItem.type))), tItem.name) as
              | TagEntry
              | undefined) ?? tItem;
      const curr = globalModeMap.get(
        `${toSingular(String(enriched.type))}:${enriched.name}`
      );
      if (curr === target) return;
      const step = () => cycleFull(enriched as any);
      if (target === "include") {
        if (curr === undefined) step();
        else if (curr === "exclude") {
          step();
          step();
        }
      } else if (target === "exclude") {
        if (curr === undefined) {
          step();
          step();
        } else if (curr === "include") step();
      } else {
        if (curr === "include") {
          step();
          step();
        } else if (curr === "exclude") step();
      }
    },
    [globalModeMap, cycleFull]
  );
  const onTapTag = useCallback(
    (tItem: TagItem) => {
      const curr = globalModeMap.get(`${toSingular(tItem.type)}:${tItem.name}`);
      if (curr === undefined) setGlobal(tItem, "include");
      else if (curr === "include") setGlobal(tItem, "exclude");
      else setGlobal(tItem, undefined);
    },
    [globalModeMap, setGlobal]
  );
  const modeFor = useCallback(
    (tItem: TagItem): TagMode | undefined =>
      globalModeMap.get(`${toSingular(tItem.type)}:${tItem.name}`),
    [globalModeMap]
  );
  const applyCollection = useCallback(
    (id: string) => {
      const col = collections.find((c) => c.id === id);
      if (!col) return;
      for (const it of col.items) {
        const found = findTag(String(it.type), it.name);
        if (found) {
          cycleFull({ ...found, type: found.type });
          if (it.mode === "exclude") cycleFull({ ...found, type: found.type });
        } else {
          const base = { type: toSingular(String(it.type)), name: it.name };
          cycleFull(base);
          if (it.mode === "exclude") cycleFull(base);
        }
      }
    },
    [collections, cycleFull]
  );
  const replaceWithCollection = useCallback(
    (id: string) => {
      clear();
      requestAnimationFrame(() => applyCollection(id));
    },
    [clear, applyCollection]
  );
  const createFromFilters = useCallback(() => {
    setDraft({
      id: "__new__",
      name: t("collections.defaultName"),
      items: filters.map((f) => ({
        type: toPlural(String(f.type)) as TagKind,
        name: f.name,
        mode: f.mode,
      })),
    });
    setTab("collections");
  }, [filters, t]);
  const openEditor = useCallback(
    (id: string) => {
      const col = collections.find((c) => c.id === id);
      if (!col) return;
      setDraft({
        id: col.id,
        name: col.name,
        items: col.items.map((x) => ({
          type: toPlural(String(x.type)) as TagKind,
          name: x.name,
          mode: x.mode,
        })),
      });
      setTab("collections");
    },
    [collections]
  );
  const newEmptyDraft = useCallback(() => {
    setDraft({ id: "__new__", name: t("collections.defaultName"), items: [] });
    setTab("collections");
  }, [t]);
  const saveDraft = useCallback(() => {
    if (!draft) return;
    if (draft.id === "__new__") {
      createCollection(
        draft.name.trim() || t("collections.untitled"),
        draft.items
      );
      setDraft(null);
    } else {
      renameCollection(
        draft.id,
        draft.name.trim() || t("collections.untitled")
      );
      replaceCollectionItems(draft.id, draft.items);
      setDraft(null);
    }
  }, [draft, createCollection, renameCollection, replaceCollectionItems, t]);
  const migratedOnce = useRef(false);
  useEffect(() => {
    if (!filtersReady || migratedOnce.current) return;
    const needMigration = filters.some(
      (f: any) =>
        f &&
        (f.type === "tags" ||
          f.type === "artists" ||
          f.type === "characters" ||
          f.type === "parodies" ||
          f.type === "groups" ||
          f.id === undefined ||
          f.url === undefined ||
          f.count === undefined)
    );
    if (!needMigration) return;
    migratedOnce.current = true;
    const snapshot = [...filters];
    clear();
    requestAnimationFrame(() => {
      for (const it of snapshot) {
        const found = findTag(String(it.type), it.name);
        if (found) {
          cycleFull({ ...found, type: found.type });
          if (it.mode === "exclude") cycleFull({ ...found, type: found.type });
        } else {
          const base = { type: toSingular(String(it.type)), name: it.name };
          cycleFull(base);
          if (it.mode === "exclude") cycleFull(base);
        }
      }
    });
  }, [filtersReady, filters, clear, cycleFull]);
  const renderTag: ListRenderItem<TagItem> = ({ item }) => (
    <TagRow
      item={item}
      mode={modeFor(item)}
      isFav={isFav({ type: item.type, name: item.name })}
      onTap={() => onTapTag(item)}
      onToggleFav={() => toggleFav({ type: item.type, name: item.name })}
      onRemove={modeFor(item) ? () => setGlobal(item, undefined) : undefined}
    />
  );
  const [showSheet, setShowSheet] = useState(false);
  const openSheet = useCallback(() => setShowSheet(true), []);
  const closeSheet = useCallback(() => setShowSheet(false), []);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [maxScroll, setMaxScroll] = useState(0);
  const topOpacity = scrollY.interpolate({
    inputRange: [0, 8, 24],
    outputRange: [0, 0.4, 0.85],
    extrapolate: "clamp",
  });
  const bottomOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [
          Math.max(0, maxScroll - 24),
          Math.max(0, maxScroll - 8),
          Math.max(0, maxScroll),
        ],
        outputRange: [0.85, 0.4, 0],
        extrapolate: "clamp",
      }),
    [maxScroll, scrollY]
  );
  const onTagListScroll = useCallback(
    (e: any) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      scrollY.setValue(contentOffset?.y ?? 0);
      const max = Math.max(
        0,
        (contentSize?.height ?? 0) - (layoutMeasurement?.height ?? 0)
      );
      if (max !== maxScroll) setMaxScroll(max);
    },
    [maxScroll, scrollY]
  );
  const placeholder =
    tab === "collections"
      ? t("tags.searchCollectionPlaceholder")
      : t("tags.searchPlaceholder");
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View
        style={[styles.body, { flexDirection: isTablet ? "row" : "column" }]}
      >
        {isTablet && (
          <View style={{ width: 320, height: "100%" }}>
            <SidebarSelected
              includes={includes}
              excludes={excludes}
              clear={clear}
              isFav={isFav}
              toggleFav={toggleFav}
              setGlobal={setGlobal}
              resolveTag={findTag}
            />
          </View>
        )}
        <View style={styles.rightPane}>
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <SearchBar
                value={q}
                onChangeText={setQ}
                placeholder={placeholder}
                onClear={() => setQ("")}
              />
            </View>
            {!isTablet && (
              <Pressable
                onPress={openSheet}
                style={[styles.selectedBtn, { backgroundColor: colors.accent }]}
              >
                <Feather name="sliders" size={16} color={colors.bg} />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{
                    color: colors.bg,
                    fontWeight: "800",
                    marginLeft: 6,
                    flexShrink: 1,
                  }}
                >
                  {t("tags.selected")}
                </Text>
              </Pressable>
            )}
          </View>
          <Tabs tab={tab} setTab={setTab} />
          {tab === "collections" ? (
            <View style={{ flex: 1 }}>
              <View
                style={[styles.blockHeader, { justifyContent: "flex-start" }]}
              >
                <ActionPrimary
                  onPress={() => {
                    createFromFilters();
                  }}
                  label={t("collections.createFromSelected")}
                />
              </View>
              <CollectionsList
                collections={filteredCollections}
                onReplace={(id) => {
                  replaceWithCollection(id);
                }}
                onEdit={openEditor}
                onDelete={deleteCollection}
              />
              {draft && (
                <CollectionsEditor
                  draft={draft}
                  setDraft={setDraft}
                  onCancel={() => setDraft(null)}
                  onSave={saveDraft}
                  isFav={isFav}
                  toggleFav={toggleFav}
                  resolveTag={findTag}
                  onOverwriteFromFilters={() =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            items: filters.map((f) => ({
                              type: toPlural(String(f.type)) as TagKind,
                              name: f.name,
                              mode: f.mode,
                            })),
                          }
                        : d
                    )
                  }
                />
              )}
            </View>
          ) : (
            <View style={styles.searchSection}>
              <View style={{ flex: 1 }}>
                <FlashList<TagItem>
                  data={activeList}
                  keyExtractor={(tItem: TagItem) => `${tItem.type}:${tItem.id}`}
                  renderItem={renderTag}
                  ItemSeparatorComponent={() => <View style={{ height: 5 }} />}
                  contentContainerStyle={{
                    paddingBottom: isTablet ? 8 : 16,
                    paddingTop: 8,
                  }}
                  extraData={{
                    epoch,
                    lastChangedKey,
                    draftId: draft?.id ?? "",
                    favsHash,
                    tab,
                    q: qDebounced,
                  }}
                  ListEmptyComponent={
                    <Text style={{ color: colors.sub, padding: 12 }}>
                      {t("common.nothingFound")}
                    </Text>
                  }
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  onScroll={onTagListScroll}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator
                />
                <Animated.View
                  pointerEvents="none"
                  style={[styles.fadeTop, { opacity: topOpacity }]}
                >
                  <LinearGradient
                    colors={[colors.bg, "transparent"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.fadeBottom, { opacity: bottomOpacity }]}
                >
                  <LinearGradient
                    colors={["transparent", colors.bg]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
              </View>
            </View>
          )}
        </View>
      </View>
      {!isTablet && (
        <NhModal
          visible={showSheet}
          onClose={closeSheet}
          sizing="fixed"
          dimBackground
          sheetStyle={{
            backgroundColor: colors.menuBg,
            borderColor: colors.page,
          }}
          title={t("tags.selected")}
        >
          <SidebarSelected
            includes={includes}
            excludes={excludes}
            clear={clear}
            isFav={isFav}
            toggleFav={toggleFav}
            setGlobal={setGlobal}
            resolveTag={findTag}
          />
        </NhModal>
      )}
    </View>
  );
}
function ActionPrimary({
  onPress,
  label,
}: {
  onPress: () => void;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.accent,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        alignSelf: "flex-start",
        maxWidth: 360,
      }}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          color: colors.bg,
          fontWeight: "800",
          textAlign: "center",
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  rightPane: { flex: 1, paddingHorizontal: 12, paddingBottom: 8 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectedBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: 180,
  },
  searchSection: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  blockHeader: {
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  fadeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 16,
    zIndex: 2,
  },
  fadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 16,
    zIndex: 2,
  },
  closeIcon: {
    position: "absolute",
    right: 10,
    top: 10,
    padding: 6,
    borderRadius: 999,
  },
});
