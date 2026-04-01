import { requestStoragePush } from "@/api/nhappApi/cloudStorage";
import { bulkAddFavoritesV2 } from "@/lib/onlineFavoritesBulk";
import { addOnlineFavoriteIds } from "@/lib/onlineFavoritesStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
const K_LOCAL_FAV = "bookFavorites";
const K_IMPORTED_CACHE = "@online.imported.cache";
const K_PENDING_QUEUE = "@online.pendingFavorites.queue";
const BATCH_SIZE = 50;
let syncLock = false;
async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
async function writeJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    requestStoragePush();
  } catch {}
}
async function getLocalFavoriteIds(): Promise<number[]> {
  const arr = await readJson<number[]>(K_LOCAL_FAV, []);
  return Array.from(new Set(arr.filter((x) => Number.isFinite(x))));
}
async function getImportedCache(): Promise<Set<number>> {
  const arr = await readJson<number[]>(K_IMPORTED_CACHE, []);
  return new Set(arr);
}
async function setImportedCache(cacheSet: Set<number>): Promise<void> {
  await writeJson(K_IMPORTED_CACHE, Array.from(cacheSet));
}
async function getPending(): Promise<Set<number>> {
  const arr = await readJson<number[]>(K_PENDING_QUEUE, []);
  return new Set(arr);
}
async function setPending(setIds: Set<number>): Promise<void> {
  await writeJson(K_PENDING_QUEUE, Array.from(setIds));
}
async function enqueueNewFavorites(newIds: number[]) {
  if (!newIds.length) return;
  const pending = await getPending();
  let changed = false;
  for (const id of newIds) {
    if (!pending.has(id)) {
      pending.add(id);
      changed = true;
    }
  }
  if (changed) await setPending(pending);
}
async function flushPendingBatches(): Promise<{ sent: number }> {
  const pending = await getPending();
  if (!pending.size) return { sent: 0 };
  const cache = await getImportedCache();
  const ids = Array.from(pending);
  let sent = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    try {
      const { failed } = await bulkAddFavoritesV2(chunk);
      const ok = chunk.filter((id) => !failed.includes(id));
      ok.forEach((id) => {
        cache.add(id);
        pending.delete(id);
      });
      sent += ok.length;
      await setImportedCache(cache);
      await setPending(pending);
      await addOnlineFavoriteIds(ok);
    } catch {
      break;
    }
  }
  return { sent };
}
export async function autoImportSyncOnce(): Promise<{
  discovered: number;
  sent: number;
}> {
  if (syncLock) return { discovered: 0, sent: 0 };
  syncLock = true;
  try {
    const [local, cache, pending] = await Promise.all([
      getLocalFavoriteIds(),
      getImportedCache(),
      getPending(),
    ]);
    const additions = local.filter((id) => !cache.has(id) && !pending.has(id));
    if (additions.length) {
      await enqueueNewFavorites(additions);
    }
    const { sent } = await flushPendingBatches();
    return { discovered: additions.length, sent };
  } finally {
    syncLock = false;
  }
}
export function startForegroundPolling(pollMs = 1000) {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  async function tick() {
    if (stopped) return;
    try {
      await autoImportSyncOnce();
    } catch {}
  }
  timer = setInterval(tick, Math.max(500, pollMs));
  tick();
  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}
