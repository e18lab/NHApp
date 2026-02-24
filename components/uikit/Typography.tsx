import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import { StyleSheet, Text, type TextProps, View } from "react-native";

export type TypographyVariant =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body"
  | "bodySmall"
  | "caption"
  | "label"
  | "overline";

export type TypographyProps = TextProps & {
  variant?: TypographyVariant;
  /** Muted (secondary) color */
  muted?: boolean;
  children: React.ReactNode;
};

const variantStyles: Record<
  TypographyVariant,
  { fontSize: number; fontWeight: "400" | "600" | "700" | "800"; lineHeight: number; letterSpacing: number }
> = {
  h1: { fontSize: 28, fontWeight: "800", lineHeight: 34, letterSpacing: 0.4 },
  h2: { fontSize: 22, fontWeight: "700", lineHeight: 28, letterSpacing: 0.35 },
  h3: { fontSize: 18, fontWeight: "700", lineHeight: 24, letterSpacing: 0.3 },
  h4: { fontSize: 16, fontWeight: "600", lineHeight: 22, letterSpacing: 0.25 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 24, letterSpacing: 0.2 },
  bodySmall: { fontSize: 14, fontWeight: "400", lineHeight: 20, letterSpacing: 0.18 },
  caption: { fontSize: 13, fontWeight: "400", lineHeight: 18, letterSpacing: 0.15 },
  label: { fontSize: 12, fontWeight: "600", lineHeight: 16, letterSpacing: 0.2 },
  overline: { fontSize: 11, fontWeight: "700", lineHeight: 14, letterSpacing: 0.8 },
};

export const Typography = React.memo(function Typography({
  variant = "body",
  muted = false,
  children,
  style,
  ...rest
}: TypographyProps) {
  const { colors } = useTheme();
  const v = variantStyles[variant];
  const color = muted ? colors.sub : colors.txt;

  return (
    <Text
      style={[
        {
          fontSize: v.fontSize,
          fontWeight: v.fontWeight,
          lineHeight: v.lineHeight,
          letterSpacing: v.letterSpacing,
          color,
        },
        variant === "overline" && styles.overline,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
});

const styles = StyleSheet.create({
  overline: {
    textTransform: "uppercase",
  },
});

/** Helper to render a typography sample block with variant name (for UIKit showcase). */
export function TypographySample({
  variant,
  sample,
}: {
  variant: TypographyVariant;
  sample: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={sampleStyles.row}>
      <Text style={[sampleStyles.label, { color: colors.sub }]}>{variant}</Text>
      <Typography variant={variant}>{sample}</Typography>
    </View>
  );
}

const sampleStyles = StyleSheet.create({
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
});
