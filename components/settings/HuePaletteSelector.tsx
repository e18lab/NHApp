import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useI18n } from "@/lib/i18n/I18nContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PALETTE_PADDING = 16;
const PALETTE_GAP = 8;
// Вычисляем размер элемента палитры для 10 элементов в ряду
const ITEM_SIZE = Math.max(28, Math.min(36, (SCREEN_WIDTH - PALETTE_PADDING * 2 - PALETTE_GAP * 9) / 10));

// Функция для преобразования HSL в HEX
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
  value: number; // текущий оттенок (0-360)
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

  // Генерируем полную палитру (все оттенки через каждые 10 градусов)
  const fullPalette = useMemo(() => {
    const palette: number[] = [];
    for (let i = 0; i < 360; i += 10) {
      palette.push(i);
    }
    return palette;
  }, []);

  // Находим ближайший оттенок из палитры
  const getClosestHue = (targetHue: number): number => {
    return Math.round(targetHue / 10) * 10;
  };

  const selectedHue = getClosestHue(value);

  const handlePress = (hue: number) => {
    onValueChange(hue);
    onComplete?.(hue);
  };

  return (
    <View style={styles.container}>
      {/* Полная палитра */}
      <View style={styles.fullPaletteContainer}>
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
                  {
                    width: ITEM_SIZE,
                    height: ITEM_SIZE,
                    backgroundColor: hueColor,
                    borderColor: isSelected
                      ? colors.bg
                      : "rgba(255, 255, 255, 0.3)",
                    borderWidth: isSelected ? 3 : 1,
                    transform: [{ scale: isSelected ? 1.15 : 1 }],
                  },
                ]}
                android_ripple={{ color: "#ffffff33", borderless: false }}
              >
                {isSelected && (
                  <View style={styles.selectedIndicator}>
                    <Feather name="check" size={10} color={colors.bg} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Текущее значение */}
      <View style={[styles.currentValueContainer, { backgroundColor: colors.page }]}>
        <Text style={[styles.currentLabel, { color: colors.sub }]}>
          {t("settings.appearance.hue", { deg: Math.round(value) })}
        </Text>
        <View
          style={[
            styles.currentColorPreview,
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
  fullPaletteContainer: {
    gap: 12,
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
  selectedIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffffcc",
    alignItems: "center",
    justifyContent: "center",
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
  currentLabel: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  currentColorPreview: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
});
