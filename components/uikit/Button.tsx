import { useTheme } from "@/lib/ThemeContext";
import React, { useEffect, useRef, useState } from "react";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import {
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "chip";

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  onLongPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  progress?: number;
  leftIcon?: React.ReactNode | ((iconColor: string) => React.ReactNode);
  rightIcon?: React.ReactNode | ((iconColor: string) => React.ReactNode);
  iconGap?: number;
  iconStyle?: StyleProp<ViewStyle>;
  iconOnly?: boolean;
  /** Explicit width */
  width?: DimensionValue;
  /** Explicit height */
  height?: DimensionValue;
  /** Minimum width */
  minWidth?: DimensionValue;
  /** Maximum width */
  maxWidth?: DimensionValue;
  /** Stretch to fill parent width */
  fullWidth?: boolean;
};

const PRESS_SCALE = 0.97;
const ANIM_DURATION = 120;

function hexLuminance(hex: string): number {
  const h = hex.replace(/^#/, "");
  const normalized = h.length > 6 ? h.slice(0, 6) : h;
  if (normalized.length !== 6) return 0.5;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastTextOn(backgroundColorHex: string): string {
  return hexLuminance(backgroundColorHex) > 0.45 ? "#1a1a1b" : "#ffffff";
}

const CIRCLE_SIZE = 28;
const CIRCLE_STROKE = 3;
const CIRCLE_R = (CIRCLE_SIZE - CIRCLE_STROKE) / 2;
const CIRCLE_CX = CIRCLE_SIZE / 2;
const CIRCLE_CY = CIRCLE_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

export function Button({
  title,
  onPress,
  onLongPress,
  variant = "primary",
  disabled = false,
  compact = false,
  style,
  accessibilityLabel,
  loading = false,
  loadingLabel,
  progress,
  leftIcon,
  rightIcon,
  iconGap = 8,
  iconStyle,
  iconOnly = false,
  width,
  height,
  minWidth,
  maxWidth,
  fullWidth = false,
}: ButtonProps) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);
  const isBusy = disabled || loading;
  const showProgress = progress !== undefined && progress >= 0;
  const hasIcon = !!(leftIcon || rightIcon);
  const showAsIconOnly = iconOnly || (hasIcon && !title);

  const animateTo = (value: number) => {
    Animated.timing(scaleAnim, {
      toValue: value,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => {
    if (isBusy) return;
    if (Platform.OS === "android") Vibration.vibrate(10);
    animateTo(PRESS_SCALE);
  };
  const handlePressOut = () => animateTo(1);

  const primaryBg = colors.accent;
  const secondaryBg = colors.accent + "28";

  const variantViewStyle: ViewStyle = {
    primary: {
      backgroundColor: primaryBg,
      borderRadius: 12,
      borderWidth: 0,
      ...(Platform.OS === "android"
        ? { elevation: 3 }
        : {
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
          }),
    },
    secondary: {
      backgroundColor: secondaryBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.accent + "35",
    },
    outline: {
      backgroundColor: "transparent",
      borderRadius: 12,
      borderWidth: 2.5,
      borderColor: colors.accent,
    },
    ghost: {
      backgroundColor: "transparent",
      borderRadius: 12,
      borderWidth: 0,
    },
    chip: {
      backgroundColor: colors.accent + "22",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.accent + "55",
    },
  }[variant]!;

  const isCompactVariant = variant === "ghost" || variant === "chip";
  const effectiveCompact = compact || isCompactVariant;
  const isGhostOrChip = variant === "ghost" || variant === "chip";

  const labelColor =
    variant === "primary"
      ? contrastTextOn(primaryBg)
      : colors.accent;

  const displayLabel = loading ? (loadingLabel ?? title) : title;
  const progressPct = showProgress ? Math.min(1, Math.max(0, progress ?? 0)) : 0;

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [loading, showProgress, title, showAsIconOnly]);

  const iconColor = labelColor;
  const resolvedLeftIcon = typeof leftIcon === "function" ? leftIcon(iconColor) : leftIcon;
  const resolvedRightIcon = typeof rightIcon === "function" ? rightIcon(iconColor) : rightIcon;
  const progressStrokeDash = progressPct * CIRCUMFERENCE;
  const progressOpacity = Platform.OS === "android" ? 0.45 : 0.55;

  const hoverBg = isGhostOrChip && hovered && !isBusy
    ? { backgroundColor: variant === "ghost" ? colors.accent + "14" : colors.accent + "2a" }
    : undefined;

  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.loadingRow, { gap: iconGap }]}>
          <ActivityIndicator size="small" color={labelColor} style={styles.loader} />
          {!showAsIconOnly && (
            <Text
              selectable={false}
              numberOfLines={1}
              style={[
                styles.label,
                effectiveCompact && styles.labelCompact,
                isGhostOrChip && styles.labelCompactSmall,
                { color: labelColor },
              ]}
            >
              {displayLabel}
            </Text>
          )}
        </View>
      );
    }
    if (showAsIconOnly && (resolvedLeftIcon || resolvedRightIcon)) {
      return (
        <View style={[styles.iconOnlyRow, { gap: iconGap }, iconStyle]}>
          {resolvedLeftIcon}
          {resolvedRightIcon}
        </View>
      );
    }
    const textEl = title ? (
      <Text
        selectable={false}
        numberOfLines={1}
        style={[
          styles.label,
          effectiveCompact && styles.labelCompact,
          isGhostOrChip && styles.labelCompactSmall,
          { color: labelColor },
          disabled && styles.labelDisabled,
        ]}
      >
        {title}
      </Text>
    ) : null;
    if (!resolvedLeftIcon && !resolvedRightIcon) return textEl;
    return (
      <View style={[styles.iconRow, { gap: iconGap }]}>
        {resolvedLeftIcon ? <View style={iconStyle}>{resolvedLeftIcon}</View> : null}
        {textEl}
        {resolvedRightIcon ? <View style={iconStyle}>{resolvedRightIcon}</View> : null}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.wrapper,
        effectiveCompact && styles.wrapperCompact,
        showAsIconOnly && styles.wrapperIconOnly,
        fullWidth && styles.wrapperFullWidth,
        variantViewStyle,
        hoverBg,
        !isBusy && hovered && !isGhostOrChip && styles.hover,
        width != null && { width },
        height != null && { height },
        minWidth != null && { minWidth },
        maxWidth != null && { maxWidth },
        style,
        Platform.OS === "web" && ({ userSelect: "none" } as ViewStyle),
      ]}
      // @ts-ignore — web-only pointer events for hover
      onPointerEnter={Platform.OS === "web" ? () => setHovered(true) : undefined}
      onPointerLeave={Platform.OS === "web" ? () => setHovered(false) : undefined}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isBusy}
        delayLongPress={Platform.OS === "android" ? 400 : 350}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (showAsIconOnly ? undefined : title)}
        accessibilityState={{ busy: loading }}
        android_ripple={
          !isBusy
            ? {
                color: variant === "primary" ? "rgba(0,0,0,0.08)" : colors.accent + "18",
                borderless: variant === "ghost",
                radius: Platform.OS === "android" ? 80 : undefined,
              }
            : undefined
        }
        style={styles.pressableFill}
      >
        {showProgress ? (
          <View
            style={[styles.inner, effectiveCompact && styles.innerCompact]}
            pointerEvents="none"
          >
            <View style={styles.progressContent}>
              <View style={styles.circleProgressWrap}>
                <Svg
                  width={CIRCLE_SIZE}
                  height={CIRCLE_SIZE}
                  style={styles.circleProgressSvg}
                >
                  <Circle
                    cx={CIRCLE_CX}
                    cy={CIRCLE_CY}
                    r={CIRCLE_R}
                    stroke={colors.accent + "40"}
                    strokeWidth={CIRCLE_STROKE}
                    fill="none"
                  />
                  <Circle
                    cx={CIRCLE_CX}
                    cy={CIRCLE_CY}
                    r={CIRCLE_R}
                    stroke={colors.accent}
                    strokeWidth={CIRCLE_STROKE}
                    fill="none"
                    strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                    strokeDashoffset={CIRCUMFERENCE - progressStrokeDash}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${CIRCLE_CX} ${CIRCLE_CY})`}
                    opacity={progressOpacity}
                  />
                </Svg>
              </View>
              {progressPct >= 1 && title ? (
                <Text
                  selectable={false}
                  numberOfLines={1}
                  style={[
                    styles.label,
                    effectiveCompact && styles.labelCompact,
                    isGhostOrChip && styles.labelCompactSmall,
                    { color: labelColor, marginTop: 6 },
                  ]}
                >
                  {title}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.inner,
              effectiveCompact && styles.innerCompact,
              isGhostOrChip && styles.innerCompactSmall,
              showAsIconOnly && styles.innerIconOnly,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            {renderContent()}
          </Animated.View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  wrapperCompact: {},
  wrapperFullWidth: {
    alignSelf: "stretch",
  },
  wrapperIconOnly: {
    minWidth: 48,
  },
  hover: { opacity: 0.92 },
  pressed: { opacity: 0.88 },
  pressableFill: {},
  inner: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    flexShrink: 0,
  },
  innerCompact: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: 40,
  },
  innerCompactSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 32,
  },
  innerIconOnly: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    minWidth: 48,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconOnlyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.35,
    flexShrink: 0,
  },
  labelCompact: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  labelCompactSmall: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.25,
  },
  labelDisabled: {
    opacity: 0.5,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loader: {
    marginRight: 0,
  },
  progressContent: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  circleProgressWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  circleProgressSvg: {
    overflow: "visible",
  },
});
