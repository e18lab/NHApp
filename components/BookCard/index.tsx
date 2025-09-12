// components/BookCard/index.tsx
import { Book, Tag } from "@/api/nhentai";
import React from "react";

import BookCardClassic, { BookCardClassicProps } from "./design/BookCardClassic";
import BookCardImage, { BookCardImageProps } from "./design/BookCardImage";
import BookCardStable, { BookCardStableProps } from "./design/BookCardStable";

export type BookCardProps = {
  book: Book;
  cardWidth?: number;
  design?: "stable" | "classic" | "image";
  isSingleCol?: boolean;
  contentScale?: number;
  isFavorite?: boolean;
  selectedTags?: Tag[];
  onToggleFavorite?: (id: number, next: boolean) => void;
  onPress?: (id: number) => void;
  score?: number;
  background?: string;
  vertical?: boolean | "true" | "false";
  showProgressOnCard?: boolean;
  favoritesSet?: Set<number>;
  historyMap?: Record<number, { current: number; total: number; ts: number }>;
  hydrateFromStorage?: boolean;
};

export default function BookCard(props: BookCardProps) {
  const { design = "classic", ...rest } = props;

  if (design === "image") {
    const imageProps: BookCardImageProps = {
      book: rest.book,
      cardWidth: rest.cardWidth,
      contentScale: rest.contentScale,
      onPress: rest.onPress,
      background: rest.background,
    };
    return <BookCardImage {...imageProps} />;
  }

  if (design === "classic") {
    const classicProps: BookCardClassicProps = {
      book: rest.book,
      cardWidth: rest.cardWidth,
      contentScale: rest.contentScale,
      isFavorite: rest.isFavorite,
      onPress: rest.onPress,
      background: rest.background,
    };
    return <BookCardClassic {...classicProps} />;
  }

  const stableProps: BookCardStableProps = {
    book: rest.book,
    cardWidth: rest.cardWidth,
    isSingleCol: rest.isSingleCol,
    contentScale: rest.contentScale,
    isFavorite: rest.isFavorite,
    selectedTags: rest.selectedTags,
    onToggleFavorite: rest.onToggleFavorite,
    onPress: rest.onPress,
    score: rest.score,
    background: rest.background,
    vertical: rest.vertical,
    showProgressOnCard: rest.showProgressOnCard,
    favoritesSet: rest.favoritesSet,
    historyMap: rest.historyMap,
    hydrateFromStorage: rest.hydrateFromStorage,
  };

  return <BookCardStable {...stableProps} />;
}

export { default as BookCardClassic } from "./design/BookCardClassic";
export { default as BookCardImage } from "./design/BookCardImage";
export { default as BookCardStable } from "./design/BookCardStable";

