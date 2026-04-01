import ExpoImage from "@/components/ExpoImageCompat";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";

export function ThumbRail({
  visible,
  colors,
  urls,
  firstAbsPage,
  totalPages,
  frames,
  frameIdx,
  useDualNow,
  goToAbs,
  railH,
  setRailH,
  padCenter,
  scrollRef,
  isHorizontal = false,
}: {
  visible: boolean;
  colors: any;
  urls: string[];
  firstAbsPage: number;
  totalPages: number;
  frames: number[][];
  frameIdx: number;
  useDualNow: boolean;
  goToAbs: (abs: number) => void;
  railH: number;
  setRailH: (h: number) => void;
  padCenter: number;
  scrollRef:
    | React.RefObject<FlatList<string>>
    | React.MutableRefObject<FlatList<string> | null>;
  isHorizontal?: boolean;
}) {
  const THUMB_H = 64;
  const THUMB_W = isHorizontal ? 52 : 52;
  const THUMB_GAP = 5;

  useEffect(() => {
    if (!visible) return;
    if (scrollRef.current) {
      if (isHorizontal) {
        const xOffset =
          firstAbsPage * (THUMB_W + THUMB_GAP) - (railH || 200) / 2 + THUMB_W / 2;
        scrollRef.current.scrollToOffset({ offset: xOffset, animated: true });
      } else {
        const yOffset =
          firstAbsPage * (THUMB_H + THUMB_GAP) - railH / 1.7 + THUMB_H / 2;
        scrollRef.current.scrollToOffset({ offset: yOffset, animated: true });
      }
    }
  }, [visible, firstAbsPage, railH, scrollRef, isHorizontal, THUMB_W, THUMB_H]);

  if (!visible) return null;

  return (
    <View
      style={[
        isHorizontal ? styles.thumbRailWrapHorizontal : styles.thumbRailWrap,
        { backgroundColor: colors.searchBg, borderColor: colors.page },
      ]}
      onLayout={(e) => {
        if (isHorizontal) {
          setRailH(e.nativeEvent.layout.width);
        } else {
          setRailH(e.nativeEvent.layout.height);
        }
      }}
    >
      <FlatList
        ref={scrollRef as React.Ref<FlatList<string>>}
        data={urls}
        keyExtractor={(_, i) => String(i)}
        horizontal={isHorizontal}
        showsVerticalScrollIndicator={!isHorizontal}
        showsHorizontalScrollIndicator={isHorizontal}
        snapToInterval={isHorizontal ? THUMB_W + THUMB_GAP : THUMB_H + THUMB_GAP}
        decelerationRate="fast"
        removeClippedSubviews={Platform.OS === 'android'}
        windowSize={Platform.OS === 'android' ? 5 : 7}
        maxToRenderPerBatch={Platform.OS === 'android' ? 10 : 15}
        initialNumToRender={Platform.OS === 'android' ? 8 : 12}
        updateCellsBatchingPeriod={Platform.OS === 'android' ? 50 : 40}
        contentContainerStyle={{
          padding: 6,
        }}
        renderItem={({ item, index }) => {
          const selected = useDualNow
            ? frames[frameIdx]?.includes(index)
            : index === firstAbsPage;
          const isLeftDual = useDualNow && frames[frameIdx]?.[0] === index;
          const isRightDual = useDualNow && frames[frameIdx]?.[1] === index;

          return (
            <View
              style={isHorizontal ? {
                width: THUMB_W,
                marginRight: THUMB_GAP,
                alignItems: "center",
                justifyContent: "center",
              } : {
                height: THUMB_H,
                marginBottom: THUMB_GAP,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Pressable
                onPress={() => goToAbs(index)}
                android_ripple={{ color: colors.accent + "22" }}
              >
                <ExpoImage
                  source={{ uri: item }}
                  style={{
                    width: THUMB_W,
                    height: THUMB_H,
                    borderRadius: 12,
                    opacity: selected ? 1 : 0.35,
                  }}
                  contentFit="cover"
                  cachePolicy="disk"
                />
                {selected && useDualNow && (isLeftDual || isRightDual) && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderWidth: 2,
                      borderColor: isRightDual
                        ? colors.accent
                        : colors.secondary,
                      borderRadius: 12,
                    }}
                  />
                )}
                {selected && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderWidth: 2,
                      borderColor: colors.accent,
                      borderRadius: 12,
                    }}
                  />
                )}
              </Pressable>
            </View>
          );
        }}
        getItemLayout={(_, index) => ({
          length: isHorizontal ? THUMB_W + THUMB_GAP : THUMB_H + THUMB_GAP,
          offset: (isHorizontal ? THUMB_W + THUMB_GAP : THUMB_H + THUMB_GAP) * index,
          index,
        })}
      />
      {isHorizontal ? (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[colors.searchBg, "transparent"]}
            style={styles.fadeLeft}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", colors.searchBg]}
            style={styles.fadeRight}
          />
        </>
      ) : (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[colors.searchBg, "transparent"]}
            style={styles.fadeTop}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", colors.searchBg]}
            style={styles.fadeBottom}
          />
        </>
      )}
      {!isHorizontal && (
        <Text style={[styles.railCounter, { color: colors.searchTxt }]}>
          {Math.min(firstAbsPage + 1, totalPages)} / {totalPages}
        </Text>
      )}
    </View>
  );
}

export function BottomScrubber({
  visible,
  colors,
  progressRatio,
  setWidth,
  onScrub,
  trackWidthPx,
}: {
  visible: boolean;
  colors: any;
  progressRatio: number;
  setWidth: (w: number) => void;
  onScrub: (x: number) => void;
  trackWidthPx?: number;
}) {
  if (!visible) return null;

  const clamped = Math.max(0, Math.min(1, progressRatio));
  const fillW = trackWidthPx != null ? clamped * trackWidthPx : undefined;

  return (
    <View
      style={[
        styles.bottomScrubber,
        { backgroundColor: colors.searchBg, borderColor: colors.page },
      ]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(e) => onScrub(e.nativeEvent.locationX)}
      onResponderMove={(e) => onScrub(e.nativeEvent.locationX)}
    >
      <View style={[styles.scrubTrack, { backgroundColor: colors.page }]} />
      <View
        style={[
          styles.scrubFill,
          trackWidthPx != null
            ? { width: fillW }
            : { width: `${clamped * 100}%` },
          { backgroundColor: colors.accent },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumbRailWrap: {
    position: "absolute",
    right: 8,
    top: "5%",
    height: "90%",
    width: 56 + 12 + 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 0,
    overflow: "hidden",
    zIndex: 15,
  },
  thumbRailWrapHorizontal: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 4,
    height: 76,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 0,
    overflow: "hidden",
    zIndex: 15,
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 36,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
  },
  fadeLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 48,
    zIndex: 1,
  },
  fadeRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 48,
    zIndex: 1,
  },
  railCounter: {
    position: "absolute",
    bottom: 6,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
  },
  bottomScrubber: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 18,
    overflow: "hidden",
  },
  scrubTrack: {
    position: "absolute",
    left: 10,
    right: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ccc",
  },
  scrubFill: {
    position: "absolute",
    left: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#007AFF",
  },
});
