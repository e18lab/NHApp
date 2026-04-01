import React from "react";
import { StyleSheet, View } from "react-native";
import { IconBtn } from "./Buttons";

export function ControlsDesktop({
  colors,
  jumpPrev,
  jumpNext,
  onBack,
  onOpenSettings,
  continuous,
  toggleContinuous,
}: {
  colors: any;
  jumpPrev: () => void;
  jumpNext: () => void;
  onBack: () => void;
  onOpenSettings: () => void;
  continuous: boolean;
  toggleContinuous: () => void;
}) {
  if (continuous) {
    return (
      <View
        style={[
          styles.topLeftBar,
          { backgroundColor: colors.searchBg, borderColor: colors.page },
        ]}
      >
        <IconBtn
          onPress={onBack}
          name="corner-up-left"
          color={colors.searchTxt}
        />
        <IconBtn
          onPress={toggleContinuous}
          name="align-justify"
          color={colors.accent}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.topLeftBar,
        { backgroundColor: colors.searchBg, borderColor: colors.page },
      ]}
    >
      <IconBtn
        onPress={onBack}
        name="corner-up-left"
        color={colors.searchTxt}
      />
      <IconBtn
        onPress={jumpPrev}
        name="chevron-left"
        color={colors.searchTxt}
      />
      <IconBtn
        onPress={jumpNext}
        name="chevron-right"
        color={colors.searchTxt}
      />
      <View style={[styles.divider, { backgroundColor: colors.page }]} />
      <IconBtn
        onPress={onOpenSettings}
        name="settings"
        color={colors.searchTxt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topLeftBar: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 1000,
    elevation: 12,
  },
  divider: { width: 1, height: 18, opacity: 0.5, marginHorizontal: 2 },
});
