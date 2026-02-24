/**
 * Graph — визуализация долей (хранилище, скачанное, свободно, другое).
 * Универсальный компонент для приложения: ПК и Android.
 */
import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";

/** Форматирует размер в байтах в читаемую строку (ГБ, МБ, КБ, Б). */
export function formatStorageSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
  return `${bytes} B`;
}

export type GraphSegment = {
  /** Уникальный ключ */
  key: string;
  /** Цвет сегмента и точки в легенде */
  color: string;
  /** Название категории */
  label: string;
  /** Размер в байтах (определяет долю в полосе) */
  size: number;
};

export type GraphProps = {
  /** Заголовок над полосой (например путь или «Хранилище») */
  title?: string;
  /** Сегменты: цвет, подпись, размер в байтах */
  segments: GraphSegment[];
  /** Описание под легендой */
  description?: string;
  style?: StyleProp<ViewStyle>;
};

const BAR_HEIGHT = 12;
const LEGEND_DOT_SIZE = 8;

export function Graph({ title, segments, description, style }: GraphProps) {
  const { colors } = useTheme();
  const total = segments.reduce((s, seg) => s + seg.size, 0) || 1;

  const barSegments = segments.map((seg, i) => {
    const isFirst = i === 0;
    const isLast = i === segments.length - 1;
    const flex =
      total > 0 && seg.size > 0
        ? Math.max(seg.size / total, seg.size / total < 0.001 ? 0.001 : 0)
        : 0;
    return {
      ...seg,
      flex: flex > 0 ? flex : 0,
      isFirst,
      isLast,
    };
  });

  return (
    <View style={[s.wrapper, style]}>
      {title != null && title !== "" ? (
        <Text
          selectable={false}
          style={[s.title, { color: colors.txt }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : null}

      <View style={s.barWrap}>
        {barSegments.map(({ key, color, flex, isFirst, isLast }) => (
          <View
            key={key}
            style={[
              s.segment,
              {
                backgroundColor: color,
                flex,
                borderTopLeftRadius: isFirst ? BAR_HEIGHT / 2 : 0,
                borderBottomLeftRadius: isFirst ? BAR_HEIGHT / 2 : 0,
                borderTopRightRadius: isLast ? BAR_HEIGHT / 2 : 0,
                borderBottomRightRadius: isLast ? BAR_HEIGHT / 2 : 0,
              },
            ]}
          />
        ))}
      </View>

      <View style={s.legend}>
        {segments.map((seg) => (
          <View key={seg.key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: seg.color }]} />
            <Text
              selectable={false}
              style={[s.legendLabel, { color: colors.txt }]}
              numberOfLines={1}
            >
              {seg.label}
            </Text>
            <Text
              selectable={false}
              style={[s.legendSize, { color: colors.sub }]}
              numberOfLines={1}
            >
              {formatStorageSize(seg.size)}
            </Text>
          </View>
        ))}
      </View>

      {description != null && description !== "" ? (
        <Text
          selectable={false}
          style={[s.description, { color: colors.sub }]}
          numberOfLines={3}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    minWidth: 200,
    maxWidth: 600,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  barWrap: {
    flexDirection: "row",
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
    marginBottom: 12,
  },
  segment: {
    minWidth: 2,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    rowGap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  legendDot: {
    width: LEGEND_DOT_SIZE,
    height: LEGEND_DOT_SIZE,
    borderRadius: LEGEND_DOT_SIZE / 2,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 0,
  },
  legendSize: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 2,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
    opacity: 0.9,
  },
});
