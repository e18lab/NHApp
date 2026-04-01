/**
 * nhentai API v2 — Favorites
 *
 * GET /api/v2/favorites          Authenticated user's favorites (paginated)
 * GET /api/v2/favorites/random   Random gallery ID from favorites
 *
 * Auth: User Token or API Key required
 *
 * Note: add/remove favorites live in galleries.ts as they are
 *       sub-resources of the gallery endpoint.
 */

import { nhApi, buildQuery } from "./client";
import type { GalleryCard, Paginated } from "./types";

export interface FavoritesParams {
  /** Search within favorites */
  q?: string;
  page?: number;
  per_page?: number;
}

export async function getFavorites(
  params: FavoritesParams = {}
): Promise<Paginated<GalleryCard>> {
  return nhApi.get(`/favorites${buildQuery(params)}`);
}

/** Returns a random gallery ID from the user's favorites. */
export async function getRandomFavoriteId(): Promise<number> {
  const res = await nhApi.get<Record<string, unknown>>("/favorites/random");
  return (res as any).id as number;
}
