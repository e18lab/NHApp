import { isElectron } from "@/electron/bridge";
import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";

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
  const { width } = useWindowDimensions();
  const isDesktop = isElectron() || (Platform.OS === "web" && width >= 768);
  const isTablet = width >= 600 && width < 768;
  const iconName = SECTION_ICONS[title] || "settings";
  return (
    <View style={[
      styles.container,
      isDesktop && styles.containerDesktop,
      isTablet && styles.containerTablet,
    ]}>
      <View style={[
        styles.iconContainer,
        isDesktop && styles.iconContainerDesktop,
        isTablet && styles.iconContainerTablet,
        { backgroundColor: colors.accent + "15" }
      ]}>
        <Feather 
          name={iconName as any} 
          size={isDesktop ? 18 : isTablet ? 17 : 16} 
          color={colors.accent} 
        />
      </View>
      <Text style={[
        styles.sectionTitle,
        isDesktop && styles.sectionTitleDesktop,
        isTablet && styles.sectionTitleTablet,
        { color: colors.txt }
      ]}>
        {title}
      </Text>
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
  containerDesktop: {
    marginTop: 32,
    marginBottom: 18,
    gap: 12,
  },
  containerTablet: {
    marginTop: 28,
    marginBottom: 16,
    gap: 11,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerDesktop: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  iconContainerTablet: {
    width: 34,
    height: 34,
    borderRadius: 11,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
    flex: 1,
  },
  sectionTitleDesktop: {
    fontSize: 17,
    letterSpacing: 0.4,
  },
  sectionTitleTablet: {
    fontSize: 16,
    letterSpacing: 0.35,
  },
});