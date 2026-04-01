import type { Book } from "@/api/nhappApi/types";
import BookList from "@/components/BookList";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function RelatedSection({
  related,
  relLoading,
  refetchRelated,
  favorites,
  toggleFav,
  baseGrid,
  innerPadding,
}: {
  related: Book[];
  relLoading: boolean;
  refetchRelated: () => Promise<void>;
  favorites: Set<number>;
  toggleFav: (bid: number, next: boolean) => void;
  baseGrid: any;
  innerPadding: number;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const oneRowGrid = useMemo(
    () => ({
      ...baseGrid,
      numColumns: Math.min(5, related.length || 5),
      paddingHorizontal: innerPadding * 1.9,
      columnGap: 12,
      minColumnWidth: 180,
    }),
    [baseGrid, related.length, innerPadding]
  );

  return (
    <View style={{ paddingTop: 32, paddingBottom: 40 }}>
      <Text
        style={[
          s.label,
          { color: colors.txt, paddingHorizontal: innerPadding },
        ]}
      >
        {t("related")}
      </Text>
      <View style={{ marginHorizontal: -innerPadding }}>
        <BookList
          data={related}
          loading={relLoading}
          refreshing={false}
          onRefresh={refetchRelated}
          isFavorite={(bid) => favorites.has(bid)}
          onToggleFavorite={toggleFav}
          onPress={(bid) =>
            router.push({
              pathname: "/book/[id]",
              params: {
                id: String(bid),
                title: related.find((b) => b.id === bid)?.title.pretty,
              },
            })
          }
          gridConfig={{ default: oneRowGrid }}
          horizontal
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 16,
  },
});
