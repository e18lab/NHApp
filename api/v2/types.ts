// ─── Shared primitive types ───────────────────────────────────────────────────

export type SortOrder =
  | "date"
  | "popular"
  | "popular-today"
  | "popular-week"
  | "popular-month";

export type TagType =
  | "tag"
  | "artist"
  | "parody"
  | "character"
  | "group"
  | "language"
  | "category";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: UserLite;
}

export interface UserLite {
  id: number;
  username: string;
  slug: string;
  avatar_url: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface Session {
  id: string;
  created_at: number;
  expires_at: number;
  ip_address: string;
  user_agent: string;
  current: boolean;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export interface Tag {
  id: number;
  type: string;
  name: string;
  slug: string;
  url: string;
  count: number;
}

export interface TagShort {
  id: number;
  type: string;
  name: string;
  slug: string;
  count: number;
}

// ─── Galleries ────────────────────────────────────────────────────────────────

/** Lightweight gallery card returned in list/search responses */
export interface GalleryCard {
  id: number;
  media_id: string;
  thumbnail: string;
  thumbnail_width: number;
  thumbnail_height: number;
  english_title: string;
  japanese_title: string;
  tag_ids: number[];
  // These may be included depending on the endpoint/API version
  num_pages?: number;
  num_favorites?: number;
  upload_date?: number;
  scanlator?: string;
}

/** Full gallery detail returned by GET /galleries/{id} */
export interface Gallery {
  id: number;
  media_id: string;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  cover: GalleryImage;
  thumbnail: GalleryImage;
  scanlator: string;
  upload_date: number;
  tags: Tag[];
  num_pages: number;
  num_favorites: number;
  pages: GalleryPage[];
  comments?: Comment[];
  related?: GalleryRelated[];
  is_favorited?: boolean;
}

export interface GalleryImage {
  path: string;
  width: number;
  height: number;
}

export interface GalleryPage {
  number: number;
  path: string;
  width: number;
  height: number;
  thumbnail: string;
  thumbnail_width: number;
  thumbnail_height: number;
}

export interface GalleryRelated {
  id: number;
  media_id?: string;
  thumbnail: string;
  thumbnail_width: number;
  thumbnail_height: number;
  english_title: string;
  japanese_title: string;
  tag_ids?: number[];
  num_pages?: number;
  num_favorites?: number;
  upload_date?: number;
}

// ─── Pages response ───────────────────────────────────────────────────────────

export interface GalleryPagesResponse {
  gallery_id: number;
  media_id: string;
  num_pages: number;
  pages: GalleryPage[];
}

export interface GalleryPageResponse {
  gallery_id: number;
  media_id: string;
  page: GalleryPage;
  num_pages: number;
  is_first_page: boolean;
  is_last_page: boolean;
  next_page: number | null;
  previous_page: number | null;
}

// ─── Paginated list ───────────────────────────────────────────────────────────

export interface Paginated<T> {
  result: T[];
  num_pages: number;
  per_page: number;
  total: number;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: number;
  gallery_id: number;
  poster: UserLite;
  post_date: number;
  body: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface Me extends UserLite {
  email: string;
  theme?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  created_at: number;
  last_used_at: number | null;
}

// ─── User public profile ──────────────────────────────────────────────────────

export interface UserProfile {
  id: number;
  username: string;
  slug: string;
  avatar_url: string;
  is_superuser: boolean;
  is_staff: boolean;
  date_joined: number;
  about: string;
  favorite_tags: string;
  recent_favorites: {
    id: number;
    thumbnail: string;
    thumbnail_width: number;
    thumbnail_height: number;
    english_title: string;
    japanese_title: string;
  }[];
  recent_comments: {
    id: number;
    gallery_id: number;
    body: string;
    post_date: number;
    gallery_title: string;
  }[];
}

// ─── Blacklist ────────────────────────────────────────────────────────────────

export interface Blacklist {
  tags: TagShort[];
  count: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface CdnConfig {
  image_servers: string[];
  thumb_servers: string[];
}

/** GET /api/v2/config — CDN host lists + optional announcement */
export interface AppSiteConfig extends CdnConfig {
  announcement?: string | null;
}

export interface PowChallenge {
  challenge: string;
  difficulty: number;
}

/** GET /api/v2/captcha — OpenAPI: `site_key` (не `public_key`). */
export interface CaptchaInfo {
  provider: string;
  site_key: string;
}

// ─── Generic success ──────────────────────────────────────────────────────────

export interface SuccessResponse {
  success: boolean;
  message?: string;
}
