import { useI18n } from "@/lib/i18n/I18nContext";
import React from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { RowToggle } from "./Buttons";
export interface ReaderSettings {
  orientation: "vertical" | "horizontal";
  dualInLandscape: boolean;
  fit: "contain" | "cover";
}
interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  colors: any;
  canDual: boolean;
  settings: ReaderSettings;
  onOrientationChange: (o: "vertical" | "horizontal") => void;
  onDualToggle: () => void;
  onFitToggle: () => void;
  tapFlipEnabled: boolean;
  onTapFlipToggle: () => void;
  handSwap: boolean;
  onHandSwapToggle: () => void;
  inspect: boolean;
  onInspectToggle: () => void;
  isSingleFrame: boolean;
  continuous: boolean;
  onContinuousToggle: () => void;
  hideHints: boolean;
  onHideHintsToggle: () => void;
}
export function SettingsModal({
  visible,
  onClose,
  colors,
  canDual,
  settings,
  onOrientationChange,
  onDualToggle,
  onFitToggle,
  tapFlipEnabled,
  onTapFlipToggle,
  handSwap,
  onHandSwapToggle,
  inspect,
  onInspectToggle,
  isSingleFrame,
  continuous,
  onContinuousToggle,
  hideHints,
  onHideHintsToggle,
}: SettingsModalProps) {
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const isPhoneDevice = Math.min(width, height) < 600;
  const inspectDisabled = !isSingleFrame;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        android_ripple={{ color: "transparent" }}
      >
        <Pressable
          style={[
            styles.modal,
            {
              backgroundColor: colors.searchBg,
              borderColor: colors.page,
              maxWidth: isPhoneDevice ? Math.min(400, Math.min(width, height) - 32) : 400,
              maxHeight: isPhoneDevice ? "90%" : "85%",
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.searchTxt }]}>
{t("reader.controls.settings")}
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              android_ripple={{ color: colors.accent + "22", borderless: true }}
            >
              <Feather name="x" size={20} color={colors.searchTxt} />
            </Pressable>
          </View>
          <ScrollView 
            style={styles.scrollContent}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {}
            <Pressable
              onPress={() =>
                onOrientationChange(
                  settings.orientation === "vertical" ? "horizontal" : "vertical"
                )
              }
              style={[
                styles.row,
                styles.rowBtn,
                { borderBottomColor: colors.page + "40" },
              ]}
              android_ripple={{ color: colors.accent + "12" }}
            >
              <View style={styles.rowLeft}>
                <Feather
                  name={
                    settings.orientation === "vertical" ? "arrow-down" : "arrow-right"
                  }
                  size={20}
                  color={colors.searchTxt}
                />
                <Text style={[styles.rowLabel, { color: colors.searchTxt }]}>
                  {t("reader.controls.orientation")}
                </Text>
              </View>
              <Text style={[styles.rowValue, { color: colors.accent }]}>
                {settings.orientation === "vertical"
                  ? t("reader.controls.vertical")
                  : t("reader.controls.horizontal")}
              </Text>
            </Pressable>
            {}
            {canDual && (
              <Pressable
                onPress={onDualToggle}
                style={[
                  styles.row,
                  styles.rowBtn,
                  { borderBottomColor: colors.page + "40" },
                ]}
                android_ripple={{ color: colors.accent + "12" }}
              >
                <View style={styles.rowLeft}>
                  <Feather name="layout" size={20} color={colors.searchTxt} />
                  <Text style={[styles.rowLabel, { color: colors.searchTxt }]}>
{t("reader.controls.dual")}
                  </Text>
                </View>
              <View
                style={[
                  styles.toggle,
                  settings.dualInLandscape && {
                    backgroundColor: colors.accent,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    settings.dualInLandscape && {
                      transform: [{ translateX: 20 }],
                    },
                  ]}
                />
              </View>
              </Pressable>
            )}
            {}
            <Pressable
              onPress={onFitToggle}
              style={[
                styles.row,
                styles.rowBtn,
                { borderBottomColor: colors.page + "40" },
              ]}
              android_ripple={{ color: colors.accent + "12" }}
            >
              <View style={styles.rowLeft}>
                <Feather
                  name={settings.fit === "contain" ? "maximize" : "minimize"}
                  size={20}
                  color={colors.searchTxt}
                />
                <Text style={[styles.rowLabel, { color: colors.searchTxt }]}>
{t("reader.controls.fit")}
                </Text>
              </View>
              <Text style={[styles.rowValue, { color: colors.accent }]}>
                {settings.fit === "contain"
                  ? t("reader.controls.fitContain")
                  : t("reader.controls.fitCover")}
              </Text>
            </Pressable>
            {}
            <Pressable
              onPress={onTapFlipToggle}
              style={[
                styles.row,
                styles.rowBtn,
                { borderBottomColor: colors.page + "40" },
              ]}
              android_ripple={{ color: colors.accent + "12" }}
            >
              <View style={styles.rowLeft}>
                <Feather name="loader" size={20} color={colors.searchTxt} />
                <Text style={[styles.rowLabel, { color: colors.searchTxt }]}>
{t("reader.controls.tap")}
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  tapFlipEnabled && { backgroundColor: colors.accent },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    tapFlipEnabled && {
                      transform: [{ translateX: 20 }],
                    },
                  ]}
                />
              </View>
            </Pressable>
            {}
            <Pressable
              onPress={onHandSwapToggle}
              style={[
                styles.row,
                styles.rowBtn,
                { borderBottomColor: colors.page + "40" },
              ]}
              android_ripple={{ color: colors.accent + "12" }}
            >
              <View style={styles.rowLeft}>
                <Feather name="repeat" size={20} color={colors.searchTxt} />
                <Text style={[styles.rowLabel, { color: colors.searchTxt }]}>
{t("reader.controls.handSwap")}
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  handSwap && { backgroundColor: colors.accent },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    handSwap && {
                      transform: [{ translateX: 20 }],
                    },
                  ]}
                />
              </View>
            </Pressable>
            {}
            <Pressable
              onPress={() => {
                if (!inspectDisabled) onInspectToggle();
              }}
              style={[
                styles.row,
                styles.rowBtn,
                { borderBottomColor: colors.page + "40" },
                inspectDisabled && { opacity: 0.45 },
              ]}
              android_ripple={{ color: colors.accent + "12" }}
              disabled={inspectDisabled}
            >
              <View style={styles.rowLeft}>
                <Feather name="search" size={20} color={colors.searchTxt} />
                <Text style={[styles.rowLabel, { color: colors.searchTxt }]}>
{t("reader.controls.inspect")}
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  inspect && !inspectDisabled && { backgroundColor: colors.accent },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    inspect && !inspectDisabled && {
                      transform: [{ translateX: 20 }],
                    },
                  ]}
                />
              </View>
            </Pressable>
            {}
            <Pressable
              onPress={onContinuousToggle}
              style={[
                styles.row,
                styles.rowBtn,
                { borderBottomColor: colors.page + "40" },
              ]}
              android_ripple={{ color: colors.accent + "12" }}
            >
              <View style={styles.rowLeft}>
                <Feather name="align-justify" size={20} color={colors.searchTxt} />
                <Text style={[styles.rowLabel, { color: colors.searchTxt }]}>
{t("reader.controls.continuous")}
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  continuous && { backgroundColor: colors.accent },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    continuous && {
                      transform: [{ translateX: 20 }],
                    },
                  ]}
                />
              </View>
            </Pressable>
            {}
            <Pressable
              onPress={onHideHintsToggle}
              style={[
                styles.row,
                styles.rowBtn,
                { borderBottomColor: colors.page + "40" },
              ]}
              android_ripple={{ color: colors.accent + "12" }}
            >
              <View style={styles.rowLeft}>
                <Feather name="eye-off" size={20} color={colors.searchTxt} />
                <Text style={[styles.rowLabel, { color: colors.searchTxt }]}>
                  {t("settings.reader.hideHints")}
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  hideHints && { backgroundColor: colors.accent },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    hideHints && {
                      transform: [{ translateX: 20 }],
                    },
                  ]}
                />
              </View>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "85%",
    ...Platform.select({
      android: {
        elevation: 8,
      },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
    borderRadius: 20,
  },
  scrollContent: {
    flexGrow: 0,
  },
  content: {
    paddingVertical: 8,
    paddingBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  rowBtn: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ccc",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    ...Platform.select({
      android: {
        elevation: 2,
      },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
    }),
  },
});
