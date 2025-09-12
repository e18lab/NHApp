import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type NoResultsAction = {
  label: string;
  onPress: () => void;
};

export default function NoResultsPanel({
  title,
  subtitle,
  iconName = "info",
  actions = [],
}: {
  title: string;
  subtitle?: string;
  iconName?: React.ComponentProps<typeof Feather>["name"];
  actions?: NoResultsAction[];
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.accent + "10",
          borderBottomColor: colors.page,
        },
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.titleRow}>
          <Feather name={iconName} size={16} color={colors.accent} />
          <Text style={[styles.title, { color: colors.txt }]}>{title}</Text>
        </View>

        {!!subtitle && (
          <Text style={[styles.subtitle, { color: colors.txt, opacity: 0.8 }]}>
            {subtitle}
          </Text>
        )}

        {actions.length > 0 && (
          <View style={styles.actionsRow}>
            {actions.map((a, i) => (
              <Pressable
                key={`${a.label}-${i}`}
                onPress={a.onPress}
                style={[
                  styles.chip,
                  { backgroundColor: colors.accent + "1A" },
                ]}
              >
                <Text style={{ color: colors.accent, fontWeight: "700" }}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 6,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    marginTop: 8,
  },
});
