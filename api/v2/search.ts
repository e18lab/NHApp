/**
 * nhentai API v2 — Search
 *
 * GET /api/v2/search
 *
 * Query syntax:
 *   Keywords:          word
 *   Exact phrase:      "exact phrase"
 *   Negation:          -word  /  -"exact phrase"  /  -artist:name
 *   Tag filters:       artist:name  language:english  tag:"big breasts"
 *   Numeric filters:   pages:>10  favorites:>=100
 *   Date filters:      uploaded:<7d  uploaded:>1m
 */

import { nhApi, buildQuery } from "./client";
import { getGalleries } from "./galleries";
import type { GalleryCard, Paginated, SortOrder } from "./types";

export interface SearchParams {
  query: string;
  sort?: SortOrder;
  page?: number;
  /** If set, passed to list/search where supported */
  per_page?: number;
}

/**
 * v2 `/search` rejects requests with a missing or empty `query` (400: Field required).
 * - Default "browse" (no keywords / tag filters): use `GET /galleries` for `sort=date`.
 * - Other sorts still need `/search`; use a match-all placeholder for the required field.
 */
const BROWSE_MATCH_ALL = "*";

export async function searchGalleries(
  params: SearchParams
): Promise<Paginated<GalleryCard>> {
  const q = (params.query ?? "").trim();
  const sort = params.sort ?? "date";
  const page = params.page ?? 1;
  const per_page = params.per_page;

  if (!q) {
    if (sort === "date") {
      return getGalleries({ page, per_page });
    }
    return nhApi.get(
      `/search${buildQuery({
        query: BROWSE_MATCH_ALL,
        sort,
        page,
        ...(per_page != null ? { per_page } : {}),
      })}`
    );
  }

  return nhApi.get(
    `/search${buildQuery({
      query: q,
      sort,
      page,
      ...(per_page != null ? { per_page } : {}),
    })}`
  );
}
