/**
 * nhentai API v2 — Public user profiles
 *
 * GET /api/v2/users/:user_id/:slug
 *
 * Auth: Public (optional token for personalization)
 * Note: Both user_id and correct username slug are required.
 */

import { nhApi } from "./client";
import type { UserProfile } from "./types";

export async function getUserProfile(
  userId: number,
  slug: string
): Promise<UserProfile> {
  return nhApi.get(`/users/${userId}/${slug}`, {
    headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
  });
}
