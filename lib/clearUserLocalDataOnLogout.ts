/**
 * Clears local nhentai-related data when the user logs out so another account
 * does not inherit favorites, history, recommendations, etc.
 */
import { notifyStorageApplied } from "@/api/nhappApi/cloudStorage";
import { disconnectLobby } from "@/api/nhappApi/lobbyStorage";
import { resetRecommendationStateForNewUser } from "@/api/nhappApi/recommendations";
import { READ_HISTORY_KEY } from "@/components/BookListHistory";
import { FAV_KEY, FAV_KEY_LEGACY } from "@/components/tags/helpers";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS: string[] = [
  "bookFavorites",
  "bookFavoritesOnline.v1",
  READ_HISTORY_KEY,
  "searchHistory",
  FAV_KEY,
  FAV_KEY_LEGACY,
  "globalTagFilter.v3",
  "@online.imported.cache",
  "@online.pendingFavorites.queue",
  "tagRecents.v1",
  "tagCollections.v1",
  "comments.cache",
  "profile.me",
  "nh.me",
];

export async function clearUserLocalDataOnLogout(): Promise<void> {
  try {
    disconnectLobby();
  } catch {
    /* noop */
  }

  try {
    resetRecommendationStateForNewUser();
  } catch {
    /* noop */
  }

  try {
    await AsyncStorage.multiRemove(KEYS);
  } catch {
    /* noop */
  }

  try {
    notifyStorageApplied();
  } catch {
    /* noop */
  }
}
