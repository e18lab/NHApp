import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MainTab } from "./types";
export function Tabs({ tab, setTab }: { tab: MainTab; setTab: (t: MainTab) => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.tabs, { marginVertical: 8 }]}>
      {(["all", "favs", "collections"] as MainTab[]).map((tKey) => {
        const active = tab === tKey;
        const label =
          tKey === "all"
            ? t("tags.all")
            : tKey === "favs"
            ? t("tags.favs")
            : t("tags.collectionsTab");
        return (
          <Pressable
            key={tKey}
            onPress={() => setTab(tKey)}
            style={[
              styles.tabBtn,
              {
                borderColor: active ? colors.accent : "transparent",
                backgroundColor: active ? colors.incBg : colors.tagBg,
              },
            ]}
          >
            <Text
              style={{
                color: active ? colors.incTxt : colors.tagText,
                fontWeight: "800",
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
  },
});
