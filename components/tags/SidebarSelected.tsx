import { useI18n } from "@/lib/i18n/I18nContext";
import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toPlural } from "./helpers";
import { SelectedRow } from "./SelectedRow";
import { TagKind, TagMode } from "./types";
export function SidebarSelected({
  includes,
  excludes,
  clear,
  isFav,
  toggleFav,
  setGlobal,
  resolveTag,
}: {
  includes: Array<{ type: string; name: string }>;
  excludes: Array<{ type: string; name: string }>;
  clear: () => void;
  isFav: (t: { type: string; name: string }) => boolean;
  toggleFav: (t: { type: string; name: string }) => void;
  setGlobal: (
    t: {
      id: number | string;
      type: TagKind;
      name: string;
      count: number;
      url: string;
    },
    target: TagMode | undefined
  ) => void;
  resolveTag: (typePlural: string, name: string) => any;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [maxScroll, setMaxScroll] = useState(0);
  const topOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 8, 24],
        outputRange: [0, 0.4, 0.85],
        extrapolate: "clamp",
      }),
    [scrollY]
  );
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
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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
  return (
    <View
      style={[
        styles.sidebar,
        { backgroundColor: colors.menuBg, borderColor: colors.page },
      ]}
    >
      <View style={styles.selHeader}>
        <Text style={[styles.sectionTitle, { color: colors.menuTxt }]}>
          {t("tags.selected")}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={[styles.counter, { backgroundColor: colors.incBg }]}>
            <Text
              style={{ color: colors.incTxt, fontWeight: "700", fontSize: 12 }}
            >
              ✓ {includes.length}
            </Text>
          </View>
          <View style={[styles.counter, { backgroundColor: colors.excBg }]}>
            <Text
              style={{ color: colors.excTxt, fontWeight: "700", fontSize: 12 }}
            >
              − {excludes.length}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ flex: 1, position: "relative" }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: 12 + insets.bottom,
            paddingTop: 4,
            gap: 6,
          }}
          keyboardShouldPersistTaps="handled"
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          showsVerticalScrollIndicator
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <Text style={[styles.subhead, { color: colors.title }]}>
            {t("tags.included")}
          </Text>
          {includes.length === 0 ? (
            <Text style={{ color: colors.sub, fontSize: 12, marginBottom: 4 }}>
              {t("tags.empty")}
            </Text>
          ) : (
            includes.map((f) => (
              <SelectedRow
                key={`${f.type}:${f.name}`}
                type={toPlural(String(f.type))}
                name={f.name}
                mode="include"
                isFav={isFav({ type: f.type, name: f.name })}
                onToggleMode={() =>
                  setGlobal(
                    {
                      id: 0,
                      type: toPlural(String(f.type)) as TagKind,
                      name: f.name,
                      count: 0,
                      url: "",
                    },
                    "exclude"
                  )
                }
                onRemove={() =>
                  setGlobal(
                    {
                      id: 0,
                      type: toPlural(String(f.type)) as TagKind,
                      name: f.name,
                      count: 0,
                      url: "",
                    },
                    undefined
                  )
                }
                onToggleFav={() => toggleFav({ type: f.type, name: f.name })}
                resolveTag={resolveTag}
              />
            ))
          )}
          <Text style={[styles.subhead, { color: colors.title, marginTop: 8 }]}>
            {t("tags.excluded")}
          </Text>
          {excludes.length === 0 ? (
            <Text style={{ color: colors.sub, fontSize: 12 }}>
              {t("tags.empty")}
            </Text>
          ) : (
            excludes.map((f) => (
              <SelectedRow
                key={`${f.type}:${f.name}`}
                type={toPlural(String(f.type))}
                name={f.name}
                mode="exclude"
                isFav={isFav({ type: f.type, name: f.name })}
                onToggleMode={() =>
                  setGlobal(
                    {
                      id: 0,
                      type: toPlural(String(f.type)) as TagKind,
                      name: f.name,
                      count: 0,
                      url: "",
                    },
                    "include"
                  )
                }
                onRemove={() =>
                  setGlobal(
                    {
                      id: 0,
                      type: toPlural(String(f.type)) as TagKind,
                      name: f.name,
                      count: 0,
                      url: "",
                    },
                    undefined
                  )
                }
                onToggleFav={() => toggleFav({ type: f.type, name: f.name })}
                resolveTag={resolveTag}
              />
            ))
          )}
          <Pressable
            onPress={clear}
            style={[
              styles.btn,
              { backgroundColor: colors.accent, marginTop: 8 },
            ]}
          >
            <Feather name="refresh-ccw" size={16} color={colors.bg} />
            <Text style={[styles.btnTxt, { color: colors.bg }]}>
              {t("common.reset")}
            </Text>
          </Pressable>
        </ScrollView>
        <Animated.View
          pointerEvents="none"
          style={[styles.fadeTop, { opacity: topOpacity }]}
        >
          <LinearGradient
            colors={[colors.menuBg, "transparent"]}
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
            colors={["transparent", colors.menuBg]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  sidebar: {
    paddingTop: 12,
    paddingHorizontal: 12,
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    ...Platform.select({ android: { elevation: 1 } }),
  },
  selHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  subhead: { fontSize: 13, fontWeight: "700" },
  counter: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnTxt: { fontSize: 12, fontWeight: "800" },
  fadeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 14,
    zIndex: 2,
  },
  fadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 14,
    zIndex: 2,
  },
});
