import { getElectronVersion, isElectron } from "@/electron/bridge";
import { useI18n } from "@/lib/i18n/I18nContext";
import { useTheme } from "@/lib/ThemeContext";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

export default function SettingsLayout({
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = isElectron() || (Platform.OS === "web" && width >= 768);
  const isTablet = width >= 600 && width < 768;
  const [electronVersion, setElectronVersion] = useState<string | null>(null);
  useEffect(() => {
    if (isElectron()) getElectronVersion().then(setElectronVersion);
  }, []);
  const versionDisplay = isElectron() && electronVersion != null
    ? electronVersion
    : Constants.expoConfig?.version ?? "";

  const router = useRouter();
  const tapCountRef = useRef(0);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onVersionPress = () => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    tapCountRef.current += 1;
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      router.push("/uikit");
      return;
    }
    resetTimeoutRef.current = setTimeout(() => {
      tapCountRef.current = 0;
      resetTimeoutRef.current = null;
    }, 1500);
  };

  useEffect(() => () => {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={[styles.page, { backgroundColor: colors.bg }]}
        contentContainerStyle={[
          styles.container,
          isDesktop && styles.containerDesktop,
          isTablet && styles.containerTablet,
          { paddingTop: isDesktop ? 24 : 12, paddingBottom: isDesktop ? 48 : 32 }
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={[
          styles.content,
          isDesktop && styles.contentDesktop,
          isTablet && styles.contentTablet,
        ]}>
          {children}
        </View>
        <View style={styles.footer}>
          <Pressable onPress={onVersionPress} hitSlop={12}>
            <Text style={[styles.caption, { color: colors.sub }]}>
              v{versionDisplay} {t("app.version.beta")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  container: {
    paddingHorizontal: 16,
  },
  containerDesktop: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  containerTablet: {
    paddingHorizontal: 32,
  },
  content: {
    width: "100%",
  },
  contentDesktop: {
    maxWidth: 800,
    width: "100%",
  },
  contentTablet: {
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
  },
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
