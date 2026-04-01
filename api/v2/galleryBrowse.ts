/**
 * Browse galleries for home/explore: use `/galleries/tagged` when the query is
 * equivalent to a single tag page (matches nhentai.net/tag/...), so `num_pages`
 * is not capped like v2 `/search` (~1000).
 */

import { BROWSE_CARDS_PER_PAGE } from "@/utils/browseGridPageSize";
import { buildV2Query } from "./compat";
import { getGalleriesByTag } from "./galleries";
import { searchGalleries } from "./search";
import { autocompleteTags } from "./tags";
import type { GalleryCard, Paginated, SortOrder, TagType } from "./types";

export interface GalleryBrowseFilter {
  type: string;
  name: string;
  id?: string | number;
}

export interface FetchGalleryBrowseParams {
  query: string;
  includes: GalleryBrowseFilter[];
  excludes: GalleryBrowseFilter[];
  uploaded?: string | null;
  sort: SortOrder;
  page: number;
  per_page?: number;
}

const TAG_ID_CACHE = new Map<string, number>();

function filterTypeToApiTagType(type: string): TagType | null {
  const t = String(type).toLowerCase();
  const map: Record<string, TagType> = {
    tag: "tag",
    tags: "tag",
    artist: "artist",
    artists: "artist",
    character: "character",
    characters: "character",
    parody: "parody",
    parodies: "parody",
    group: "group",
    groups: "group",
    language: "language",
    languages: "language",
    category: "category",
    categories: "category",
  };
  return map[t] ?? null;
}

function cacheKeyForTag(apiType: TagType, name: string): string {
  return `${apiType}:${name.trim().toLowerCase()}`;
}

/**
 * When browse state matches a single tag listing (no keywords, excludes, or
 * uploaded filter), return nhentai tag id for `getGalleriesByTag`.
 */
export async function tryResolveSingleTagBrowseId(
  includes: GalleryBrowseFilter[],
  excludes: GalleryBrowseFilter[],
  queryTrim: string,
  uploaded?: string | null
): Promise<number | null> {
  if (queryTrim) return null;
  if (uploaded) return null;
  if (excludes.length > 0) return null;
  if (includes.length !== 1) return null;

  const inc = includes[0];
  const apiType = filterTypeToApiTagType(inc.type);
  if (!apiType) return null;

  const ck = cacheKeyForTag(apiType, inc.name);

  if (inc.id != null && inc.id !== "") {
    const n = Number(inc.id);
    if (Number.isFinite(n) && n > 0) {
      TAG_ID_CACHE.set(ck, n);
      return n;
    }
  }

  const cached = TAG_ID_CACHE.get(ck);
  if (cached != null) return cached;

  const candidates = await autocompleteTags({
    query: inc.name.trim(),
    type: apiType,
    limit: 40,
  });
  const want = inc.name.trim().toLowerCase();
  const hit = candidates.find((t) => t.name.trim().toLowerCase() === want);
  if (hit?.id != null && Number.isFinite(hit.id)) {
    TAG_ID_CACHE.set(ck, hit.id);
    return hit.id;
  }

  return null;
}

export async function fetchGalleryBrowsePaginated(
  params: FetchGalleryBrowseParams
): Promise<Paginated<GalleryCard>> {
  const q = (params.query ?? "").trim();
  const tagId = await tryResolveSingleTagBrowseId(
    params.includes,
    params.excludes,
    q,
    params.uploaded
  );

  const page = params.page ?? 1;
  const sort = params.sort ?? "date";
  const per_page = params.per_page ?? BROWSE_CARDS_PER_PAGE;
  const perQ = { per_page };

  if (tagId != null) {
    return getGalleriesByTag({
      tag_id: tagId,
      sort,
      page,
      ...perQ,
    });
  }

  const v2Query = buildV2Query(
    q || "",
    params.includes,
    params.excludes,
    params.uploaded ?? null
  );

  return searchGalleries({
    query: v2Query,
    sort,
    page,
    ...perQ,
  });
}

// ─── Slice by global index (UI pages × items per screen) ─────────────────────

export interface BrowseSliceResult {
  slice: GalleryCard[];
  /** Всего результатов (как на сайте), для пагинации по сетке */
  total: number;
  per_page: number;
}

export function totalFromPaginated(p: Paginated<GalleryCard>): number {
  if (typeof p.total === "number" && p.total > 0 && Number.isFinite(p.total)) {
    return p.total;
  }
  const n = p.num_pages ?? 1;
  const per = p.per_page ?? BROWSE_CARDS_PER_PAGE;
  return Math.max(0, n * per);
}

/**
 * Загружает непрерывный срез каталога [offsetStart, offsetStart + itemCount)
 * поверх постраничного API (несколько запросов при необходимости).
 */
export async function fetchGalleryBrowseSlice(
  params: Omit<FetchGalleryBrowseParams, "page">,
  offsetStart: number,
  itemCount: number
): Promise<BrowseSliceResult> {
  const safeCount = Math.max(0, itemCount);
  const offsetEnd = offsetStart + safeCount;
  const collected: GalleryCard[] = [];
  let perPage = BROWSE_CARDS_PER_PAGE;
  let total = 0;
  let apiPage = Math.max(1, Math.floor(offsetStart / perPage) + 1);
  let aligned = false;

  for (let guard = 0; guard < 100; guard++) {
    const res = await fetchGalleryBrowsePaginated({ ...params, page: apiPage });
    perPage = Math.max(1, res.per_page || perPage);
    total = Math.max(total, totalFromPaginated(res));

    if (!aligned) {
      const wantPage = Math.floor(offsetStart / perPage) + 1;
      if (wantPage !== apiPage) {
        apiPage = wantPage;
        continue;
      }
      aligned = true;
    }

    const g0 = (apiPage - 1) * perPage;
    const g1 = g0 + res.result.length;
    const a = Math.max(offsetStart, g0);
    const b = Math.min(offsetEnd, g1);
    if (a < b) {
      collected.push(...res.result.slice(a - g0, b - g0));
    }

    if (collected.length >= safeCount) break;
    if (g1 >= offsetEnd) break;
    if (res.result.length < perPage) break;
    if (g1 >= total) break;

    apiPage++;
  }

  return { slice: collected.slice(0, safeCount), total, per_page: perPage };
}
