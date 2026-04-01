import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
export function SearchBar({
  value,
  onChangeText,
  placeholder,
  onClear,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onClear: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ph = placeholder ?? t("tags.searchPlaceholder");
  return (
    <View
      style={[
        styles.searchBar,
        { backgroundColor: colors.searchBg, marginTop: 6 },
      ]}
    >
      <Feather name="search" size={16} color={colors.searchTxt} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={ph}
        placeholderTextColor={colors.sub}
        style={[styles.input, { color: colors.txt }]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {!!value && (
        <Pressable onPress={onClear} style={{ padding: 6 }}>
          <Feather name="x" size={16} color={colors.sub} />
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  searchBar: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, fontSize: 14 },
});
