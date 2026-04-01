/**
 * nhentai API v2
 *
 * Usage:
 *   import { login, getGallery, searchGalleries } from "@/api/v2";
 *
 * Auth flow:
 *   1. const pow = await getPowChallenge("login");
 *   2. const nonce = await solvePoW(pow.challenge, pow.difficulty);
 *   3. const tokens = await login({ username, password, pow_challenge: pow.challenge, pow_nonce: nonce });
 *   // access_token + refresh_token are stored automatically in AsyncStorage
 *   // All subsequent authenticated calls attach Bearer token automatically
 *   // Token is refreshed automatically on 401
 */

// Client + errors
export { nhApi, ApiError, hasSession, clearTokens, storeTokens } from "./client";
export type { RequestOptions } from "./client";

// Types
export type {
  AuthTokens,
  UserLite,
  Me,
  Session,
  ApiKey,
  Tag,
  TagShort,
  TagType,
  SortOrder,
  Gallery,
  GalleryCard,
  GalleryImage,
  GalleryPage,
  GalleryPageResponse,
  GalleryPagesResponse,
  GalleryRelated,
  Paginated,
  Comment,
  Blacklist,
  CdnConfig,
  AppSiteConfig,
  PowChallenge,
  CaptchaInfo,
  SuccessResponse,
  UserProfile,
} from "./types";

// Auth
export {
  login,
  register,
  refresh,
  logout,
  logoutAll,
  getSessions,
  revokeSession,
  requestPasswordReset,
  confirmPasswordReset,
} from "./auth";
export type {
  LoginParams,
  RegisterParams,
  ConfirmResetParams,
  RequestPasswordResetParams,
} from "./auth";

// Galleries
export {
  getGalleries,
  getPopularGalleries,
  getRandomGalleryId,
  getGalleriesByTag,
  getGallery,
  getGalleryPages,
  getGalleryPage,
  getRelatedGalleries,
  isFavorited,
  addFavorite,
  removeFavorite,
  submitGalleryEdit,
} from "./galleries";
export type { GalleryListParams, GalleryByTagParams, GetGalleryParams, GalleryInclude, GalleryEditParams } from "./galleries";

// Search
export { searchGalleries } from "./search";
export type { SearchParams } from "./search";

// Browse (search vs tagged by single tag)
export {
  fetchGalleryBrowsePaginated,
  fetchGalleryBrowseSlice,
  totalFromPaginated,
  tryResolveSingleTagBrowseId,
} from "./galleryBrowse";
export type {
  BrowseSliceResult,
  FetchGalleryBrowseParams,
  GalleryBrowseFilter,
} from "./galleryBrowse";

// Favorites
export { getFavorites, getRandomFavoriteId } from "./favorites";
export type { FavoritesParams } from "./favorites";

// Blacklist
export { getBlacklist, getBlacklistIds, updateBlacklist } from "./blacklist";
export type { UpdateBlacklistParams } from "./blacklist";

// Comments
export {
  getGalleryComments,
  getCommentCount,
  postComment,
  deleteComment,
  flagComment,
} from "./comments";
export type { PostCommentParams } from "./comments";

// Tags
export { getTagsByType, getTagBySlug, autocompleteTags } from "./tags";
export type { GetTagsParams, AutocompleteParams } from "./tags";

// User (me)
export {
  getMe,
  updateProfile,
  deleteAccount,
  uploadAvatar,
  listApiKeys,
  createApiKey,
  revokeApiKey,
} from "./user";
export type { UpdateProfileParams } from "./user";

// Users (public profiles)
export { getUserProfile } from "./users";

// Config / infrastructure
export {
  getApiRoot,
  getCdnConfig,
  getPowChallenge,
  getCaptchaInfo,
  getSiteConfig,
  solvePoW,
  initCdn,
  resolveThumbUrl,
  resolveImageUrl,
} from "./config";
