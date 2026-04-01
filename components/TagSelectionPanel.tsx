import { useFilterTags } from "@/context/TagFilterContext";
import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function TagSelectionPanel({ onOpenTags }: { onOpenTags: () => void }) {
  const { colors } = useTheme();
  const { includes, excludes } = useFilterTags();
  const hasFilters = (includes?.length ?? 0) > 0 || (excludes?.length ?? 0) > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Pressable
        onPress={onOpenTags}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.accent + "22", opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Feather name="tag" size={20} color={colors.accent} />
        <Text style={[styles.buttonLabel, { color: colors.accent }]}>
          Выбор тегов
        </Text>
      </Pressable>
      {hasFilters && (
        <Text style={[styles.hint, { color: colors.sub }]}>
          Включено: {includes?.length ?? 0}, исключено: {excludes?.length ?? 0}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    marginTop: 12,
    fontSize: 13,
  },
});
