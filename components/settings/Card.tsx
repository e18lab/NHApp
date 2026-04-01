import { isElectron } from "@/electron/bridge";
import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";

export default function Card({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = isElectron() || (Platform.OS === "web" && width >= 768);
  const isTablet = width >= 600 && width < 768;

  return (
    <View
      style={[
        styles.card,
        isDesktop && styles.cardDesktop,
        isTablet && styles.cardTablet,
        { 
          backgroundColor: colors.tagBg, 
          borderColor: colors.page + "40",
          ...((Platform.OS === 'web' || isDesktop) && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: isDesktop ? 6 : 4 },
            shadowOpacity: isDesktop ? 0.1 : 0.08,
            shadowRadius: isDesktop ? 16 : 12,
            elevation: isDesktop ? 6 : 4,
          }),
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardDesktop: {
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  cardTablet: {
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 22,
    marginBottom: 18,
  },
});
