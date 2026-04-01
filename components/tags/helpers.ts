import { Feather } from "@expo/vector-icons";
import { TagItem, TagKind, TagSingular } from "./types";
export const sanitize = (s: string) => s.replace(/[^a-z]/gi, "").toUpperCase();
export const rusOf = (name: string) => name;
export const LABEL_OF: Record<TagKind, string> = {
  tags: "тег",
  artists: "художник",
  characters: "персонаж",
  parodies: "пародия",
  groups: "группа",
};
export const toPlural = (s: string): TagKind =>
  s === "tag"
    ? "tags"
    : s === "artist"
    ? "artists"
    : s === "character"
    ? "characters"
    : s === "parody"
    ? "parodies"
    : s === "group"
    ? "groups"
    : (s as TagKind);
export const toSingular = (s: string): TagSingular =>
  s === "tags"
    ? "tag"
    : s === "artists"
    ? "artist"
    : s === "characters"
    ? "character"
    : s === "parodies"
    ? "parody"
    : s === "groups"
    ? "group"
    : (s as TagSingular);
export const typeIcon = (t: TagKind): keyof typeof Feather.glyphMap =>
  t === "tags"
    ? "tag"
    : t === "artists"
    ? "pen-tool"
    : t === "characters"
    ? "user"
    : t === "parodies"
    ? "film"
    : "users";
export const scoreByQuery = (t: TagItem, needle: string) => {
  if (!needle) return 0;
  const prefix =
    t.enLow.startsWith(needle) || t.ruLow.startsWith(needle) ? 3 : 0;
  const byWord =
    t.enLow.includes(` ${needle}`) || t.ruLow.includes(` ${needle}`) ? 2 : 0;
  const substr = t.enLow.includes(needle) || t.ruLow.includes(needle) ? 1 : 0;
  return prefix * 1_000_000 + byWord * 100_000 + substr * 1_000 + t.count;
};
export const FAV_KEY = "tag.favs.v1";
export const FAV_KEY_LEGACY = "tag.favs";
export const favKeyOf = (t: { type: string; name: string }) =>
  `${toPlural(String(t.type))}:${t.name}`;
export const normalizeFavMap = (obj: any): Record<string, true> => {
  const out: Record<string, true> = {};
  if (!obj || typeof obj !== "object") return out;
  for (const k of Object.keys(obj)) {
    const [rawType, ...rest] = k.split(":");
    const name = rest.join(":");
    out[`${toPlural(String(rawType))}:${name}`] = true as const;
  }
  return out;
};
