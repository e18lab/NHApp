/**
 * Toggle — switch with label and custom enabled/disabled text.
 * UIKit element: accessible, theme-aware.
 */
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  AccessibilityState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  /** Shown when value is true (e.g. "Включено") */
  enabledText?: string;
  /** Shown when value is false (e.g. "Выключено") */
  disabledText?: string;
  /** При отличии value от defaultValue показывается сброс (опционально) */
  defaultValue?: boolean;
  resetText?: string;
  /** Описание под переключателем (мелкий текст) */
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Toggle({
  value,
  onValueChange,
  label,
  enabledText = "Включено",
  disabledText = "Выключено",
  defaultValue,
  resetText = "Reset",
  description,
  disabled = false,
  style,
  accessibilityLabel,
}: ToggleProps) {
  const { colors } = useTheme();
  const canShowReset = defaultValue !== undefined;
  const canReset = canShowReset && value !== defaultValue;

  return (
    <View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled } as AccessibilityState}
        accessibilityLabel={accessibilityLabel ?? `${label}, ${value ? enabledText : disabledText}`}
        disabled={disabled}
        onPress={() => onValueChange(!value)}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          s.container,
          {
            backgroundColor: colors.surfaceElevated ?? colors.bg + "ee",
            borderColor: colors.sub + "30",
          },
          hovered && !disabled && {
            backgroundColor: colors.accent + "12",
            borderColor: colors.accent + "40",
          },
          pressed && { opacity: 0.85 },
          disabled && { opacity: 0.6 },
          style,
          Platform.OS === "web" && ({ userSelect: "none" } as ViewStyle),
        ]}
      >
        <View style={s.labelRow}>
          <Text selectable={false} style={[s.label, { color: colors.txt }]} numberOfLines={1}>
            {label}
          </Text>
          {canShowReset ? (
            <View style={s.resetSlot}>
              {canReset ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    if (defaultValue !== undefined) onValueChange(defaultValue);
                  }}
                  hitSlop={8}
                  style={({ hovered: h }: { hovered?: boolean }) => [s.resetBtn, h && { opacity: 0.85 }]}
                >
                  <Text selectable={false} style={[s.resetBtnText, { color: colors.accent }]}>
                    {resetText}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={s.valueLine}>
          <Text
            selectable={false}
            style={[
              s.value,
              { color: value ? colors.txt : colors.sub },
              !value && s.valueInactive,
            ]}
            numberOfLines={1}
          >
            {value ? enabledText : disabledText}
          </Text>
          <View style={s.indicator}>
            {value ? (
              <Feather name="check" size={18} color={colors.accent} strokeWidth={2.5} />
            ) : (
              <Feather name="minus" size={18} color={colors.sub} strokeWidth={2.5} />
            )}
          </View>
        </View>
      </Pressable>
      {description != null && description !== "" ? (
        <Text selectable={false} style={[s.description, { color: colors.sub }]} numberOfLines={3}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 200,
    maxWidth: 600,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
    minHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    flex: 1,
  },
  resetSlot: {
    minWidth: 48,
    alignItems: "flex-end",
    justifyContent: "center",
    height: 18,
  },
  resetBtn: {
    paddingVertical: 0,
    paddingHorizontal: 4,
    minHeight: 18,
    justifyContent: "center",
  },
  resetBtnText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  valueLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
    opacity: 0.9,
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  valueInactive: {
    opacity: 0.85,
  },
  indicator: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
