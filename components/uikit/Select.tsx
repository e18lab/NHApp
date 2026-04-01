/**
 * Select — простой выбор из плоского списка.
 * Label и значение в одном блоке, описание снаружи под полем. Hover на ПК, открытие вверх при нехватке места снизу.
 */
import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Dimensions,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const SCREEN_MARGIN = 12;
const GAP = 6;
const PANEL_MAX_H = 320;

export type SelectOption = {
  value: string | number;
  label: string;
};

export type SelectProps = {
  /** Подпись над полем (внутри блока) */
  label?: string;
  /** Описание: вынесено наружу под полем */
  description?: string;
  value?: string | number | null;
  options: SelectOption[];
  onChange?: (value: string | number) => void;
  /** При отличии value от defaultValue показывается сброс */
  defaultValue?: string | number;
  disabled?: boolean;
  placeholder?: string;
  /** Текст ошибки (под полем) */
  error?: string;
  resetText?: string;
  style?: StyleProp<ViewStyle>;
};

export function Select({
  label,
  description,
  value,
  options,
  onChange,
  defaultValue,
  disabled = false,
  placeholder = "Select…",
  error,
  resetText = "Reset",
  style,
}: SelectProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<View>(null);
  const [layout, setLayout] = useState({ x: 0, y: 0, w: 200, h: 40 });

  const strValue = value != null ? String(value) : undefined;
  const selected = options.find((o) => String(o.value) === strValue);
  const displayLabel = selected ? selected.label : placeholder;
  const isPlaceholder = !selected;
  const canShowReset = defaultValue !== undefined;
  const canReset =
    canShowReset && strValue !== undefined && strValue !== String(defaultValue);

  const measure = useCallback(() => {
    if (!triggerRef.current) return;
    if (Platform.OS === "web") {
      const el = triggerRef.current as unknown as HTMLElement;
      if (el?.getBoundingClientRect) {
        const r = el.getBoundingClientRect();
        setLayout({ x: r.left, y: r.top, w: Math.max(r.width, 200), h: r.height || 40 });
      }
    } else {
      triggerRef.current.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) setLayout({ x, y, w: Math.max(w, 200), h: h || 40 });
      });
    }
  }, []);

  const handleLayout = (e: LayoutChangeEvent) => {
    measure();
  };

  const handleOpen = () => {
    if (disabled) return;
    measure();
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const commit = (opt: SelectOption) => {
    onChange?.(opt.value);
    handleClose();
  };

  const errorColor = "#e57373";
  const borderColor = error ? errorColor : colors.sub + "40";
  const bg = colors.surfaceElevated ?? colors.bg + "ee";

  const screen = Dimensions.get("window");
  const panelHPreview = Math.min(options.length * 44 + 12, PANEL_MAX_H);
  const spaceBelow = screen.height - layout.y - layout.h - SCREEN_MARGIN;
  const spaceAbove = layout.y - SCREEN_MARGIN;
  const opensBelow =
    spaceBelow >= Math.min(panelHPreview, PANEL_MAX_H) || spaceBelow >= spaceAbove;
  const panelTop = opensBelow
    ? layout.y + layout.h + GAP
    : Math.max(SCREEN_MARGIN, layout.y - Math.min(panelHPreview, spaceAbove, PANEL_MAX_H) - GAP);
  const panelMaxHeight = opensBelow
    ? Math.min(PANEL_MAX_H, Math.max(spaceBelow - GAP, 100))
    : Math.min(PANEL_MAX_H, Math.max(spaceAbove - GAP, 100));

  return (
    <View style={[s.wrap, style]}>
      <Pressable
        ref={triggerRef as any}
        onLayout={handleLayout}
        onPress={handleOpen}
        disabled={disabled}
        style={({ pressed, hovered }: { pressed?: boolean; hovered?: boolean }) => [
          s.trigger,
          {
            backgroundColor: bg,
            borderColor: open ? colors.accent + "60" : borderColor,
          },
          hovered && !disabled && !open && Platform.OS === "web" && {
            backgroundColor: colors.accent + "12",
            borderColor: colors.accent + "55",
          },
          pressed && { opacity: 0.9 },
          disabled && { opacity: 0.5 },
          Platform.OS === "web" && ({ userSelect: "none" } as ViewStyle),
        ]}
      >
        <View style={s.triggerInner}>
          {(label != null && label !== "") || canShowReset ? (
            <View style={s.labelRow}>
              {label != null && label !== "" ? (
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
                      onPress={(e) => {
                        e.stopPropagation();
                        if (defaultValue !== undefined) onChange?.(defaultValue);
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
          ) : null}
          <View style={s.valueLine}>
            <Text
              selectable={false}
              numberOfLines={1}
              style={[
                s.valueText,
                { color: isPlaceholder ? colors.sub : colors.txt },
              ]}
            >
              {displayLabel}
            </Text>
            <View style={s.arrowWrap}>
              <Feather
                name={open ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.sub}
              />
            </View>
          </View>
        </View>
      </Pressable>

      {description != null && description !== "" ? (
        <Text selectable={false} style={[s.description, { color: colors.sub }]} numberOfLines={2}>
          {description}
        </Text>
      ) : null}

      {error != null && error !== "" ? (
        <Text selectable={false} style={[s.errorText, { color: errorColor }]}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Pressable
          style={[
            s.panel,
            {
              position: "absolute",
              top: panelTop,
              left: Math.max(SCREEN_MARGIN, Math.min(layout.x, screen.width - layout.w - SCREEN_MARGIN)),
              minWidth: layout.w,
              maxHeight: panelMaxHeight,
              backgroundColor: colors.surfaceElevated ?? colors.bg,
              borderColor: colors.sub + "30",
            },
            Platform.OS === "web" && ({ userSelect: "none" } as ViewStyle),
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView
            style={[s.list, { maxHeight: panelMaxHeight - 12 }]}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {options.map((opt) => {
              const active = String(opt.value) === strValue;
              return (
                <Pressable
                  key={String(opt.value)}
                  onPress={() => commit(opt)}
                  style={({ hovered }: { hovered?: boolean }) => [
                    s.option,
                    {
                      backgroundColor: active ? colors.accent + "18" : "transparent",
                    },
                    hovered && Platform.OS === "web" && {
                      backgroundColor: active ? colors.accent + "22" : colors.accent + "0c",
                    },
                  ]}
                >
                  <Text
                    selectable={false}
                    numberOfLines={1}
                    style={[s.optionLabel, { color: colors.txt }]}
                  >
                    {opt.label}
                  </Text>
                  {active ? (
                    <Feather name="check" size={16} color={colors.accent} strokeWidth={2.5} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignSelf: "stretch",
    maxWidth: 400,
  },
  trigger: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 56,
  },
  triggerInner: {
    flexDirection: "column",
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 17,
  },
  label: {
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 17,
    flex: 1,
  },
  labelSpacer: { flex: 1 },
  resetSlot: {
    minWidth: 48,
    alignItems: "flex-end",
    justifyContent: "center",
    height: 17,
  },
  resetBtn: {
    paddingVertical: 0,
    paddingHorizontal: 4,
    minHeight: 17,
    justifyContent: "center",
  },
  resetBtnText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
  },
  valueLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  valueText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "500",
    marginRight: 8,
  },
  arrowWrap: {
    opacity: 0.8,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    opacity: 0.9,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
  panel: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 6,
    overflow: "hidden",
  },
  list: {
    maxHeight: 280,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  optionLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
});
