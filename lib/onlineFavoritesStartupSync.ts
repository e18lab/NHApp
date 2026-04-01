/**
 * При старте (сессия есть): обходим все страницы GET /favorites.
 * Если полный набор id совпадает с bookFavoritesOnline.v1 — дальше не качаем и ничего не пишем.
 */
import { getFavorites } from "@/api/v2";
import { getAuthStorageReady, hasSession } from "@/api/v2/client";
import {
  readOnlineFavoriteIds,
  replaceOnlineFavoritesSnapshotIfDirty,
} from "@/lib/onlineFavoritesStorage";

const PER_PAGE = 100;

let syncRunning = false;

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

export async function syncOnlineFavoritesFullOnLaunch(): Promise<void> {
  if (syncRunning) return;
  syncRunning = true;
  try {
    await getAuthStorageReady();
    if (!(await hasSession())) return;

    const localSet = new Set(await readOnlineFavoriteIds());
    const collected = new Set<number>();
    let page = 1;
    let numPages = 1;
    let total = 0;

    for (;;) {
      const res = await getFavorites({ page, per_page: PER_PAGE });
      total = res.total ?? 0;
      numPages = Math.max(1, res.num_pages ?? 1);

      for (const c of res.result ?? []) {
        if (typeof c.id === "number" && Number.isFinite(c.id)) {
          collected.add(c.id);
        }
      }

      if (collected.size === total) {
        if (setsEqual(collected, localSet)) {
          return;
        }
        await replaceOnlineFavoritesSnapshotIfDirty([...collected]);
        return;
      }

      if (page >= numPages) {
        if (collected.size !== total) {
          console.warn(
            "[onlineFavorites] startup sync: incomplete list",
            collected.size,
            "/",
            total
          );
        }
        if (setsEqual(collected, localSet)) {
          return;
        }
        await replaceOnlineFavoritesSnapshotIfDirty([...collected]);
        return;
      }

      page += 1;
      await new Promise((r) => setTimeout(r, 80));
    }
  } catch (e) {
    console.warn("[onlineFavorites] startup sync failed:", e);
  } finally {
    syncRunning = false;
  }
}
