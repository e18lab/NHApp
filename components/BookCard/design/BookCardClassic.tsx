import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Pressable, Text, View } from "react-native";

import { Book } from "@/api/nhentai";
import SmartImage from "@/components/SmartImage";
import { buildImageFallbacks } from "@/components/buildImageFallbacks";
import { useTheme } from "@/lib/ThemeContext";
import { makeCardStyles } from "../BookCard.styles";

const CN_FLAG = require("@/assets/images/flags/CN.png");
const GB_FLAG = require("@/assets/images/flags/GB.png");
const JP_FLAG = require("@/assets/images/flags/JP.png");
const FLAG_MAP: Record<string, any> = {
  chinese: CN_FLAG,
  english: GB_FLAG,
  japanese: JP_FLAG,
};

export interface BookCardClassicProps {
  book: Book;
  cardWidth?: number;
  contentScale?: number;
  isFavorite?: boolean;
  onPress?: (id: number) => void;
  background?: string;
}

export default function BookCardClassic({
  book,
  cardWidth = 160,
  contentScale = 1,
  onPress,
  background,
}: BookCardClassicProps) {
  const { colors } = useTheme();
  const styles = useMemo(
    () => makeCardStyles(colors, cardWidth, contentScale),
    [colors, cardWidth, contentScale]
  );

  const S = contentScale;
  const pillPadX = Math.max(10, Math.round(cardWidth * 0.06 * S));
  const pillPadY = Math.max(5, Math.round(cardWidth * 0.035 * S));
  const padX = pillPadX;
  const padY = Math.max(8, Math.round(pillPadY * 0.9));

  const titleFontSize = Math.max(12, Math.round(cardWidth * 0.08 * S));
  const lineH = Math.max(14, Math.round(cardWidth * 0.09 * S));
  const textWidth = Math.max(0, cardWidth - padX * 2);

  const [measured, setMeasured] = useState(false);
  const [lines, setLines] = useState<number>(1);
  const [canExpand, setCanExpand] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const oneLinePad = Math.round(padY * 0.6);

  const collapsedH0 = oneLinePad * 2 + lineH;
  const [collapsedH, setCollapsedH] = useState(collapsedH0);
  const [expandedH, setExpandedH] = useState(collapsedH0);

  const hAnim = useRef(new Animated.Value(collapsedH0)).current;
  const measuredOnce = useRef(false);

  const fullTitle = book.title?.pretty ?? "";

  useEffect(() => {
    measuredOnce.current = false;
    setMeasured(false);
    setLines(1);
    setCanExpand(false);
    setExpanded(false);
    setExpandedH(collapsedH0);
    setCollapsedH(collapsedH0);
    hAnim.setValue(collapsedH0);
  }, [book.id, cardWidth, contentScale, lineH, padY, titleFontSize, textWidth]);

  const langName = (() => {
    const arr = book.languages || [];
    if (!arr?.length) return undefined;
    const p = arr[0]?.name?.toLowerCase();
    const s = arr[1]?.name?.toLowerCase();
    return p === "translated" && s ? s : p;
  })();
  const flagSrc = langName ? FLAG_MAP[langName] : undefined;

  const sources = buildImageFallbacks(book.thumbnail);

  const handlePressCard = () => onPress?.(book.id);

  const animateTo = (to: number) => {
    Animated.timing(hAnim, {
      toValue: to,
      duration: 180,
      useNativeDriver: false, // height
    }).start();
  };

  const toggleExpand = () => {
    if (!canExpand) return;
    const to = expanded ? collapsedH : expandedH;
    setExpanded(!expanded);
    animateTo(to);
  };

  const applyMeasurement = (ln: number) => {
    const L = Math.max(1, ln);
    const cH = collapsedH0;
    const eH = padY * 2 + L * lineH;
    setLines(L);
    setCanExpand(L > 1);
    setCollapsedH(cH);
    setExpandedH(eH);
    setMeasured(true);
    hAnim.setValue(cH);
  };

  return (
    <Pressable
      style={[styles.card, background ? { backgroundColor: background } : undefined]}
      onPress={handlePressCard}
    >
      {/* Обложка */}
      <View style={styles.imageWrap}>
        <SmartImage sources={sources} style={styles.cover} />

        {flagSrc && (
          <View style={[styles.langBadge]} pointerEvents="none">
            <Image source={flagSrc} style={styles.langImg} resizeMode="cover" />
          </View>
        )}

        <Animated.View style={[styles.classicBarBase, styles.classicBarAbs, { height: hAnim }]}>
          <Pressable
            onPress={(e: any) => {
              e?.stopPropagation?.();
              toggleExpand();
            }}
            style={[
              styles.classicInner,
              { paddingHorizontal: padX, paddingVertical: expanded ? padY : oneLinePad },
            ]}
          >
            <Text
              style={[styles.classicTitle, { fontSize: titleFontSize, lineHeight: lineH }]}
              numberOfLines={expanded ? undefined : 1}
              ellipsizeMode="tail"
            >
              {fullTitle}
            </Text>
          </Pressable>

          <View style={styles.classicSeamFix} pointerEvents="none" />
        </Animated.View>
      </View>

      {!measured && textWidth > 0 && (
        <Text
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: textWidth,
            opacity: 0,
            fontSize: titleFontSize,
            lineHeight: lineH,
            fontWeight: "700",
          }}
          pointerEvents="none"
          onTextLayout={(e) => {
            if (measuredOnce.current) return;
            measuredOnce.current = true;
            const ln = e?.nativeEvent?.lines?.length ?? 1;
            applyMeasurement(ln);
          }}
        >
          {fullTitle}
        </Text>
      )}
    </Pressable>
  );
}
