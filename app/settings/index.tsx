import * as NavigationBar from "expo-navigation-bar";
import { setStatusBarHidden } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

import GridSection from "@/components/settings/GridSection";
import SettingsBuilder from "@/components/settings/SettingsBuilder";
import SettingsLayout from "@/components/settings/SettingsLayout";

import { FS_KEY, RH_KEY, STORAGE_KEY_HUE } from "@/components/settings/keys";
import type { SettingsSection } from "@/components/settings/schema";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { isElectron } from "@/electron/bridge";

import Section from "@/components/settings/Section";
import StorageManager from "@/components/settings/StorageManager";
import LanguageSelector from "@/components/settings/LanguageSelector";
import HuePaletteSelector from "@/components/settings/HuePaletteSelector";
import { SavePathRow } from "@/components/settings/rows/SavePathRow";
import { GridProfile } from "@/config/gridConfig";

function systemProfileForDims(w: number, h: number): GridProfile {
  const isLandscape = w > h;
  const isTablet = Math.min(w, h) >= 600;
  if (isTablet && isLandscape) return "tabletLandscape";
  if (isTablet && !isLandscape) return "tabletPortrait";
  if (!isTablet && isLandscape) return "phoneLandscape";
  return "phonePortrait";
}

export default function SettingsScreen() {
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const sysProfile = systemProfileForDims(width, height);
  const [activeProfile, setActiveProfile] = useState<GridProfile>(sysProfile);

  const { hue, setHue, colors } = useTheme();
  const [hueLocal, setHueLocal] = usePersistedState<number>(
    STORAGE_KEY_HUE,
    hue
  );
  const [fullscreen, setFullscreen] = usePersistedState<boolean>(FS_KEY, false);
  const [hideHints, setHideHints] = usePersistedState<boolean>(RH_KEY, false);

  const toggleFullscreen = async (value: boolean) => {
    setFullscreen(value);
    try {
      (globalThis as any).__setFullscreen?.(value);
    } catch {}
    try {
      setStatusBarHidden(value, "fade");
    } catch {}
    if (Platform.OS === "android") {
      try {
        if (value) {
          await NavigationBar.setVisibilityAsync("hidden");
          await NavigationBar.setButtonStyleAsync("light");
        } else {
          await NavigationBar.setVisibilityAsync("visible");
          await NavigationBar.setButtonStyleAsync("light");
        }
      } catch (e) {
        console.warn("[settings] expo-navigation-bar failed:", e);
      }
    }
  };

  const sections: SettingsSection[] = useMemo(
    () => {
      const electronMode = isElectron();
      const sectionsList: SettingsSection[] = [
        {
          id: "language",
          title: t("settings.section.language"),
          cards: [
            {
              id: "language-card",
              items: [
                {
                  id: "language-row",
                  kind: "custom",
                  render: () => <LanguageSelector />,
                },
              ],
            },
          ],
        },
        {
          id: "appearance",
          title: t("settings.section.appearance"),
          cards: [
            {
              id: "theme-card",
              items: [
                {
                  id: "hue-palette",
                  kind: "custom",
                  render: () => (
                    <>
                      <View style={{ marginBottom: 4 }}>
                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: "800",
                            color: colors.txt,
                            lineHeight: 24,
                            letterSpacing: 0.3,
                          }}
                        >
                          {t("settings.appearance.theme")}
                        </Text>
                      </View>
                      <View style={{ marginTop: 16 }}>
                        <HuePaletteSelector
                          value={hueLocal}
                          onValueChange={(deg) => setHueLocal(deg)}
                          onComplete={(deg) => setHue(deg)}
                        />
                      </View>
                    </>
                  ),
                },
              ],
            },
          ],
        },
      ];

      // Добавляем настройки экрана только для Android
      if (!electronMode) {
        sectionsList.push({
          id: "screen",
          title: t("settings.section.display"),
          cards: [
            {
              id: "screen-card",
              items: [
                {
                  id: "fullscreen",
                  kind: "toggle",
                  title: t("settings.display.fullscreen"),
                  description: t("settings.display.fullscreenDesc"),
                  value: fullscreen,
                  onToggle: toggleFullscreen,
                },
                {
                  id: "android-note",
                  kind: "custom",
                  render: () => (
                    <View
                      style={{
                        marginTop: 14,
                        borderRadius: 12,
                        borderWidth: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderColor: colors.accent + "30",
                        backgroundColor: colors.accent + "08",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.sub, flex: 1, lineHeight: 16 }}>
                        {t("settings.display.androidNote")}
                      </Text>
                    </View>
                  ),
                },
              ],
            },
          ],
        });
      }

      // Добавляем настройки читалки только для Android
      if (!electronMode) {
        sectionsList.push({
          id: "reader",
          title: t("settings.section.reader"),
          cards: [
            {
              id: "reader-card",
              items: [
                {
                  id: "hide-hints",
                  kind: "toggle",
                  title: t("settings.reader.hideHints"),
                  description: t("settings.reader.hideHintsDesc"),
                  value: hideHints,
                  onToggle: (v) => {
                    setHideHints(v);
                    try {
                      (globalThis as any).__setReaderHideHints?.(v);
                    } catch {}
                  },
                },
              ],
            },
          ],
        });
      }

      return sectionsList;
    },
    [colors, fullscreen, hideHints, hueLocal, t]
  );

  return (
    <SettingsLayout title={t("settings.title")}>
      <SettingsBuilder sections={sections} />

      <Section title={t("settings.section.grid")} />
      <GridSection
        activeProfile={activeProfile}
        setActiveProfile={setActiveProfile}
      />

      <Section title={t("settings.section.storage")} />
      {isElectron() && (
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <SavePathRow />
        </View>
      )}
      <StorageManager />
    </SettingsLayout>
  );
}
