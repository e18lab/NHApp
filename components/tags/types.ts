export type TagKind = "tags" | "artists" | "characters" | "parodies" | "groups";
export type TagSingular = "tag" | "artist" | "character" | "parody" | "group";
export interface TagEntry {
  id: number | string;
  type: TagKind | TagSingular | string;
  name: string;
  count: number;
  url: string;
}
export type TagItem = Omit<TagEntry, "type"> & {
  type: TagKind;
  enLow: string;
  ruLow: string;
};
export type TagMode = "include" | "exclude";
export type DraftItem = { type: TagKind; name: string; mode: TagMode };
export type Draft = { id: string; name: string; items: DraftItem[] };
export type MainTab = "all" | "favs" | "collections";
