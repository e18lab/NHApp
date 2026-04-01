/**
 * Горизонтальная полоса вкладок в стиле «пилюли» (как BottomNavBar).
 * Активная вкладка — капсула с подсветкой; на ПК при наведении — белый текст (не активная).
 */
import type { ThemeColors } from "@/lib/ThemeContext";
import { useTheme } from "@/lib/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const HOVER_WHITE = "#fff";
const HOVER_TRANSITION_MS = 200;

export type SwipeableTabItem = {
  label: string;
  icon?: (color: string) => React.ReactNode;
};

export type SwipeableTabStripProps = {
  tabs: SwipeableTabItem[] | string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  /** Цвет фона панели (по умолчанию как у BottomNavBar) */
  backgroundColor?: string;
};

const PILL_RADIUS = 24;
const TAB_PADDING_H = 14;
const TAB_PADDING_V = 8;
const MIN_TAB_WIDTH = 72;
const STRIP_PADDING_H = 8;
const STRIP_PADDING_V = 6;
const ICON_GAP = 6;
const PILL_ANIM_DURATION = 220;
/** Горизонтальный отступ контента скролла, чтобы кнопки не обрезались по краям */
const SCROLL_EDGE_PADDING = 0;
/** Отступ пилюли от краёв вкладки (как в BottomNavBar) */
const PILL_HORIZONTAL_INSET = 0;
const PILL_VERTICAL_INSET = 0;
/** Ширина плавного затухания по краям при скролле */
const FADE_EDGE_WIDTH = 24;
function normalizeTabs(tabs: SwipeableTabStripProps["tabs"]): SwipeableTabItem[] {
  return tabs.map((t) =>
    typeof t === "string" ? { label: t } : t
  );
}

/** На Android — более контрастный цвет неактивных вкладок для читаемости */
function getInactiveColor(colors: ThemeColors): string {
  return Platform.OS === "android" ? colors.txt : colors.sub;
}

function TabItem({
  item,
  isSelected,
  colors,
  onPress,
}: {
  item: SwipeableTabItem;
  isSelected: boolean;
  colors: ThemeColors;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const inactiveColor = getInactiveColor(colors);
  const textColor =
    Platform.OS === "web" && hovered && !isSelected
      ? HOVER_WHITE
      : isSelected
        ? colors.accent
        : inactiveColor;
  const iconColor = textColor;
  const transitionStyle =
    Platform.OS === "web"
      ? ({ transition: `color ${HOVER_TRANSITION_MS}ms ease` } as const)
      : {};

  return (
    <Pressable
      onPress={onPress}
      onPointerEnter={Platform.OS === "web" ? () => setHovered(true) : undefined}
      onPointerLeave={Platform.OS === "web" ? () => setHovered(false) : undefined}
      style={[styles.tab]}
    >
      {item.icon ? (
        <View style={[styles.iconWrap, transitionStyle]}>{item.icon(iconColor)}</View>
      ) : null}
      <Text
        numberOfLines={1}
        selectable={false}
        style={[
          styles.tabLabel,
          {
            color: textColor,
            fontWeight: isSelected ? "600" : "500",
            marginLeft: item.icon ? ICON_GAP : 0,
          },
          transitionStyle,
          Platform.OS === "web" && ({ userSelect: "none" } as const),
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

type TabLayout = { x: number; width: number };

export function SwipeableTabStrip({
  tabs: tabsProp,
  selectedIndex,
  onSelectIndex,
  backgroundColor,
}: SwipeableTabStripProps) {
  const tabs = normalizeTabs(tabsProp);
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const stripWidth = useRef(0);
  const scrollX = useRef(0);
  const maxScrollX = useRef(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [hovered, setHovered] = useState(false);
  const stripRef = useRef<View>(null);
  const [tabLayouts, setTabLayouts] = useState<(TabLayout | undefined)[]>([]);
  const tabLayoutsRef = useRef<(TabLayout | undefined)[]>([]);
  const leftAnim = useRef(new Animated.Value(0)).current;
  const widthAnim = useRef(new Animated.Value(0)).current;

  tabLayoutsRef.current = tabLayouts;

  const barBg =
    backgroundColor ??
    colors.surfaceElevated ??
    colors.menuBg ??
    colors.bg + "ee";

  const activeLayout = tabLayouts[selectedIndex];

  useEffect(() => {
    if (activeLayout == null) return;
    const left = Math.round(activeLayout.x + PILL_HORIZONTAL_INSET);
    const width = Math.round(
      Math.max(0, activeLayout.width - 2 * PILL_HORIZONTAL_INSET)
    );
    Animated.parallel([
      Animated.timing(leftAnim, {
        toValue: left,
        duration: PILL_ANIM_DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(widthAnim, {
        toValue: width,
        duration: PILL_ANIM_DURATION,
        useNativeDriver: false,
      }),
    ]).start();
  }, [selectedIndex, activeLayout, leftAnim, widthAnim]);

  // Скролл при смене вкладки: первая — в 0, остальные — к центру или без обрезки
  useEffect(() => {
    const layout = tabLayoutsRef.current[selectedIndex];
    if (stripWidth.current <= 0 || layout == null) return;
    const leftEdge = layout.x;
    const tabW = layout.width;
    const stripW = stripWidth.current;
    const targetX =
      selectedIndex === 0
        ? 0
        : (() => {
            const centerX = leftEdge + tabW / 2 - stripW / 2;
            return centerX < 0
              ? leftEdge
              : Math.max(0, Math.min(leftEdge, centerX));
          })();
    scrollRef.current?.scrollTo({
      x: targetX,
      animated: true,
    });
  }, [selectedIndex]);

  const onStripLayout = (e: LayoutChangeEvent) => {
    stripWidth.current = e.nativeEvent.layout.width;
  };

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const x = contentOffset.x;
    const max = Math.max(0, (contentSize?.width ?? 0) - (layoutMeasurement?.width ?? 0));
    scrollX.current = x;
    maxScrollX.current = max;
    setScrollOffset(x);
    setMaxScroll(max);
  }, []);

  const onWheel = useCallback((ev: WheelEvent) => {
    if (!hovered) return;
    const raw = ev.deltaY ?? ev.deltaX ?? 0;
    if (raw === 0) return;
    const delta = raw * 0.45;
    const next = Math.max(0, Math.min(maxScrollX.current, scrollX.current + delta));
    scrollX.current = next;
    scrollRef.current?.scrollTo({ x: next, animated: false });
    ev.preventDefault();
    ev.stopPropagation();
  }, [hovered]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = (stripRef.current as unknown) as HTMLElement | null;
    if (!node) return;
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const pillStyle =
    activeLayout != null
      ? {
          left: leftAnim,
          width: widthAnim,
          top: PILL_VERTICAL_INSET,
          bottom: PILL_VERTICAL_INSET,
          backgroundColor: colors.accent + "28",
        }
      : null;

  const onTabWrapLayout = useCallback((index: number, layout: TabLayout) => {
    setTabLayouts((prev) => {
      const next = [...prev];
      const existing = next[index];
      if (
        existing &&
        existing.x === layout.x &&
        existing.width === layout.width
      )
        return prev;
      next[index] = layout;
      return next;
    });
  }, []);

  return (
    <View
      ref={stripRef}
      style={[styles.stripWrap, { backgroundColor: barBg }]}
      onLayout={onStripLayout}
      onPointerEnter={Platform.OS === "web" ? () => setHovered(true) : undefined}
      onPointerLeave={Platform.OS === "web" ? () => setHovered(false) : undefined}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        <View style={styles.tabRow}>
          {pillStyle ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.pill, pillStyle]}
            />
          ) : null}
          {tabs.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <View
                key={index}
                style={styles.tabWrap}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  onTabWrapLayout(index, { x, width });
                }}
              >
                <TabItem
                  item={item}
                  isSelected={isSelected}
                  colors={colors}
                  onPress={() => onSelectIndex(index)}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
      {/* Левый фейд — активен только после скролла от начала */}
      <View
        pointerEvents="none"
        style={[styles.fadeLeft, { width: FADE_EDGE_WIDTH, opacity: scrollOffset > 2 ? 1 : 0 }]}
      >
        <LinearGradient
          colors={[barBg, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Правый фейд — активен только когда не у конца */}
      <View
        pointerEvents="none"
        style={[styles.fadeRight, { width: FADE_EDGE_WIDTH, opacity: scrollOffset < maxScroll - 2 ? 1 : 0 }]}
      >
        <LinearGradient
          colors={["transparent", barBg]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stripWrap: {
    paddingVertical: STRIP_PADDING_V,
    paddingHorizontal: STRIP_PADDING_H,
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: PILL_RADIUS,
    overflow: "hidden",
    position: "relative",
  },
  fadeLeft: {
    position: "absolute",
    left: STRIP_PADDING_H,
    top: STRIP_PADDING_V,
    bottom: STRIP_PADDING_V,
    zIndex: 1,
  },
  fadeRight: {
    position: "absolute",
    right: STRIP_PADDING_H,
    top: STRIP_PADDING_V,
    bottom: STRIP_PADDING_V,
    zIndex: 1,
  },
  scrollContent: {
    paddingLeft: 0,
    paddingRight: SCROLL_EDGE_PADDING,
    alignItems: "center",
    flexDirection: "row",
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  pill: {
    position: "absolute",
    borderRadius: 9999,
  },
  tabWrap: {
    marginHorizontal: 3,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: TAB_PADDING_H,
    paddingVertical: TAB_PADDING_V,
    minWidth: MIN_TAB_WIDTH,
    justifyContent: "center",
    borderRadius: 9999,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  tabLabel: {
    fontSize: 14,
    lineHeight: 16,
  },
});
