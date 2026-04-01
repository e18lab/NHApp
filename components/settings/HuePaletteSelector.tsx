import { isElectron } from "@/electron/bridge";
import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useI18n } from "@/lib/i18n/I18nContext";


const hslToHex = (h: number, s: number, l: number): string => {
  h = h % 360;
  s = s / 100;
  l = l / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let [r, g, b] = [0, 0, 0];

  if (0 <= h && h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (60 <= h && h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (120 <= h && h < 180) {
    [r, g, b] = [0, c, x];
  } else if (180 <= h && h < 240) {
    [r, g, b] = [0, x, c];
  } else if (240 <= h && h < 300) {
    [r, g, b] = [x, 0, c];
  } else if (300 <= h && h < 360) {
    [r, g, b] = [c, 0, x];
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
};

interface Props {
  value: number; 
  onValueChange: (hue: number) => void;
  onComplete?: (hue: number) => void;
}

export default function HuePaletteSelector({
  value,
  onValueChange,
  onComplete,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const isDesktop = isElectron() || (Platform.OS === "web" && width >= 768);
  const isTablet = width >= 600 && width < 768;

  const PALETTE_PADDING = isDesktop ? 24 : isTablet ? 20 : 16;
  const PALETTE_GAP = isDesktop ? 10 : isTablet ? 9 : 8;
  const MAX_ITEM_SIZE = isDesktop ? 42 : isTablet ? 38 : 36;
  const MIN_ITEM_SIZE = isDesktop ? 32 : isTablet ? 30 : 28;
  const ITEM_SIZE = Math.max(MIN_ITEM_SIZE, Math.min(MAX_ITEM_SIZE, (width - PALETTE_PADDING * 2 - PALETTE_GAP * 9) / 10));

  const fullPalette = useMemo(() => {
    const palette: number[] = [];
    for (let i = 0; i < 360; i += 10) {
      palette.push(i);
    }
    return palette;
  }, []);

  const getClosestHue = (targetHue: number): number => {
    return Math.round(targetHue / 10) * 10;
  };

  const selectedHue = getClosestHue(value);

  const handlePress = (hue: number) => {
    onValueChange(hue);
    onComplete?.(hue);
  };

  return (
    <View style={[
      styles.container,
      isDesktop && styles.containerDesktop,
      isTablet && styles.containerTablet,
    ]}>
      {}
      <View style={[
        styles.fullPaletteContainer,
        isDesktop && styles.fullPaletteContainerDesktop,
        isTablet && styles.fullPaletteContainerTablet,
      ]}>
        <View style={[styles.paletteGrid, { gap: PALETTE_GAP }]}>
          {fullPalette.map((hue) => {
            const isSelected = selectedHue === hue;
            const hueColor = hslToHex(hue, 78, 50);
            return (
              <Pressable
                key={hue}
                onPress={() => handlePress(hue)}
                style={[
                  styles.paletteItem,
                  isDesktop && styles.paletteItemDesktop,
                  isTablet && styles.paletteItemTablet,
                  {
                    width: ITEM_SIZE,
                    height: ITEM_SIZE,
                    backgroundColor: hueColor,
                    borderColor: isSelected
                      ? colors.bg
                      : "rgba(255, 255, 255, 0.3)",
                    borderWidth: isSelected ? (isDesktop ? 4 : isTablet ? 3.5 : 3) : (isDesktop ? 1.5 : isTablet ? 1.25 : 1),
                    transform: [{ scale: isSelected ? (isDesktop ? 1.2 : isTablet ? 1.17 : 1.15) : 1 }],
                  },
                ]}
                android_ripple={{ color: "#ffffff33", borderless: false }}
              >
                {isSelected && (
                  <View style={[
                    styles.selectedIndicator,
                    isDesktop && styles.selectedIndicatorDesktop,
                    isTablet && styles.selectedIndicatorTablet,
                  ]}>
                    <Feather 
                      name="check" 
                      size={isDesktop ? 12 : isTablet ? 11 : 10} 
                      color={colors.bg} 
                    />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {}
      <View style={[
        styles.currentValueContainer,
        isDesktop && styles.currentValueContainerDesktop,
        isTablet && styles.currentValueContainerTablet,
        { backgroundColor: colors.page }
      ]}>
        <Text style={[
          styles.currentLabel,
          isDesktop && styles.currentLabelDesktop,
          isTablet && styles.currentLabelTablet,
          { color: colors.sub }
        ]}>
          {t("settings.appearance.hue", { deg: Math.round(value) })}
        </Text>
        <View
          style={[
            styles.currentColorPreview,
            isDesktop && styles.currentColorPreviewDesktop,
            isTablet && styles.currentColorPreviewTablet,
            {
              backgroundColor: hslToHex(value, 78, 50),
              borderColor: colors.accent + "40",
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  containerDesktop: {
    gap: 24,
  },
  containerTablet: {
    gap: 22,
  },
  fullPaletteContainer: {
    gap: 12,
  },
  fullPaletteContainerDesktop: {
    gap: 16,
  },
  fullPaletteContainerTablet: {
    gap: 14,
  },
  paletteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  paletteItem: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  paletteItemDesktop: {
    borderRadius: 10,
  },
  paletteItemTablet: {
    borderRadius: 9,
  },
  selectedIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffffcc",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedIndicatorDesktop: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  selectedIndicatorTablet: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  currentValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  currentValueContainerDesktop: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 16,
  },
  currentValueContainerTablet: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 13,
    gap: 14,
  },
  currentLabel: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  currentLabelDesktop: {
    fontSize: 16,
    letterSpacing: 0.3,
  },
  currentLabelTablet: {
    fontSize: 15,
    letterSpacing: 0.25,
  },
  currentColorPreview: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  currentColorPreviewDesktop: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
  },
  currentColorPreviewTablet: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.25,
  },
});
