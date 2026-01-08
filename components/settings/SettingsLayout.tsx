import { useI18n } from "@/lib/i18n/I18nContext";
import { useTheme } from "@/lib/ThemeContext";
import Constants from "expo-constants";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function SettingsLayout({
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={[styles.page, { backgroundColor: colors.bg }]}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {children}
        <View style={styles.footer}>
          <Text style={[styles.caption, { color: colors.sub }]}>
            v{Constants.expoConfig?.version} {t("app.version.beta")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 16 },
  footer: {
    marginTop: 32,
    marginBottom: 16,
    alignItems: "center",
  },
  caption: { 
    textAlign: "center", 
    opacity: 0.6, 
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
