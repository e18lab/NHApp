import { useTheme } from "@/lib/ThemeContext";
import { AppLocale, useI18n } from "@/lib/i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function LanguageRow() {
  const { colors } = useTheme();
  const { t, available, locale, setLocale } = useI18n();

  return (
    <View>
      <Text style={[styles.title, { color: colors.txt }]}>
        {t("settings.language.choose")}
      </Text>

      <View style={styles.chipContainer}>
        {available.map((opt) => (
          <Chip
            key={opt.code}
            active={locale === opt.code}
            label={opt.label}
            onPress={() => setLocale(opt.code as AppLocale)}
            colors={colors}
          />
        ))}
      </View>

      <View style={[styles.noteContainer, { backgroundColor: colors.accent + "08" }]}>
        <Feather name="info" size={14} color={colors.accent} />
        <Text style={[styles.note, { color: colors.sub }]}>
          {t("settings.language.note")}
        </Text>
      </View>
    </View>
  );
}

function Chip({
  active,
  label,
  onPress,
  colors,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? colors.accent : colors.page + "60",
          backgroundColor: active ? colors.accent + "20" : colors.bg,
          borderWidth: active ? 2 : 1.5,
        },
      ]}
      android_ripple={{ color: colors.accent + "25", borderless: false }}
    >
      {active && (
        <Feather 
          name="check" 
          size={16} 
          color={colors.accent} 
          style={{ marginRight: 6 }}
        />
      )}
      <Text
        style={[
          styles.chipText,
          { 
            color: active ? colors.accent : colors.txt,
            fontWeight: active ? "800" : "600",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  chipContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  chipText: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  note: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.8,
    flex: 1,
  },
});
