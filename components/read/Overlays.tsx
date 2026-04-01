import { useI18n } from "@/lib/i18n/I18nContext";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
export function HintsOverlay({
  visible,
  isPhone,
  uiVisible,
  phoneBottomInset,
  colors,
  hints,
  handSwap,
}: {
  visible: boolean;
  isPhone: boolean;
  uiVisible: boolean;
  phoneBottomInset: number;
  colors: any;
  hints: { left: boolean; center: boolean; right: boolean };
  handSwap: boolean;
}) {
  const { t } = useI18n();
  if (!visible || !(hints.left || hints.center || hints.right)) return null;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { zIndex: 11 }]}
    >
      {hints.left && (
        <View
          style={[
            styles.hintBox,
            {
              left: 0,
              width: "30%",
              top: 0,
              bottom: isPhone && uiVisible ? phoneBottomInset : 0,
              backgroundColor: colors.searchBg + "e6",
              borderColor: colors.page,
            },
          ]}
        >
          <Text style={[styles.hintText, { color: colors.searchTxt }]}>
            {!handSwap
              ? `${t("common.tapHere")} — ${t("common.back")}`
              : `${t("common.tapHere")} — ${t("common.nextPage")}`}
          </Text>
        </View>
      )}
      {hints.center && (
        <View
          style={[
            styles.hintBox,
            {
              left: "30%",
              width: "40%",
              top: 0,
              bottom: isPhone && uiVisible ? phoneBottomInset : 0,
              backgroundColor: colors.searchBg + "e6",
              borderColor: colors.accent,
              zIndex: 1022,
            },
          ]}
        >
          <Text style={[styles.hintText, { color: colors.searchTxt }]}>
            {`${t("common.tapHere")} — ${t("reader.menuHint")}`}
          </Text>
        </View>
      )}
      {hints.right && (
        <View
          style={[
            styles.hintBox,
            {
              right: 0,
              width: "30%",
              top: 0,
              bottom: isPhone && uiVisible ? phoneBottomInset : 0,
              backgroundColor: colors.searchBg + "e6",
              borderColor: colors.page,
            },
          ]}
        >
          <Text style={[styles.hintText, { color: colors.searchTxt }]}>
            {!handSwap
              ? `${t("common.tapHere")} — ${t("common.nextPage")}`
              : `${t("common.tapHere")} — ${t("common.back")}`}
          </Text>
        </View>
      )}
    </View>
  );
}
export function Banner({
  banner,
  colors,
  animatedStyle,
}: {
  banner: string | null;
  colors: any;
  animatedStyle: any;
}) {
  if (!banner) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        { backgroundColor: colors.searchBg, borderColor: colors.page },
        animatedStyle,
      ]}
    >
      <Text
        style={{ color: colors.searchTxt, fontWeight: "800", fontSize: 12 }}
      >
        {banner}
      </Text>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  hintBox: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 10,
  },
  hintText: { fontSize: 11, fontWeight: "800" },
  banner: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 30,
    alignItems: "center",
  },
});
