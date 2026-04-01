import type { GridConfig } from "@/components/BookList";

/** Карточек на одну страницу пагинации (главная, обзор, синхрон с типичным per_page API). */
export const BROWSE_CARDS_PER_PAGE = 25;

/**
 * Оценка «карточек на экран» по сетке (для превью/других сценариев).
 */
export function estimateItemsPerBrowsePage(
  width: number,
  height: number,
  grid: GridConfig,
  listHeightFraction = 0.74
): number {
  const padH = grid.paddingHorizontal ?? 0;
  const gap = grid.columnGap ?? 5;
  const minW = grid.minColumnWidth ?? 80;
  const avail = Math.max(0, width - padH * 2);
  const cols = Math.max(
    1,
    Math.min(grid.numColumns, Math.floor((avail + gap) / (minW + gap)))
  );
  const cardW = Math.max(minW, (avail - gap * (cols - 1)) / cols);
  const estCardH = Math.round(cardW * 1.35);
  const rowH = Math.max(1, estCardH + gap);
  const listH = Math.max(rowH * 2, height * listHeightFraction);
  const rows = Math.max(2, Math.floor(listH / rowH));
  return Math.max(cols * 2, cols * rows);
}
