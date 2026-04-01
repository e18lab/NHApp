/**
 * api/v2/compat.ts
 *
 * Compatibility adapters: new v2 types → old Book/GalleryComment types.
 *
 * Why: existing components (BookCard, Hero, BookList…) use the old Book shape.
 * Instead of touching every component, we convert at the API call site so the
 * UI keeps working. Migrate components to use Gallery directly over time.
 */

import type {
  Gallery,
  GalleryCard,
  GalleryRelated,
  Comment,
} from "./types";
import { resolveThumbUrl, resolveImageUrl } from "./config";

// Pull old types for the return signatures without importing the whole old module
import type { Book, BookPage, GalleryComment, ApiUser } from "@/api/nhappApi/types";
import type { TagFilter } from "@/api/nhappApi/types";

// ─── Gallery (full detail) → Book ─────────────────────────────────────────────

export function galleryToBook(g: Gallery): Book {
  const byType = (type: string) => g.tags.filter((t) => t.type === type);

  const pages: BookPage[] = g.pages.map((p) => ({
    page: p.number,
    url: resolveImageUrl(p.path),
    urlThumb: resolveThumbUrl(p.thumbnail),
    width: p.width,
    height: p.height,
  }));

  return {
    id: g.id,
    title: g.title,
    uploaded: new Date(g.upload_date * 1000).toISOString(),
    media: parseInt(g.media_id, 10) || 0,
    favorites: g.num_favorites,
    pagesCount: g.num_pages,
    scanlator: g.scanlator,
    tags: g.tags as any,
    // Covers are served on thumb CDN (t*), not image CDN (i*) — i* returns 403 for /galleries/.../cover.*
    cover: resolveThumbUrl(g.cover.path),
    coverW: g.cover.width,
    coverH: g.cover.height,
    thumbnail: resolveThumbUrl(g.thumbnail.path),
    pages,
    artists: byType("artist") as any,
    characters: byType("character") as any,
    parodies: byType("parody") as any,
    groups: byType("group") as any,
    categories: byType("category") as any,
    languages: byType("language") as any,
    tagIds: g.tags.map((t) => t.id),
    raw: g,
  } as Book;
}

// ─── GalleryCard (list item) → Book ──────────────────────────────────────────

/**
 * Lightweight conversion for list/search results.
 * Fields not available in GalleryCard (pagesCount, favorites, tags, etc.)
 * are left empty — sufficient for card rendering which only needs
 * id, title, and thumbnail.
 */
export function galleryCardToBook(c: GalleryCard): Book {
  const thumb = resolveThumbUrl(c.thumbnail);
  return {
    id: c.id,
    title: {
      english: c.english_title,
      japanese: c.japanese_title,
      pretty: c.english_title,
    },
    uploaded: c.upload_date ? new Date(c.upload_date * 1000).toISOString() : "",
    media: parseInt(c.media_id, 10) || 0,
    favorites: c.num_favorites ?? 0,
    pagesCount: c.num_pages ?? 0,
    scanlator: "",
    tags: [],
    cover: thumb,
    coverW: c.thumbnail_width,
    coverH: c.thumbnail_height,
    thumbnail: thumb,
    pages: [],
    artists: [],
    characters: [],
    parodies: [],
    groups: [],
    categories: [],
    languages: [],
    tagIds: c.tag_ids?.length ? [...c.tag_ids] : [],
  } as unknown as Book;
}

// ─── GalleryRelated → Book ────────────────────────────────────────────────────

export function galleryRelatedToBook(r: GalleryRelated): Book {
  const thumb = resolveThumbUrl(r.thumbnail);
  return {
    id: r.id,
    title: {
      english: r.english_title,
      japanese: r.japanese_title,
      pretty: r.english_title,
    },
    uploaded: r.upload_date ? new Date(r.upload_date * 1000).toISOString() : "",
    media: parseInt(r.media_id ?? "0", 10) || 0,
    favorites: r.num_favorites ?? 0,
    pagesCount: r.num_pages ?? 0,
    scanlator: "",
    tags: [],
    cover: thumb,
    coverW: r.thumbnail_width,
    coverH: r.thumbnail_height,
    thumbnail: thumb,
    pages: [],
    artists: [],
    characters: [],
    parodies: [],
    groups: [],
    categories: [],
    languages: [],
    tagIds: r.tag_ids?.length ? [...r.tag_ids] : [],
  } as unknown as Book;
}

// ─── Comment → GalleryComment ─────────────────────────────────────────────────

export function commentToGalleryComment(c: Comment): GalleryComment {
  // Avatars are served from i*.nhentai.net CDN, not the main site
  const avatarFull = resolveImageUrl(c.poster.avatar_url);
  const poster: ApiUser = {
    id: c.poster.id,
    username: c.poster.username,
    slug: c.poster.slug,
    avatar_url: avatarFull,
    is_superuser: c.poster.is_superuser,
    is_staff: c.poster.is_staff,
    avatar: avatarFull,
  };
  return {
    id: c.id,
    gallery_id: c.gallery_id,
    poster,
    // v2 returns unix seconds; CommentCard's parseToMs handles both ms and seconds
    post_date: c.post_date,
    body: c.body,
    avatar: avatarFull,
  };
}

// ─── Search query builder ─────────────────────────────────────────────────────

/**
 * Converts old-style search params to v2 query string syntax.
 *
 * @param base        Raw keyword query (e.g. "catgirl")
 * @param include     Tags to require (e.g. [{ type: "artist", name: "mujin" }])
 * @param exclude     Tags to block  (e.g. [{ type: "tag", name: "netorare" }])
 * @param uploaded    Pre-built uploaded filter (e.g. "uploaded:>2024-01-01") or null
 */
export function buildV2Query(
  base: string,
  include: TagFilter[] = [],
  exclude: TagFilter[] = [],
  uploaded?: string | null
): string {
  const parts: string[] = [];

  if (base?.trim()) parts.push(base.trim());

  for (const t of include) {
    const val = t.name.includes(" ") ? `"${t.name}"` : t.name;
    parts.push(`${t.type}:${val}`);
  }

  for (const t of exclude) {
    const val = t.name.includes(" ") ? `"${t.name}"` : t.name;
    parts.push(`-${t.type}:${val}`);
  }

  // uploaded is already formatted as "uploaded:>DATE" from DateRangeContext
  if (uploaded) parts.push(uploaded);

  return parts.join(" ") || "";
}
