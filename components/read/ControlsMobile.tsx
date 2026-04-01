import { useI18n } from "@/lib/i18n/I18nContext";
import React from "react";
import { StyleSheet, View } from "react-native";
import { RowBtn } from "./Buttons";

export function ControlsMobile({
  colors,
  onBack,
  onOpenSettings,
  continuous,
  toggleContinuous,
}: {
  colors: any;
  onBack: () => void;
  onOpenSettings: () => void;
  continuous: boolean;
  toggleContinuous: () => void;
}) {
  const { t } = useI18n();

  if (continuous) {
    return (
      <>
        <View
          style={[
            styles.topBar,
            { borderColor: colors.page + "60" },
          ]}
        >
          <View style={styles.slot}>
            <RowBtn
              onPress={onBack}
              icon="corner-up-left"
              label={t("reader.controls.back")}
              color={colors.searchTxt}
            />
          </View>

          <View style={styles.slot}>
            <RowBtn
              onPress={toggleContinuous}
              icon="align-justify"
              label={t("reader.controls.scroll")}
              color={colors.accent}
            />
          </View>
        </View>
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: colors.searchBg, borderColor: colors.page },
          ]}
        />
      </>
    );
  }

  return (
    <>
      <View
        style={[
          styles.topBar,
          { borderColor: colors.page + "60" },
        ]}
      >
        <View style={styles.slot}>
          <RowBtn
            onPress={onBack}
            icon="corner-up-left"
            label={t("reader.controls.back")}
            color={colors.searchTxt}
          />
        </View>

        <View style={styles.slot}>
          <RowBtn
            onPress={onOpenSettings}
            icon="settings"
            label={t("reader.controls.settings")}
            color={colors.searchTxt}
          />
        </View>
      </View>
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: colors.searchBg, borderColor: colors.page },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8 + 76 + 8,
    height: 1,
    opacity: 0,
  },
  topBar: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 0,
    zIndex: 19,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  slot: {
    alignItems: "center",
    minWidth: 0,
    marginHorizontal: 0,
  },
});
