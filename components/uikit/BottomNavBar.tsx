/**
 * BottomNavBar — нижняя навигация (перелистывание страниц).
 * Иконка + подпись, активная вкладка с «таблеткой», плавная анимация и hover на ПК/Electron.
 */
import type { ThemeColors } from "@/lib/ThemeContext";
import { useTheme } from "@/lib/ThemeContext";
import React, { useEffect, useRef, useState } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const INDICATOR_ANIM_DURATION = 220;
const PILL_HORIZONTAL_INSET = 3;
const PILL_VERTICAL_INSET = 6;

export type BottomNavBarItem = {
  value: string;
  label: string;
  /** (color: string) => ReactNode, цвет подставляется в зависимости от active/hover */
  icon: (color: string) => React.ReactNode;
};

export type BottomNavBarProps = {
  items: BottomNavBarItem[];
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  /** Описание под панелью (для демо/доступности) */
  description?: string;
};

const HOVER_WHITE = "#fff";
const HOVER_TRANSITION_MS = 200;

type TabLayout = { x: number; width: number };

const hoverTransitionStyle =
  Platform.OS === "web"
    ? ({ transition: `color ${HOVER_TRANSITION_MS}ms ease` } as ViewStyle)
    : {};

function TabItem({
  item,
  index,
  isActive,
  colors,
  onPress,
  onLayout: onTabLayout,
}: {
  item: BottomNavBarItem;
  index: number;
  isActive: boolean;
  colors: ThemeColors;
  onPress: () => void;
  onLayout: (index: number, layout: TabLayout) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const iconColor =
    Platform.OS === "web" && hovered && !isActive
      ? HOVER_WHITE
      : isActive
        ? colors.accent
        : colors.sub;
  const textColor =
    Platform.OS === "web" && hovered && !isActive
      ? HOVER_WHITE
      : isActive
        ? colors.accent
        : colors.sub;

  return (
    <View
      style={s.tabWrap}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        onTabLayout(index, { x, width });
      }}
    >
      <Pressable
        onPress={onPress}
        onPointerEnter={Platform.OS === "web" ? () => setHovered(true) : undefined}
        onPointerLeave={Platform.OS === "web" ? () => setHovered(false) : undefined}
        style={({ pressed }) => [
          s.tab,
          { opacity: pressed ? 0.9 : 1 },
          Platform.OS === "web" && ({ userSelect: "none" } as ViewStyle),
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={item.label}
      >
        <View style={[s.iconWrap, hoverTransitionStyle]}>{item.icon(iconColor)}</View>
        <Text
          selectable={false}
          numberOfLines={1}
          style={[
            s.label,
            { color: textColor, fontWeight: isActive ? "600" : "500" },
            hoverTransitionStyle as TextStyle,
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    </View>
  );
}

export function BottomNavBar({
  items,
  value,
  onChange,
  style,
  description,
}: BottomNavBarProps) {
  const { colors } = useTheme();
  const index = items.findIndex((i) => i.value === value);
  const selectedIndex = index >= 0 ? index : 0;
  const [tabLayouts, setTabLayouts] = useState<TabLayout[]>([]);
  const leftAnim = useRef(new Animated.Value(0)).current;
  const widthAnim = useRef(new Animated.Value(0)).current;

  const activeLayout = tabLayouts[selectedIndex];
  const pillWidth = activeLayout
    ? Math.round(activeLayout.width - 2 * PILL_HORIZONTAL_INSET)
    : 0;
  const prevIndexRef = useRef(selectedIndex);

  useEffect(() => {
    if (activeLayout == null) return;
    const targetLeft = Math.round(activeLayout.x + PILL_HORIZONTAL_INSET);
    const targetWidth = Math.round(activeLayout.width - 2.5 * PILL_HORIZONTAL_INSET);
    const indexChanged = prevIndexRef.current !== selectedIndex;
    prevIndexRef.current = selectedIndex;

    if (indexChanged) {
      Animated.parallel([
        Animated.timing(leftAnim, {
          toValue: targetLeft,
          duration: INDICATOR_ANIM_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(widthAnim, {
          toValue: targetWidth,
          duration: INDICATOR_ANIM_DURATION,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      leftAnim.setValue(targetLeft);
      widthAnim.setValue(targetWidth);
    }
  }, [selectedIndex, activeLayout, leftAnim, widthAnim]);

  const onTabLayout = (i: number, layout: TabLayout) => {
    setTabLayouts((prev) => {
      const next = [...prev];
      next[i] = layout;
      return next;
    });
    if (i === selectedIndex) {
      leftAnim.setValue(Math.round(layout.x + PILL_HORIZONTAL_INSET));
      widthAnim.setValue(Math.round(layout.width - 2 * PILL_HORIZONTAL_INSET));
    }
  };

  const barBg = colors.surfaceElevated ?? colors.menuBg ?? colors.bg + "ee";
  const borderColor = colors.sub + "25";

  return (
    <View style={[s.wrap, style]}>
      <View
        style={[
          s.container,
          {
            backgroundColor: barBg,
            borderColor,
          },
          Platform.OS === "web" && ({ userSelect: "none" } as ViewStyle),
        ]}
        accessibilityRole="tablist"
      >
        {/* Таблетка по замерам вкладки — ровно по центру контента */}
        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              s.indicator,
              {
                top: PILL_VERTICAL_INSET,
                bottom: PILL_VERTICAL_INSET,
                backgroundColor: colors.accent + "28",
                borderRadius: 9999,
                left: leftAnim,
                width: widthAnim,
              },
            ]}
          />
        ) : null}

        {items.map((item, i) => (
          <TabItem
            key={item.value}
            item={item}
            index={i}
            isActive={item.value === value}
            colors={colors}
            onPress={() => onChange(item.value)}
            onLayout={onTabLayout}
          />
        ))}
      </View>
      {description != null && description !== "" ? (
        <Text
          selectable={false}
          style={[s.description, { color: colors.sub }]}
          numberOfLines={2}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: "100%",
    alignSelf: "stretch",
  },
  container: {
    position: "relative",
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-around",
    paddingVertical: PILL_VERTICAL_INSET,
    paddingHorizontal: PILL_HORIZONTAL_INSET,
    borderRadius: 50,
    overflow: "hidden",
  },
  indicator: {
    position: "absolute",
  },
  tabWrap: {
    flex: 1,
    minWidth: 0,
  },
  tab: {
    position: "relative",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    minWidth: 0,
  },
  iconWrap: {
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
    opacity: 0.9,
  },
});
