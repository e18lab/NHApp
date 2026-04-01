import NhModal from "@/components/nhModal";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SelectedRow } from "./SelectedRow";
import { Draft } from "./types";
export function CollectionsEditor({
  draft,
  setDraft,
  onCancel,
  onSave,
  isFav,
  toggleFav,
  resolveTag,
  onOverwriteFromFilters,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  onCancel: () => void;
  onSave: () => void;
  isFav: (t: { type: string; name: string }) => boolean;
  toggleFav: (t: { type: string; name: string }) => void;
  resolveTag: (typePlural: string, name: string) => any;
  onOverwriteFromFilters: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"all" | "include" | "exclude">("all");
  const incCount = draft.items.filter((x) => x.mode === "include").length;
  const excCount = draft.items.filter((x) => x.mode === "exclude").length;
  const filtered = useMemo(
    () =>
      draft.items
        .filter((it) => (mode === "all" ? true : it.mode === mode))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [draft.items, mode]
  );
  const FOOTER_H = 72;
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const maxScroll = Math.max(0, contentH - viewportH);
  const scrollY = useRef(new Animated.Value(0)).current;
  const hasScroll = contentH > viewportH + 1;
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
    [scrollY, maxScroll]
  );
  const titleStr =
    draft.id === "__new__"
      ? t("collections.newTitle")
      : t("collections.editTitle");
  return (
    <NhModal
      visible
      onClose={onCancel}
      sizing="fixed"
      dimBackground={false}
      sheetStyle={{ backgroundColor: colors.page, borderColor: colors.page }}
      title={titleStr}
      hint={t("collections.hint")}
    >
      <View style={[styles.contentWrap, { flexDirection: "column" }]}>
        <View style={styles.nameRow}>
          <Feather name="bookmark" size={16} color={colors.sub} />
          <TextInput
            value={draft.name}
            onChangeText={(v) => setDraft((d) => (d ? { ...d, name: v } : d))}
            placeholder={t("collections.namePlaceholder")}
            placeholderTextColor={colors.sub}
            style={[
              styles.nameInput,
              {
                color: colors.txt,
                backgroundColor: colors.searchBg,
                borderColor: colors.page,
              },
            ]}
          />
        </View>
        <View style={styles.segmentWrap}>
          {(["all", "include", "exclude"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[
                styles.segmentBtnBig,
                {
                  backgroundColor: mode === m ? colors.accent : colors.tagBg,
                  borderColor: colors.page,
                },
              ]}
            >
              <Text
                style={{
                  color: mode === m ? colors.bg : colors.title,
                  fontWeight: "800",
                  fontSize: 13,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {m === "all"
                  ? t("collections.filter.all")
                  : m === "include"
                  ? t("collections.filter.include")
                  : t("collections.filter.exclude")}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.counters}>
          <View style={[styles.pill, { backgroundColor: colors.tagBg }]}>
            <Text
              style={{ color: colors.title, fontWeight: "700", fontSize: 12 }}
            >
              {t("collections.counters.included", { n: incCount })}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: colors.tagBg }]}>
            <Text
              style={{ color: colors.title, fontWeight: "700", fontSize: 12 }}
            >
              {t("collections.counters.excluded", { n: excCount })}
            </Text>
          </View>
        </View>
        <View
          style={styles.listWrap}
          onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        >
          <Animated.ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingVertical: 8,
              paddingBottom: 8,
              gap: 8,
            }}
            keyboardShouldPersistTaps="handled"
            scrollIndicatorInsets={{ bottom: FOOTER_H }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              {
                useNativeDriver: true,
              }
            )}
            onContentSizeChange={(_, h) => setContentH(h)}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator
          >
            {filtered.length === 0 ? (
              <Text
                style={{
                  color: colors.sub,
                  fontSize: 12,
                  paddingHorizontal: 2,
                }}
              >
                {t("common.nothingFound")}
              </Text>
            ) : (
              filtered.map((it) => (
                <SelectedRow
                  key={`${it.type}:${it.name}`}
                  type={it.type}
                  name={it.name}
                  mode={it.mode}
                  isFav={isFav({ type: it.type, name: it.name })}
                  onToggleMode={() =>
                    setDraft((d) => {
                      if (!d) return d;
                      const idx = d.items.findIndex(
                        (x) => x.type === it.type && x.name === it.name
                      );
                      if (idx === -1) return d;
                      const cp = d.items.slice();
                      cp[idx] = {
                        ...cp[idx],
                        mode:
                          cp[idx].mode === "include" ? "exclude" : "include",
                      };
                      return { ...d, items: cp };
                    })
                  }
                  onRemove={() =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            items: d.items.filter(
                              (x) => !(x.type === it.type && x.name === it.name)
                            ),
                          }
                        : d
                    )
                  }
                  onToggleFav={() =>
                    toggleFav({ type: it.type, name: it.name })
                  }
                  resolveTag={resolveTag}
                />
              ))
            )}
          </Animated.ScrollView>
          <Animated.View
            pointerEvents="none"
            style={[styles.fadeTop, { opacity: hasScroll ? topOpacity : 0 }]}
          >
            <LinearGradient
              colors={[colors.page, "transparent"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.fadeBottom,
              { opacity: hasScroll ? bottomOpacity : 0 },
            ]}
          >
            <LinearGradient
              colors={["transparent", colors.page]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.page,
              borderColor: colors.page,
              paddingBottom: insets.bottom,
              height: FOOTER_H + insets.bottom,
            },
          ]}
        >
          <Pressable
            onPress={() => setDraft((d) => (d ? { ...d, items: [] } : d))}
            style={[styles.footerBtn, { backgroundColor: colors.searchBg }]}
          >
            <Feather name="trash-2" size={16} color={colors.sub} />
            <Text
              style={[styles.footerLabel, { color: colors.sub }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t("common.reset")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onOverwriteFromFilters}
            style={[styles.footerBtn, { backgroundColor: colors.tagBg }]}
          >
            <Feather name="download" size={16} color={colors.title} />
            <Text
              style={[styles.footerLabel, { color: colors.title }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t("collections.fromSelected")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onSave}
            style={[styles.footerBtn, { backgroundColor: colors.accent }]}
          >
            <Feather name="check" size={16} color={colors.bg} />
            <Text
              style={[styles.footerLabel, { color: colors.bg }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t("common.save")}
            </Text>
          </Pressable>
        </View>
      </View>
    </NhModal>
  );
}
const styles = StyleSheet.create({
  contentWrap: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  nameInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentWrap: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  segmentBtnBig: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  counters: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  listWrap: {
    marginTop: 12,
    flex: 1,
    position: "relative",
    paddingHorizontal: 12,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  footerLabel: {
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1,
  },
  fadeTop: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 0,
    height: 16,
    zIndex: 2,
  },
  fadeBottom: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    height: 16,
    zIndex: 2,
  },
});
