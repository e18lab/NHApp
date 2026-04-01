import React from "react";
import { rusOf, toPlural } from "./helpers";
import { TagRow } from "./TagRow";
import { TagItem, TagMode } from "./types";
export function SelectedRow({
  type,
  name,
  mode,
  isFav,
  onToggleMode,
  onRemove,
  onToggleFav,
  resolveTag,
}: {
  type: string;
  name: string;
  mode: TagMode;
  isFav: boolean;
  onToggleMode: () => void;
  onRemove: () => void;
  onToggleFav: () => void;
  resolveTag?: (typePlural: string, name: string) => TagItem | undefined;
}) {
  const found =
    (resolveTag && resolveTag(String(type), name)) ||
    ({
      id: name,
      type: toPlural(String(type)),
      name,
      count: 0,
      url: "",
      enLow: name.toLowerCase(),
      ruLow: rusOf(name).toLowerCase(),
    } as TagItem);
  return (
    <TagRow
      item={found}
      mode={mode}
      isFav={isFav}
      onTap={onToggleMode}
      onToggleFav={onToggleFav}
      onRemove={onRemove}
    />
  );
}
