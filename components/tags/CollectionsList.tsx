import { useFilterTags } from "@/context/TagFilterContext";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
type Collection = {
  id: string;
  name: string;
  items: Array<{ type: string; name: string; mode: "include" | "exclude" }>;
};
const PLURAL_TO_SINGULAR: Record<string, string> = {
  tags: "tag",
  artists: "artist",
  characters: "character",
  parodies: "parody",
  groups: "group",
};
const canon = (type: string, name: string, mode: "include" | "exclude") =>
  `${(PLURAL_TO_SINGULAR[type] || type).toLowerCase()}:${String(
    name
  ).toLowerCase()}:${mode}`;
export function CollectionsList({
  collections,
  onReplace,
  onEdit,
  onDelete,
}: {
  collections: Array<Collection>;
  onReplace: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  if (collections.length === 0) {
    return (
      <Text style={{ color: colors.sub, fontSize: 12, marginTop: 8 }}>
        {t("common.nothingFound")}
      </Text>
    );
  }
  return (
    <>
      {collections.map((c) => (
        <CollectionRow
          key={c.id}
          c={c}
          onReplace={onReplace}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}
function CollectionRow({
  c,
  onReplace,
  onEdit,
  onDelete,
}: {
  c: Collection;
  onReplace: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { filters } = useFilterTags();
  const isActive = useMemo(() => {
    if (!filters || !Array.isArray(filters)) return false;
    if ((filters?.length ?? 0) !== (c.items?.length ?? 0)) return false;
    const have = new Set(
      filters.map((f: any) => canon(String(f.type), String(f.name), f.mode))
    );
    return c.items.every((it) =>
      have.has(canon(String(it.type), String(it.name), it.mode))
    );
  }, [filters, c.items]);
  const pressAnim = useRef(new Animated.Value(0)).current;
  const onDown = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 40,
      bounciness: 0,
    }).start();
  };
  const onUp = () => {
    Animated.timing(pressAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };
  const bgInterp = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isActive ? colors.accent + "10" : colors.tagBg,
      colors.accent + "20",
    ],
  });
  const scaleInterp = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.985],
  });
  const ripple = colors.accent + "24";
  return (
    <Animated.View
      style={[
        styles.collectionCard,
        {
          backgroundColor: bgInterp as any,
          transform: [{ scale: scaleInterp }],
          borderColor: isActive ? colors.accent : colors.page,
        },
      ]}
    >
      {isActive && (
        <View style={[styles.activeBar, { backgroundColor: colors.accent }]} />
      )}
      <Pressable
        onPress={() => onReplace(c.id)}
        onPressIn={onDown}
        onPressOut={onUp}
        android_ripple={{ color: ripple, borderless: false, foreground: true }}
        style={styles.leftArea}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
      >
        <Text
          style={[styles.collectionTitle, { color: colors.txt }]}
          numberOfLines={1}
        >
          {c.name || t("collections.untitled")}
        </Text>
        <Text style={{ color: colors.sub, fontSize: 12 }}>
          {t("collections.itemsCount", { count: c.items.length })}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onEdit(c.id)}
        android_ripple={{ color: ripple, borderless: false, foreground: true }}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && {
            backgroundColor: colors.accent + "12",
            borderRadius: 10,
          },
        ]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("collections.list.edit")}
      >
        <Feather name="edit-2" size={16} color={colors.sub} />
      </Pressable>
      <Pressable
        onPress={() => onDelete(c.id)}
        android_ripple={{ color: ripple, borderless: false, foreground: true }}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && {
            backgroundColor: colors.accent + "12",
            borderRadius: 10,
          },
        ]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("collections.list.delete")}
      >
        <Feather name="trash-2" size={16} color={colors.sub} />
      </Pressable>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  collectionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 8,
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  leftArea: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    overflow: "hidden",
    borderRadius: 10,
  },
  collectionTitle: { fontSize: 14, fontWeight: "800" },
  iconBtn: { padding: 8, overflow: "hidden", borderRadius: 10 },
});
