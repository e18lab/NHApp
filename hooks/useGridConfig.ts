import type { GridConfig } from "@/components/BookList";
import {
  getCurrentGridConfigMapSync,
  getGridConfigMap,
  subscribeGridConfig,
} from "@/config/gridConfig";
import { useEffect, useMemo, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";

const _isPC =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  !!(window as any).electron?.isElectron;

const TARGET_CARD_W = 180;
const MIN_CARD_W = 140;
const MAX_CARD_W = 240;

function calcCols(availWidth: number, gap: number): number {
  const ideal = Math.max(2, Math.floor((availWidth + gap) / (TARGET_CARD_W + gap)));
  const cardW = (availWidth - gap * (ideal - 1)) / ideal;
  if (cardW < MIN_CARD_W && ideal > 2) return ideal - 1;
  if (cardW > MAX_CARD_W) return Math.max(2, Math.floor((availWidth + gap) / (MIN_CARD_W + gap)));
  return ideal;
}

export function useGridConfig(): GridConfig {
  const { width, height } = useWindowDimensions();
  const [map, setMap] = useState(getCurrentGridConfigMapSync());
  useEffect(() => {
    const unsub = subscribeGridConfig(setMap);
    getGridConfigMap()
      .then(setMap)
      .catch(() => {});
    return () => unsub();
  }, []);

  const baseConfig = useMemo(() => {
    const isLandscape = width > height;
    const isTablet = Math.min(width, height) >= 600;
    if (isTablet) return isLandscape ? map.tabletLandscape : map.tabletPortrait;
    return isLandscape ? map.phoneLandscape : map.phonePortrait;
  }, [width, height, map]);

  return useMemo(() => {
    if (!_isPC) return baseConfig;
    const pad = Math.min(baseConfig.paddingHorizontal ?? 10, 8);
    const gap = baseConfig.columnGap ?? 5;
    const cols = calcCols(width - pad * 2, gap);
    return { ...baseConfig, paddingHorizontal: pad, numColumns: cols };
  }, [baseConfig, width]);
}
