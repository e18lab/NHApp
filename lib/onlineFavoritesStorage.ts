/**
 * Онлайн-избранное (nhentai API v2 / legacy POST favorite) — дублируем id в AsyncStorage
 * под ключом bookFavoritesOnline.v1, чтобы при синхронизации storage_json на сервере
 * можно было строить персональные рекомендации.
 */
import { requestStoragePush } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ONLINE_FAVORITES_STORAGE_KEY = "bookFavoritesOnline.v1";

export async function readOnlineFavoriteIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(ONLINE_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return [
      ...new Set(
        arr.filter((x): x is number => typeof x === "number" && Number.isFinite(x))
      ),
    ];
  } catch {
    return [];
  }
}

async function writeIds(ids: number[]): Promise<void> {
  const sorted = [...new Set(ids.filter((x) => Number.isFinite(x)))].sort(
    (a, b) => a - b
  );
  await AsyncStorage.setItem(
    ONLINE_FAVORITES_STORAGE_KEY,
    JSON.stringify(sorted)
  );
  requestStoragePush();
}

/** Добавить id (после успешного add favorite на сервере). */
export async function addOnlineFavoriteIds(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const cur = await readOnlineFavoriteIds();
  await writeIds([...cur, ...ids]);
}

/** Убрать id (после успешного remove favorite на сервере). */
export async function removeOnlineFavoriteIds(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const rm = new Set(ids);
  const cur = await readOnlineFavoriteIds();
  await writeIds(cur.filter((id) => !rm.has(id)));
}

/** Объединить с набором с сервера/экрана (например после загрузки страницы онлайн-избранного). */
export async function mergeOnlineFavoriteIds(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const cur = await readOnlineFavoriteIds();
  await writeIds([...cur, ...ids]);
}

/**
 * Полная замена снимка с API (после полного обхода страниц).
 * Если набор совпадает с локальным — не пишем и не пушим в облако.
 */
export async function replaceOnlineFavoritesSnapshotIfDirty(
  ids: number[]
): Promise<boolean> {
  const sorted = [...new Set(ids.filter((x) => Number.isFinite(x)))].sort(
    (a, b) => a - b
  );
  const cur = await readOnlineFavoriteIds();
  if (
    cur.length === sorted.length &&
    cur.every((v, i) => v === sorted[i])
  ) {
    return false;
  }
  await AsyncStorage.setItem(
    ONLINE_FAVORITES_STORAGE_KEY,
    JSON.stringify(sorted)
  );
  requestStoragePush();
  return true;
}
