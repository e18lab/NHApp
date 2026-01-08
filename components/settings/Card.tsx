import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

export default function Card({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { 
          backgroundColor: colors.tagBg, 
          borderColor: colors.page + "40",
          ...(Platform.OS === 'web' && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
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
});
