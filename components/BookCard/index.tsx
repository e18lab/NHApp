import React from "react";
import BookCardClassic, { BookCardClassicProps } from "./design/BookCardClassic";

export type BookCardProps = BookCardClassicProps;

export default function BookCard(props: BookCardProps) {
  return <BookCardClassic {...props} />;
}

export { default as BookCardClassic } from "./design/BookCardClassic";
