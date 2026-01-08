import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const SECTION_ICONS: Record<string, string> = {
  "settings.section.language": "globe",
  "settings.section.appearance": "palette",
  "settings.section.display": "monitor",
  "settings.section.reader": "book-open",
  "settings.section.grid": "grid",
  "settings.section.storage": "hard-drive",
};

export default function Section({ title }: { title: string }) {
  const { colors } = useTheme();
  const iconName = SECTION_ICONS[title] || "settings";
  
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: colors.accent + "15" }]}>
        <Feather name={iconName as any} size={16} color={colors.accent} />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.txt }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 14,
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
    flex: 1,
  },
});