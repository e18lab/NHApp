import { Book } from "@/api/nhentai";
import SmartImage from "@/components/SmartImage";
import { buildImageFallbacks } from "@/components/buildImageFallbacks";
import { useTheme } from "@/lib/ThemeContext";
import React, { useMemo } from "react";
import { Pressable, View } from "react-native";
import { makeCardStyles } from "../BookCard.styles";

export interface BookCardImageProps {
  book: Book;
  cardWidth?: number;
  contentScale?: number;
  isFavorite?: boolean;
  onPress?: (id: number) => void;
  background?: string;
}

export default function BookCardImage({
  book,
  cardWidth = 160,
  contentScale = 1,
  onPress,
  background,
}: BookCardImageProps) {
  const { colors } = useTheme();
  const styles = useMemo(
    () => makeCardStyles(colors, cardWidth, contentScale),
    [colors, cardWidth, contentScale]
  );

  const variants = buildImageFallbacks(book.thumbnail || book.thumbnail);

  return (
    <Pressable
      onPress={() => onPress?.(book.id)}
      style={[
        { width: cardWidth, borderRadius: styles.card.borderRadius as number, overflow: "hidden" },
        background ? { backgroundColor: background } : null,
      ]}
    >
      <View style={styles.imageWrap}>
        <SmartImage sources={variants} style={styles.cover} />
      </View>
    </Pressable>
  );
}
