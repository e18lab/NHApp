/**
 * Slider — range slider with label, unit, editable value, reset.
 * Design matches PulseSync Packages/ui: fill bar + edge indicator (thin line), no circular thumb.
 */
import { useTheme } from "@/lib/ThemeContext";
import React, { useCallback, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  AccessibilityState,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyInputModal } from "./KeyInputModal";

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const snap = (n: number, step: number, min: number) =>
  Math.round((n - min) / step) * step + min;

export type SliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange?: (value: number) => void;
  /** When set, a "Reset" control appears when value differs from default */
  defaultValue?: number;
  label?: string;
  /** Unit suffix (e.g. '%', 'px') */
  unit?: string;
  /** Show the numeric value (default true) */
  showValue?: boolean;
  /** Allow editing the value by tapping (default true) */
  editable?: boolean;
  disabled?: boolean;
  resetText?: string;
  /** Описание под слайдером (мелкий текст) */
  description?: string;
  style?: StyleProp<ViewStyle>;
  /** Accessibility label for the slider */
  accessibilityLabel?: string;
};

const BAR_HEIGHT = 44;
const EDGE_WIDTH = 3;
const EDGE_INSET = 4;
const BAR_PADDING_H = 16;

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  defaultValue,
  label,
  unit = "",
  showValue = true,
  editable = true,
  disabled = false,
  resetText = "Reset",
  description,
  style,
  accessibilityLabel,
}: SliderProps) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const trackWidthRef = useRef(0);
  const startXRef = useRef(0);
  const hasMovedRef = useRef(false);
  const TAP_MOVE_THRESHOLD_PX = 15;

  const range = Math.max(0.00001, max - min);
  const v = clamp(value, min, max);
  const pct = ((v - min) / range) * 100;
  const canShowReset = defaultValue !== undefined;
  const canReset = canShowReset && value !== defaultValue;

  const commit = useCallback(
    (n: number) => {
      onChange?.(clamp(snap(n, step, min), min, max));
    },
    [onChange, step, min, max]
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  const valueFromX = useCallback(
    (locationX: number) => {
      const w = trackWidthRef.current;
      if (w <= 0) return v;
      const ratio = clamp(locationX / w, 0, 1);
      return min + ratio * range;
    },
    [min, range, v]
  );

  const commitRef = useRef(commit);
  const valueFromXRef = useRef(valueFromX);
  const editingRef = useRef(editing);
  const editableRef = useRef(editable);
  const disabledRef = useRef(disabled);
  const startEditRef = useRef<() => void>(() => {});
  commitRef.current = commit;
  valueFromXRef.current = valueFromX;
  editingRef.current = editing;
  editableRef.current = editable;
  disabledRef.current = disabled;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !editingRef.current,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setDragging(true);
        startXRef.current = evt.nativeEvent.locationX;
        hasMovedRef.current = false;
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const dx = Math.abs(x - startXRef.current);
        if (dx > TAP_MOVE_THRESHOLD_PX) hasMovedRef.current = true;
        if (hasMovedRef.current) commitRef.current(valueFromXRef.current(x));
      },
      onPanResponderRelease: (evt) => {
        const releaseX = evt.nativeEvent.locationX;
        const w = trackWidthRef.current;
        const grantX = startXRef.current;
        const tappedInCenter =
          w > 0 &&
          !hasMovedRef.current &&
          grantX >= w * 0.3 &&
          grantX <= w * 0.7;
        if (tappedInCenter && editableRef.current && !disabledRef.current) {
          startEditRef.current();
        } else if (!hasMovedRef.current) {
          commitRef.current(valueFromXRef.current(releaseX));
        }
        setDragging(false);
      },
    })
  ).current;

  const handleReset = () => {
    if (defaultValue !== undefined) onChange?.(defaultValue);
  };

  const startEdit = () => {
    if (!editable || disabled) return;
    setDraft(String(v));
    setEditing(true);
  };
  startEditRef.current = startEdit;

  const stopEdit = (apply: boolean) => {
    if (apply) {
      const num = Number(draft.replace(",", "."));
      if (Number.isFinite(num)) commit(num);
    }
    setEditing(false);
  };

  const barBg = colors.surfaceElevated ?? colors.bg + "ee";
  const barBorder = dragging ? colors.accent + "55" : colors.sub + "30";
  const fillOpacity = dragging ? 0.22 : 0.12;
  const edgeOpacity = dragging ? 0.9 : 0.5;

  const barContainerStyle = [
    s.bar,
    {
      backgroundColor: barBg,
      borderColor: barBorder,
    },
  ];

  const barContent = (
    <>
      <View
        style={[
          s.fill,
          {
            width: `${pct}%`,
            backgroundColor: colors.accent,
            opacity: fillOpacity,
          },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          s.edge,
          {
            left: `${pct}%`,
            marginLeft: -EDGE_WIDTH / 2,
            backgroundColor: colors.accent,
            opacity: edgeOpacity,
          },
        ]}
        pointerEvents="none"
      />
      <View
        style={[s.content, { paddingHorizontal: BAR_PADDING_H }]}
        pointerEvents={Platform.OS === "web" ? "box-none" : "none"}
      >
        <Text selectable={false} style={[s.edgeLabel, { color: colors.sub }]} numberOfLines={1}>
          {min}{unit}
        </Text>
        {showValue ? (
          <View style={s.valueCenter} pointerEvents={Platform.OS === "web" ? "auto" : "none"}>
            {!editing ? (
              Platform.OS === "web" ? (
                <Pressable
                  onPress={startEdit}
                  disabled={!editable || disabled}
                  style={({ pressed }: { pressed?: boolean }) => [
                    s.valueTouchable,
                    { backgroundColor: pressed ? colors.accent + "18" : "transparent" },
                  ]}
                  hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}
                >
                  <Text selectable={false} style={[s.valueText, { color: colors.txt }]}>
                    {v}
                    {unit ? <Text selectable={false} style={[s.unitText, { color: colors.sub }]}>{unit}</Text> : null}
                  </Text>
                </Pressable>
              ) : (
                <Text selectable={false} style={[s.valueText, { color: colors.txt }]}>
                  {v}
                  {unit ? <Text selectable={false} style={[s.unitText, { color: colors.sub }]}>{unit}</Text> : null}
                </Text>
              )
            ) : Platform.OS === "web" ? (
              <TextInput
                style={[
                  s.valueInput,
                  {
                    color: colors.txt,
                    borderColor: colors.accent,
                    backgroundColor: colors.bg,
                  },
                ]}
                value={draft}
                onChangeText={setDraft}
                onBlur={() => stopEdit(true)}
                onSubmitEditing={() => stopEdit(true)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === "Escape") stopEdit(false);
                }}
                keyboardType="numeric"
                selectTextOnFocus
                autoFocus
                placeholder={String(v)}
              />
            ) : (
              <Text selectable={false} style={[s.valueText, { color: colors.txt }]}>
                {v}
                {unit ? <Text selectable={false} style={[s.unitText, { color: colors.sub }]}>{unit}</Text> : null}
              </Text>
            )}
          </View>
        ) : null}
        <Text selectable={false} style={[s.edgeLabel, { color: colors.sub }]} numberOfLines={1}>
          {max}{unit}
        </Text>
      </View>
    </>
  );

  const content = (
    <View
      style={[
        s.wrapper,
        disabled && s.disabled,
        style,
        Platform.OS === "web" && ({ userSelect: "none" } as any),
      ]}
    >
      {(label != null || canShowReset) ? (
        <View style={s.labelRow}>
          {label != null ? (
            <Text selectable={false} style={[s.label, { color: colors.txt }]} numberOfLines={1}>
              {label}
            </Text>
          ) : (
            <View style={s.labelSpacer} />
          )}
          {canShowReset ? (
            <View style={s.resetSlot}>
              {canReset ? (
                <Pressable
                  onPress={handleReset}
                  hitSlop={8}
                  style={({ hovered }: { hovered?: boolean }) => [
                    s.resetBtn,
                    hovered && { opacity: 0.85 },
                  ]}
                >
                  <Text selectable={false} style={[s.resetText, { color: colors.accent }]}>
                    {resetText}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {Platform.OS === "web" ? (
        <Pressable
          style={({ hovered }: { hovered?: boolean }) => [
            s.bar,
            {
              backgroundColor: hovered && !disabled && !dragging ? colors.accent + "12" : barBg,
              borderColor: hovered && !disabled && !dragging ? colors.accent + "55" : barBorder,
            },
          ]}
          onStartShouldSetResponder={() => false}
          onMoveShouldSetResponder={() => false}
        >
          <View
            style={StyleSheet.absoluteFill}
            onLayout={handleLayout}
            accessibilityRole="adjustable"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled } as AccessibilityState}
            accessibilityValue={{ min, max, now: v }}
            {...(disabled ? {} : panResponder.panHandlers)}
          >
            {barContent}
          </View>
        </Pressable>
      ) : (
        <View
          onLayout={handleLayout}
          style={barContainerStyle}
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled } as AccessibilityState}
          accessibilityValue={{ min, max, now: v }}
          {...(disabled ? {} : panResponder.panHandlers)}
        >
          {barContent}
        </View>
      )}

      {description != null && description !== "" ? (
        <Text selectable={false} style={[s.description, { color: colors.sub }]} numberOfLines={3}>
          {description}
        </Text>
      ) : null}
    </View>
  );

  const isNative = Platform.OS === "android" || Platform.OS === "ios";

  if (editing && showValue && isNative) {
    return (
      <>
        {content}
        <KeyInputModal
          visible
          onClose={() => stopEdit(true)}
          value={draft}
          onChangeText={setDraft}
          onSubmit={(val) => {
            const num = Number(val.replace(",", "."));
            if (Number.isFinite(num)) commit(num);
            stopEdit(true);
          }}
          label={label ?? ""}
          keyboardType="numeric"
          placeholder={String(v)}
        />
      </>
    );
  }

  return content;
}

const s = StyleSheet.create({
  wrapper: {
    width: "100%",
    gap: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    flex: 1,
  },
  labelSpacer: { flex: 1 },
  resetSlot: {
    minWidth: 48,
    alignItems: "flex-end",
    justifyContent: "center",
    height: 18,
  },
  resetBtn: {
    paddingVertical: 0,
    paddingHorizontal: 6,
    minHeight: 18,
    justifyContent: "center",
  },
  resetText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    opacity: 0.9,
  },
  bar: {
    position: "relative",
    height: BAR_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 11,
    borderBottomLeftRadius: 11,
  },
  edge: {
    position: "absolute",
    top: EDGE_INSET,
    bottom: EDGE_INSET,
    width: EDGE_WIDTH,
    borderRadius: 2,
  },
  content: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  edgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  valueCenter: {
    alignSelf: "center",
  },
  valueTouchable: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    fontSize: 16,
    fontWeight: "700",
  },
  unitText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 2,
  },
  valueInput: {
    minWidth: 56,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});
