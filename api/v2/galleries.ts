/**
 * nhentai API v2 — Galleries
 *
 * GET  /api/v2/galleries                          List all (newest first)
 * GET  /api/v2/galleries/popular                  Today's popular (top 5)
 * GET  /api/v2/galleries/random                   Random gallery ID
 * GET  /api/v2/galleries/tagged                   Galleries by tag
 * GET  /api/v2/galleries/:id                      Full gallery detail
 * GET  /api/v2/galleries/:id/pages                All pages
 * GET  /api/v2/galleries/:id/pages/:num           Single page
 * GET  /api/v2/galleries/:id/related              Related galleries
 * GET  /api/v2/galleries/:id/favorite             Check if favorited
 * POST /api/v2/galleries/:id/favorite             Add to favorites
 * DELETE /api/v2/galleries/:id/favorite           Remove from favorites
 * POST /api/v2/galleries/:id/edit                 Submit tag edit (Staff only)
 */

import { nhApi, buildQuery } from "./client";
import type {
  Gallery,
  GalleryCard,
  GalleryPageResponse,
  GalleryPagesResponse,
  GalleryRelated,
  Paginated,
  SortOrder,
  SuccessResponse,
} from "./types";

// ─── List ─────────────────────────────────────────────────────────────────────

export interface GalleryListParams {
  page?: number;
  per_page?: number;
}

export async function getGalleries(
  params: GalleryListParams = {}
): Promise<Paginated<GalleryCard>> {
  return nhApi.get(`/galleries${buildQuery(params)}`, { public: true });
}

// ─── Popular ──────────────────────────────────────────────────────────────────

/** Returns top 5 galleries by today's popularity (cached 60s). */
export async function getPopularGalleries(): Promise<GalleryCard[]> {
  return nhApi.get("/galleries/popular");
}

// ─── Random ───────────────────────────────────────────────────────────────────

/** Returns a random gallery ID. Use getGallery(id) to fetch details. */
export async function getRandomGalleryId(): Promise<number> {
  const res = await nhApi.get<Record<string, unknown>>("/galleries/random");
  // API returns `{ id: number }` shaped object
  return (res as any).id as number;
}

// ─── By tag ───────────────────────────────────────────────────────────────────

export interface GalleryByTagParams {
  tag_id: number;
  sort?: SortOrder;
  page?: number;
  per_page?: number;
}

export async function getGalleriesByTag(
  params: GalleryByTagParams
): Promise<Paginated<GalleryCard>> {
  return nhApi.get(`/galleries/tagged${buildQuery(params)}`);
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export type GalleryInclude = "comments" | "related" | "favorite";

export interface GetGalleryParams {
  /** Comma-separated or array of includes */
  include?: GalleryInclude[] | string;
}

export async function getGallery(
  galleryId: number,
  params: GetGalleryParams = {}
): Promise<Gallery> {
  const include = Array.isArray(params.include)
    ? params.include.join(",")
    : params.include;
  return nhApi.get(`/galleries/${galleryId}${buildQuery({ include })}`);
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function getGalleryPages(
  galleryId: number
): Promise<GalleryPagesResponse> {
  return nhApi.get(`/galleries/${galleryId}/pages`, { public: true });
}

export async function getGalleryPage(
  galleryId: number,
  pageNumber: number
): Promise<GalleryPageResponse> {
  return nhApi.get(`/galleries/${galleryId}/pages/${pageNumber}`, {
    public: true,
  });
}

// ─── Related ──────────────────────────────────────────────────────────────────

function normalizeRelatedList(raw: unknown): GalleryRelated[] {
  if (Array.isArray(raw)) return raw as GalleryRelated[];
  if (raw && typeof raw === "object" && Array.isArray((raw as Paginated<GalleryRelated>).result)) {
    return (raw as Paginated<GalleryRelated>).result;
  }
  return [];
}

/** Related may be a bare array or `{ result, num_pages, … }` like other v2 lists. */
export async function getRelatedGalleries(
  galleryId: number
): Promise<GalleryRelated[]> {
  const raw = await nhApi.get<unknown>(`/galleries/${galleryId}/related`);
  return normalizeRelatedList(raw);
}

// ─── Favorite ─────────────────────────────────────────────────────────────────

export async function isFavorited(
  galleryId: number
): Promise<{ is_favorited: boolean }> {
  return nhApi.get(`/galleries/${galleryId}/favorite`);
}

export async function addFavorite(galleryId: number): Promise<SuccessResponse> {
  return nhApi.post(`/galleries/${galleryId}/favorite`);
}

export async function removeFavorite(
  galleryId: number
): Promise<SuccessResponse> {
  return nhApi.delete(`/galleries/${galleryId}/favorite`);
}

// ─── Gallery edit (Staff only) ────────────────────────────────────────────────

export interface GalleryEditParams {
  /** New tags to create and add */
  created_tags?: { type: string; name: string }[];
  /** Existing tag IDs to add */
  added_tags?: number[];
  /** Existing tag IDs to remove */
  removed_tags?: number[];
}

export async function submitGalleryEdit(
  galleryId: number,
  params: GalleryEditParams
): Promise<SuccessResponse & { edit_id: number; auto_applied: boolean }> {
  return nhApi.post(`/galleries/${galleryId}/edit`, {
    created_tags: params.created_tags ?? [],
    added_tags: params.added_tags ?? [],
    removed_tags: params.removed_tags ?? [],
  });
}
