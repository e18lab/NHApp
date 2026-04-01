import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { LABEL_OF, typeIcon } from "./helpers";
import { TagItem } from "./types";
type TagMode = "include" | "exclude";
export function TagRow({
  item,
  mode,
  isFav,
  onTap,
  onToggleFav,
  onRemove,
}: {
  item: TagItem;
  mode?: TagMode;
  isFav: boolean;
  onTap: () => void;
  onToggleFav: (e: GestureResponderEvent) => void;
  onRemove?: () => void;
}) {
  const { colors } = useTheme();
  const bg =
    mode === "include" ? colors.incBg :
    mode === "exclude" ? colors.excBg :
    "transparent";
  const fg =
    mode === "include" ? colors.incTxt :
    mode === "exclude" ? colors.excTxt :
    colors.txt;
  return (
    <View
      style={[
        styles.rowWrapper,
        {
          backgroundColor: mode ? bg : colors.menuBg,
          borderColor: mode ? bg : colors.page,
        },
      ]}
    >
      <Pressable
        onPress={onTap}
        android_ripple={{ color: "#ffffff22", borderless: false }}
        style={styles.rowContent}
      >
        <View style={styles.typeIcon}>
          <Feather name={typeIcon(item.type)} size={16} color={mode ? fg : colors.sub} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: fg }]}>
            {item.name}
          </Text>
          <Text style={{ color: mode ? fg : colors.title, fontSize: 12, fontWeight: "700" }}>
            {LABEL_OF[item.type]} • {item.count.toLocaleString("en-US")}
          </Text>
        </View>
        <Pressable onPress={onToggleFav} hitSlop={10} style={{ padding: 6, borderRadius: 999 }}>
          <Feather name="heart" size={16} color={isFav ? colors.accent : colors.sub} />
        </Pressable>
        {!!mode && onRemove && (
          <Pressable onPress={onRemove} hitSlop={10} style={styles.iconBtn}>
            <Feather name="x" size={16} color={fg} />
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  rowWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  typeIcon: { width: 22, alignItems: "center" },
  rowTitle: { fontSize: 14, fontWeight: "800" },
  iconBtn: { padding: 8 },
});
