/**
 * ViewToggle — переключатель режимов отображения (например список/сетка).
 * По мотиву PulseSync Packages/ui ViewToggle: сегментированный контрол с индикатором и hover на ПК.
 */
import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const BUTTON_SIZE = 36;
const PAD = 4;
const INDICATOR_RADIUS = 6;

export type ViewToggleOption = {
  value: string;
  /** Иконка или (color) => ReactNode */
  icon?: React.ReactNode | ((color: string) => React.ReactNode);
  /** Подпись (опционально, для доступности) */
  label?: string;
};

export type ViewToggleProps = {
  options: ViewToggleOption[];
  value: string;
  onChange: (value: string) => void;
  /** Описание под переключателем */
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function ViewToggle({
  options,
  value,
  onChange,
  description,
  disabled = false,
  style,
  accessibilityLabel,
}: ViewToggleProps) {
  const { colors } = useTheme();
  const index = options.findIndex((o) => o.value === value);
  const selectedIndex = index >= 0 ? index : 0;

  return (
    <View style={[s.wrap, style]}>
      <View
        style={[
          s.container,
          {
            backgroundColor: colors.surfaceElevated ?? colors.bg + "ee",
            borderColor: colors.sub + "30",
          },
          Platform.OS === "web" && ({ userSelect: "none" } as ViewStyle),
        ]}
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
      >
        <View
          style={[
            s.indicator,
            {
              left: PAD + selectedIndex * BUTTON_SIZE,
              width: BUTTON_SIZE,
              backgroundColor: colors.accent,
              borderRadius: INDICATOR_RADIUS,
            },
          ]}
          pointerEvents="none"
        />
        {options.map((opt, i) => {
          const isActive = opt.value === value;
          const iconNode =
            typeof opt.icon === "function" ? opt.icon(isActive ? colors.bg : colors.sub) : opt.icon;
          return (
            <Pressable
              key={opt.value}
              onPress={() => !disabled && onChange(opt.value)}
              disabled={disabled}
              style={({ pressed, hovered }: { pressed?: boolean; hovered?: boolean }) => [
                s.button,
                {
                  opacity: disabled ? 0.6 : pressed ? 0.9 : 1,
                },
                hovered && !disabled && Platform.OS === "web" && {
                  opacity: isActive ? 1 : 0.85,
                },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive, disabled }}
              accessibilityLabel={opt.label ?? opt.value}
            >
              {iconNode != null ? (
                <View style={s.iconWrap}>{iconNode}</View>
              ) : (
                <Text
                  selectable={false}
                  style={[s.buttonText, { color: isActive ? colors.bg : colors.sub }]}
                  numberOfLines={1}
                >
                  {opt.label ?? opt.value}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {description != null && description !== "" ? (
        <Text selectable={false} style={[s.description, { color: colors.sub }]} numberOfLines={2}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
  },
  container: {
    position: "relative",
    flexDirection: "row",
    padding: PAD,
    borderRadius: 8,
    borderWidth: 1,
  },
  indicator: {
    position: "absolute",
    top: PAD,
    bottom: PAD,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: INDICATOR_RADIUS,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    opacity: 0.9,
  },
});
