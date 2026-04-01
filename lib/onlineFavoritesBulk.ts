/**
 * Bulk add favorites via nhentai API v2 (Bearer session).
 * Replaces legacy POST /api/gallery/:id/favorite (nhFetch + CSRF).
 */
import { addFavorite } from "@/api/v2";
import { getAuthStorageReady, hasSession } from "@/api/v2/client";

const DELAY_MS = 120;

export async function bulkAddFavoritesV2(
  ids: number[],
  onProgress?: (done: number, total: number) => void
): Promise<{ failed: number[] }> {
  await getAuthStorageReady();
  if (!(await hasSession())) {
    return { failed: [...ids] };
  }
  const failed: number[] = [];
  for (let i = 0; i < ids.length; i++) {
    try {
      await addFavorite(ids[i]);
    } catch {
      failed.push(ids[i]);
    }
    onProgress?.(i + 1, ids.length);
    if (i + 1 < ids.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  return { failed };
}
