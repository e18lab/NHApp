/**
 * nhentai API v2 — Blacklist
 *
 * GET  /api/v2/blacklist      Get blacklisted tags
 * GET  /api/v2/blacklist/ids  Get blacklisted tag IDs only
 * POST /api/v2/blacklist      Add or remove tags from blacklist
 *
 * Auth: User Token or API Key required
 */

import { nhApi } from "./client";
import type { Blacklist, SuccessResponse } from "./types";

export async function getBlacklist(): Promise<Blacklist> {
  return nhApi.get("/blacklist");
}

/** Returns only the numeric IDs — cheaper than fetching full tag objects. */
export async function getBlacklistIds(): Promise<number[]> {
  const res = await nhApi.get<{ ids: number[] }>("/blacklist/ids");
  return res.ids;
}

export interface UpdateBlacklistParams {
  /** Tag IDs to add to blacklist */
  added?: number[];
  /** Tag IDs to remove from blacklist */
  removed?: number[];
}

export async function updateBlacklist(
  params: UpdateBlacklistParams
): Promise<SuccessResponse & { count: number }> {
  return nhApi.post("/blacklist", {
    added: params.added ?? [],
    removed: params.removed ?? [],
  });
}
