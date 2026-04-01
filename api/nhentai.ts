/**
 * @deprecated
 * This file is a legacy shim — all types have moved to @/api/nhappApi/types,
 * loadBookFromLocal has moved to @/api/nhappApi/localBook,
 * and API calls have moved to @/api/v2/*.
 *
 * Do not add new imports here. Import directly from the new locations.
 */

export type {
  Tag,
  BookPage,
  Book,
  ApiUser,
  GalleryComment,
  Paged,
  TagFilter,
} from "@/api/nhappApi/types";

export { loadBookFromLocal } from "@/api/nhappApi/localBook";
