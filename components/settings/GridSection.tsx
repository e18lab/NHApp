import { searchBooks, type Book } from "@/api/nhentai";
import BookList from "@/components/BookList";
import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";

import {
    GridProfile,
    defaultGridConfigMap,
    getGridConfigMap,
    resetGridConfigMap,
    setGridConfigMap,
    subscribeGridConfig,
} from "@/config/gridConfig";
import { useI18n } from "@/lib/i18n/I18nContext";

const PROFILES: GridProfile[] = ["phonePortrait", "phoneLandscape", "tabletPortrait", "tabletLandscape"];

function CardDesignSegment({
  value,
  onChange,
}: {
  value: "classic" | "stable" | "image";
  onChange: (d: "classic" | "stable" | "image") => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const options: Array<"classic" | "stable" | "image"> = ["classic", "stable", "image"];

  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 12,
        overflow: "hidden",
        alignSelf: "flex-start",
      }}
    >
      {options.map((d, i) => {
        const active = value === d;
        return (
          <Pressable
            key={d}
            onPress={() => onChange(d)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: active ? colors.incBg : colors.tagBg,
              borderTopLeftRadius: i === 0 ? 12 : 0,
              borderBottomLeftRadius: i === 0 ? 12 : 0,
              borderTopRightRadius: i === options.length - 1 ? 12 : 0,
              borderBottomRightRadius: i === options.length - 1 ? 12 : 0,
              borderWidth: 1,
              borderColor: active ? colors.incTxt : colors.page,
            }}
            android_ripple={{ color: colors.accent + "22", borderless: false }}
          >
            <Text
              style={{
                fontWeight: "800",
                color: active ? colors.incTxt : colors.tagText,
              }}
            >
              {d === "classic" && t("settings.grid.cardDesign.classic")}
              {d === "stable" && t("settings.grid.cardDesign.stable")}
              {d === "image" && t("settings.grid.cardDesign.image")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function GridSection({
  activeProfile,
  setActiveProfile,
}: {
  activeProfile: GridProfile;
  setActiveProfile: (p: GridProfile) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [gridMap, setGridMapState] = useState(defaultGridConfigMap);
  const profCfg = gridMap[activeProfile] as any;
  const [previewBooks, setPreviewBooks] = useState<Book[]>([]);
  const [colsMaxByWidth, setColsMaxByWidth] = useState<number>(12);
  const cardDesign: "classic" | "stable" | "image" = profCfg.cardDesign ?? "classic";

  useEffect(() => {
    (async () => setGridMapState(await getGridConfigMap()))();
    const unsub = subscribeGridConfig(setGridMapState);
    return () => unsub();
  }, []);

  useEffect(() => {
    let mounted = true;
    const perPage = Math.min(120, Math.max(12, colsMaxByWidth));
    (async () => {
      try {
        const res = await searchBooks({ sort: "popular", page: 1, perPage });
        if (mounted) setPreviewBooks(res.books);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [cardDesign, colsMaxByWidth]);

  const onPreviewLayout = useCallback(
    (w: number) => {
      const pad = profCfg.paddingHorizontal ?? 0;
      const gap = profCfg.columnGap ?? 0;
      const minW = (profCfg.minColumnWidth ?? (cardDesign === "image" ? 40 : 80)) as number;
      const inner = Math.max(0, w - pad * 2);
      const maxByWidth = Math.max(1, Math.floor((inner + gap) / (minW + gap)));
      setColsMaxByWidth(Math.min(12, maxByWidth));

      const cols = Math.max(1, Math.min(profCfg.numColumns ?? 1, maxByWidth));
      const cardW = (inner - gap * (cols - 1)) / cols;
      if (cardDesign !== "image" && cardW < 78) {
        setGridConfigMap({ [activeProfile]: { ...profCfg, cardDesign: "image" } } as any);
      }
    },
    [
      profCfg.paddingHorizontal,
      profCfg.columnGap,
      profCfg.minColumnWidth,
      profCfg.numColumns,
      cardDesign,
      activeProfile,
    ]
  );

  const setNum = async (v: number) => {
    const next = Math.max(1, Math.min(colsMaxByWidth, Math.round(v)));
    await setGridConfigMap({ [activeProfile]: { ...profCfg, numColumns: next } } as any);
  };
  const setPad = async (v: number) => {
    const next = Math.max(0, Math.min(32, Math.round(v)));
    await setGridConfigMap({ [activeProfile]: { ...profCfg, paddingHorizontal: next } } as any);
  };
  const setGap = async (v: number) => {
    const next = Math.max(0, Math.min(24, Math.round(v)));
    await setGridConfigMap({ [activeProfile]: { ...profCfg, columnGap: next } } as any);
  };
  const setMinW = async (v: number) => {
    const floor = cardDesign === "image" ? 40 : 80;
    const next = Math.max(floor, Math.min(200, Math.round(v)));
    await setGridConfigMap({ [activeProfile]: { ...profCfg, minColumnWidth: next } } as any);
  };
  const setDesign = async (d: "classic" | "stable" | "image") => {
    await setGridConfigMap({ [activeProfile]: { ...profCfg, cardDesign: d } } as any);
  };
  const resetProfile = async () => {
    const def = defaultGridConfigMap[activeProfile];
    await setGridConfigMap({ [activeProfile]: def } as any);
  };
  const resetAll = async () => {
    await resetGridConfigMap();
  };


  const chipBg = (k: GridProfile) => (activeProfile === k ? colors.incBg : colors.tagBg);
  const chipFg = (k: GridProfile) => (activeProfile === k ? colors.incTxt : colors.tagText);
  const chipBr = (k: GridProfile) => (activeProfile === k ? colors.incTxt : "transparent");

  const [previewW, setPreviewW] = useState(0);
  const onLayoutPreview = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setPreviewW(w);
    onPreviewLayout(w);
  };

  const profileLabel = (p: GridProfile) => {
    switch (p) {
      case "phonePortrait":
        return t("settings.grid.phonePortrait");
      case "phoneLandscape":
        return t("settings.grid.phoneLandscape");
      case "tabletPortrait":
        return t("settings.grid.tabletPortrait");
      case "tabletLandscape":
        return t("settings.grid.tabletLandscape");
      default:
        return p;
    }
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        {PROFILES.map((p) => (
          <Pressable
            key={p}
            onPress={() => setActiveProfile(p)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 14,
              borderWidth: activeProfile === p ? 2 : 1.5,
              backgroundColor: chipBg(p),
              borderColor: chipBr(p),
            }}
            android_ripple={{ color: colors.accent + "25", borderless: false }}
          >
            <Text
              style={{
                color: chipFg(p),
                fontWeight: activeProfile === p ? "800" : "700",
                fontSize: 13,
                letterSpacing: 0.2,
              }}
            >
              {profileLabel(p)}
            </Text>
          </Pressable>
        ))}
      </View>

      <CardDesignSegment value={cardDesign} onChange={setDesign} />

      <View
        onLayout={onLayoutPreview}
        style={{ marginTop: 10, borderRadius: 12, overflow: "hidden" }}
      >
        <BookList
          data={previewBooks}
          loading={false}
          refreshing={false}
          onRefresh={async () => {}}
          ListEmptyComponent={null}
          ListFooterComponent={null}
          ListHeaderComponent={null}
          background={colors.bg}
          onPress={undefined}
          onToggleFavorite={undefined}
          getScore={() => undefined}
          horizontal
          gridConfig={{
            default: {
              numColumns: profCfg.numColumns,
              minColumnWidth:
                profCfg.minColumnWidth ?? (cardDesign === "image" ? 40 : 80),
              paddingHorizontal: profCfg.paddingHorizontal,
              columnGap: profCfg.columnGap,
              cardDesign,
            },
          }}
          cardDesign={cardDesign}
        />
      </View>

      <View style={{ marginTop: 16, gap: 20 }}>
        {/* Колонки */}
        <View>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <Text style={{
              fontSize: 15,
              fontWeight: "700",
              letterSpacing: 0.2,
              color: colors.txt,
            }}>
              {t("settings.grid.columns")}
            </Text>
            <View style={{
              backgroundColor: colors.accent + "20",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: "800",
                letterSpacing: 0.2,
                color: colors.accent,
              }}>
                {Math.min(profCfg.numColumns, colsMaxByWidth)}
              </Text>
            </View>
          </View>
          <View style={{
            backgroundColor: colors.page + "50",
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 4,
          }}>
            <Slider
              style={{ height: 40 }}
              minimumValue={1}
              maximumValue={colsMaxByWidth}
              step={1}
              value={Math.min(profCfg.numColumns, colsMaxByWidth)}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.page + "30"}
              thumbTintColor={colors.accent}
              onSlidingComplete={setNum}
            />
          </View>
        </View>

        {/* Минимальная ширина */}
        <View>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <Text style={{
              fontSize: 15,
              fontWeight: "700",
              letterSpacing: 0.2,
              color: colors.txt,
            }}>
              {t("settings.grid.minWidth")}
            </Text>
            <View style={{
              backgroundColor: colors.accent + "20",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: "800",
                letterSpacing: 0.2,
                color: colors.accent,
              }}>
                {profCfg.minColumnWidth ?? (cardDesign === "image" ? 40 : 80)}px
              </Text>
            </View>
          </View>
          <View style={{
            backgroundColor: colors.page + "50",
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 4,
          }}>
            <Slider
              style={{ height: 40 }}
              minimumValue={cardDesign === "image" ? 40 : 80}
              maximumValue={200}
              step={1}
              value={
                profCfg.minColumnWidth ?? (cardDesign === "image" ? 40 : 80)
              }
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.page + "30"}
              thumbTintColor={colors.accent}
              onSlidingComplete={setMinW}
            />
          </View>
        </View>

        {/* Отступы по бокам */}
        <View>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <Text style={{
              fontSize: 15,
              fontWeight: "700",
              letterSpacing: 0.2,
              color: colors.txt,
            }}>
              {t("settings.grid.sidePadding")}
            </Text>
            <View style={{
              backgroundColor: colors.accent + "20",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: "800",
                letterSpacing: 0.2,
                color: colors.accent,
              }}>
                {profCfg.paddingHorizontal}
              </Text>
            </View>
          </View>
          <View style={{
            backgroundColor: colors.page + "50",
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 4,
          }}>
            <Slider
              style={{ height: 40 }}
              minimumValue={0}
              maximumValue={32}
              step={1}
              value={profCfg.paddingHorizontal}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.page + "30"}
              thumbTintColor={colors.accent}
              onSlidingComplete={setPad}
            />
          </View>
        </View>

        {/* Расстояние между колонками */}
        <View>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <Text style={{
              fontSize: 15,
              fontWeight: "700",
              letterSpacing: 0.2,
              color: colors.txt,
            }}>
              {t("settings.grid.columnGap")}
            </Text>
            <View style={{
              backgroundColor: colors.accent + "20",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: "800",
                letterSpacing: 0.2,
                color: colors.accent,
              }}>
                {profCfg.columnGap}
              </Text>
            </View>
          </View>
          <View style={{
            backgroundColor: colors.page + "50",
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 4,
          }}>
            <Slider
              style={{ height: 40 }}
              minimumValue={0}
              maximumValue={24}
              step={1}
              value={profCfg.columnGap}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.page + "30"}
              thumbTintColor={colors.accent}
              onSlidingComplete={setGap}
            />
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 12,
        }}
      >
        <Pressable
          onPress={resetProfile}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            flex: 1,
            backgroundColor: colors.page,
            borderWidth: 1.5,
            borderColor: colors.page + "80",
          }}
          android_ripple={{ color: colors.accent + "22", borderless: false }}
        >
          <Feather name="rotate-ccw" size={16} color={colors.txt} />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              letterSpacing: 0.2,
              color: colors.txt,
            }}
          >
            {t("settings.grid.resetProfile")}
          </Text>
        </Pressable>

        <Pressable
          onPress={resetAll}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            flex: 1,
            backgroundColor: colors.accent,
            borderWidth: 1.5,
            borderColor: colors.accent + "80",
          }}
          android_ripple={{ color: "#ffffff22", borderless: false }}
        >
          <Feather name="trash-2" size={16} color={colors.bg} />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              letterSpacing: 0.2,
              color: colors.bg,
            }}
          >
            {t("settings.grid.resetAll")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

