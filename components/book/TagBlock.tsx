import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image as ExpoImage } from "expo-image";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type CardRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TagLite = {
  type: string;
  name: string;
  count?: number;

  hasCard?: boolean;
  cardImageUrl?: string;
  cardParodyName?: string | null;
  cardRect?: CardRect;
};

const keyOf = (t: TagLite, group: string) => `${group}:${t.type}:${t.name}`;
const EMPTY_TAGS: TagLite[] = [];

function normalizeNhentaiImageUrl(url: string): string {
  return url.replace(/\/(\d+)w\.(jpg|jpeg|png|gif)$/i, "/$1.$2");
}

function CharacterCardTagItem({
  tag,
  mode,
  iconName,
  incColor,
  excColor,
  colors,
  onPressTag,
  onLongPressTag,
  onCycle,
}: {
  tag: TagLite & { cardImageUrl: string; cardRect: CardRect };
  mode: "include" | "exclude" | undefined;
  iconName: "check-circle" | "minus-circle" | "plus-circle";
  incColor: string;
  excColor: string;
  colors: any;
  onPressTag: () => void;
  onLongPressTag: () => void;
  onCycle: () => void;
}) {
  const [thumbSize, setThumbSize] = useState({ width: 5000, height: 5000 });

  const handleThumbLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== thumbSize.width || height !== thumbSize.height) {
      setThumbSize({ width, height });
    }
  };

  let imageStyle: any = {
    width: "100%",
    height: "100%",
  };

  if (
    thumbSize.width > 0 &&
    thumbSize.height > 0 &&
    tag.cardRect &&
    tag.cardRect.width > 0 &&
    tag.cardRect.height > 0
  ) {
    const r = tag.cardRect;

    const displayWidth = thumbSize.width / r.width;
    const displayHeight = thumbSize.height / r.height;
    const offsetX = -r.x * displayWidth;
    const offsetY = -r.y * displayHeight;

    imageStyle = {
      width: displayWidth,
      height: displayHeight,
      position: "absolute",
      left: offsetX,
      top: offsetY,
    };
  }

  const imageUri = normalizeNhentaiImageUrl(tag.cardImageUrl);

  return (
    <View style={styles.cardWrap}>
      <Pressable
        onPress={onPressTag}
        onLongPress={onLongPressTag}
        android_ripple={{
          color: colors.accent + "1A",
          borderless: false,
        }}
        style={({ pressed }) => [
          styles.cardBox,
          {
            backgroundColor: colors.tagBg,
            borderColor:
              mode === "include"
                ? incColor
                : mode === "exclude"
                ? excColor
                : "transparent",
          },
          pressed &&
            Platform.select({
              ios: { opacity: 0.92, transform: [{ scale: 0.997 }] },
              android: { opacity: 0.97 },
            }),
        ]}
      >
        <View style={styles.cardThumb} onLayout={handleThumbLayout}>
          <ExpoImage
            source={{ uri: imageUri }}
            style={imageStyle}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
          />
        </View>

        <View style={styles.cardTextBlock}>
          <Text
            style={[styles.cardName, { color: colors.tagText }]}
            numberOfLines={1}
          >
            {tag.name}
          </Text>
          {tag.cardParodyName ? (
            <Text
              style={[styles.cardParody, { color: colors.metaText }]}
              numberOfLines={1}
            >
              {tag.cardParodyName}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardBottomRow}>
          {!!tag.count && (
            <View style={[styles.badge, { backgroundColor: colors.page }]}>
              <Text style={[styles.badgeTxt, { color: colors.metaText }]}>
                {tag.count}
              </Text>
            </View>
          )}

          <View style={styles.iconWrap}>
            <Pressable
              hitSlop={10}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                onCycle();
              }}
              android_ripple={{
                color: (mode === "exclude" ? excColor : incColor) + "22",
                borderless: false,
                radius: 999,
              }}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed &&
                  Platform.select({
                    ios: { opacity: 0.85 },
                    android: { opacity: 0.92 },
                  }),
              ]}
              accessibilityRole="button"
            >
              <Feather
                name={iconName}
                size={16}
                color={mode === "exclude" ? excColor : incColor}
              />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export const TagBlock = memo(function TagBlock({
  label,
  tags,
  modeOf,
  cycle,
  onTagPress,
  renderLabelExtra,
}: {
  label: string;
  tags?: TagLite[];
  modeOf: (t: TagLite) => "include" | "exclude" | undefined;
  cycle: (t: TagLite) => void;
  onTagPress: (name: string) => void;
  renderLabelExtra?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const safeTags = tags ?? EMPTY_TAGS;

  const { cardTags, simpleTags } = useMemo(() => {
    const withCard: TagLite[] = [];
    const withoutCard: TagLite[] = [];

    safeTags.forEach((t) => {
      if (t.cardImageUrl && t.cardRect) {
        withCard.push(t);
      } else {
        withoutCard.push(t);
      }
    });

    return { cardTags: withCard, simpleTags: withoutCard };
  }, [safeTags]);

  const incColor = (colors as any).incTxt ?? colors.accent;
  const excColor = (colors as any).excTxt ?? "#FF5A5F";

  const optimistic = useRef(
    new Map<string, "include" | "exclude" | undefined>()
  );
  const timers = useRef(new Map<string, any>());
  const [, setRev] = useState(0);

  const getNext = (cur: "include" | "exclude" | undefined) =>
    cur === "include" ? "exclude" : cur === "exclude" ? undefined : "include";

  const setOptimistic = (
    k: string,
    next: "include" | "exclude" | undefined
  ) => {
    optimistic.current.set(k, next);
    setRev((x) => x + 1);
    const prev = timers.current.get(k);
    if (prev) clearTimeout(prev);
    const tid = setTimeout(() => {
      optimistic.current.delete(k);
      timers.current.delete(k);
      setRev((x) => x + 1);
    }, 600);
    timers.current.set(k, tid);
  };

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
      optimistic.current.clear();
    };
  }, []);

  if (safeTags.length === 0) return null;

  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.headerRow}>
        <Text
          style={{
            color: colors.title,
            fontSize: 13,
            fontWeight: "700",
            letterSpacing: 0.2,
          }}
        >
          {label}:
        </Text>
        {renderLabelExtra}
      </View>

      {cardTags.length > 0 && (
        <View style={styles.cardsWrap}>
          {cardTags.map((t) => {
            const k = keyOf(t, label);
            const real = modeOf(t);
            const optimisticMode = optimistic.current.get(k);
            const mode = optimisticMode !== undefined ? optimisticMode : real;

            const iconName: "check-circle" | "minus-circle" | "plus-circle" =
              mode === "include"
                ? "check-circle"
                : mode === "exclude"
                ? "minus-circle"
                : "plus-circle";

            const handleCycle = () => {
              const next = getNext(mode);
              setOptimistic(k, next);
              cycle(t);
            };

            return (
              <CharacterCardTagItem
                key={k}
                tag={
                  t as TagLite & {
                    cardImageUrl: string;
                    cardRect: CardRect;
                  }
                }
                mode={mode}
                iconName={iconName}
                incColor={incColor}
                excColor={excColor}
                colors={colors}
                onPressTag={() => onTagPress(t.name)}
                onLongPressTag={() => Clipboard.setStringAsync(t.name)}
                onCycle={handleCycle}
              />
            );
          })}
        </View>
      )}

      {simpleTags.length > 0 && (
        <View
          style={[styles.wrap, cardTags.length > 0 ? { marginTop: 8 } : null]}
        >
          {simpleTags.map((t) => {
            const k = keyOf(t, label);
            const real = modeOf(t);
            const optimisticMode = optimistic.current.get(k);
            const mode = optimisticMode !== undefined ? optimisticMode : real;

            const iconName: "check-circle" | "minus-circle" | "plus-circle" =
              mode === "include"
                ? "check-circle"
                : mode === "exclude"
                ? "minus-circle"
                : "plus-circle";

            const borderColor =
              mode === "include"
                ? incColor
                : mode === "exclude"
                ? excColor
                : "transparent";

            const handleCycle = () => {
              const next = getNext(mode);
              setOptimistic(k, next);
              cycle(t);
            };

            return (
              <View key={k} style={styles.roundWrap}>
                <Pressable
                  onPress={() => onTagPress(t.name)}
                  onLongPress={() => Clipboard.setStringAsync(t.name)}
                  android_ripple={{
                    color: colors.accent + "1A",
                    borderless: false,
                    radius: 999,
                  }}
                  style={({ pressed }) => [
                    styles.tagBox,
                    { backgroundColor: colors.tagBg, borderColor },
                    pressed &&
                      Platform.select({
                        ios: { opacity: 0.88, transform: [{ scale: 0.995 }] },
                        android: { opacity: 0.97 },
                      }),
                  ]}
                >
                  <Text
                    style={[styles.tagTxt, { color: colors.tagText }]}
                    numberOfLines={1}
                  >
                    {t.name}
                  </Text>

                  {t.hasCard && (
                    <Feather
                      name="image"
                      size={14}
                      color={incColor}
                      style={{ marginLeft: 4 }}
                    />
                  )}

                  {!!t.count && (
                    <View
                      style={[styles.badge, { backgroundColor: colors.page }]}
                    >
                      <Text
                        style={[styles.badgeTxt, { color: colors.metaText }]}
                      >
                        {t.count}
                      </Text>
                    </View>
                  )}

                  <View style={styles.iconWrap}>
                    <Pressable
                      hitSlop={10}
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        handleCycle();
                      }}
                      android_ripple={{
                        color:
                          (mode === "exclude" ? excColor : incColor) + "22",
                        borderless: false,
                        radius: 999,
                      }}
                      style={({ pressed }) => [
                        styles.iconBtn,
                        pressed &&
                          Platform.select({
                            ios: { opacity: 0.85 },
                            android: { opacity: 0.92 },
                          }),
                      ]}
                      accessibilityRole="button"
                    >
                      <Feather
                        name={iconName}
                        size={16}
                        color={mode === "exclude" ? excColor : incColor}
                      />
                    </Pressable>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roundWrap: {
    borderRadius: 999,
    overflow: "hidden",
  },
  tagBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 2,
    paddingLeft: 12,
    paddingRight: 2,
    borderWidth: 1,
  },
  tagTxt: {
    fontSize: 12.5,
    fontWeight: "500",
    maxWidth: 220,
  },
  badge: {
    marginLeft: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { fontSize: 10, fontWeight: "600" },
  iconWrap: {
    marginLeft: 6,
    borderRadius: 12,
    overflow: "hidden",
  },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  cardsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardWrap: {
    borderRadius: 12,
    overflow: "hidden",
  },
  cardBox: {
    width: 90,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
  cardThumb: {
    width: "100%",
    aspectRatio: 1.4 / 2,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 4,
    position: "relative",
  },
  cardTextBlock: {
    marginBottom: 4,
  },
  cardName: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardParody: {
    fontSize: 11,
    marginTop: 1,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

export default TagBlock;
