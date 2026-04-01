/**
 * Shared domain types used across the app.
 *
 * These were previously co-located with nhentai.ts legacy API code.
 * Import from here instead of @/api/nhentai.
 */

export interface Tag {
  id: number;
  type: string;
  name: string;
  url: string;
  count: number;
}

export interface BookPage {
  page: number;
  url: string;
  urlThumb: string;
  width: number;
  height: number;
}

export interface Book {
  id: number;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  uploaded: string;
  media: number;
  favorites: number;
  pagesCount: number;
  scanlator: string;
  tags: Tag[];
  cover: string;
  coverW: number;
  coverH: number;
  thumbnail: string;
  pages: BookPage[];
  artists?: Tag[];
  characters?: Tag[];
  parodies?: Tag[];
  groups?: Tag[];
  categories?: Tag[];
  languages?: Tag[];
  /** nhentai language tag ids from list API (v2); used when `languages` is empty */
  tagIds?: number[];
  raw?: any;
}

export interface ApiUser {
  id: number;
  username: string;
  slug: string;
  avatar_url: string;
  is_superuser: boolean;
  is_staff: boolean;
  avatar?: string;
}

export interface GalleryComment {
  id: number;
  gallery_id: number;
  poster: ApiUser;
  post_date: number;
  body: string;
  avatar?: string;
}

export interface Paged<T> {
  items: T[];
  books: T[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
  perPage?: number;
  [extra: string]: any;
}

/** Tag include/exclude filter used by search and browse. */
export interface TagFilter {
  type: Tag["type"];
  name: string;
}
