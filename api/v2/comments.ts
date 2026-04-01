/**
 * nhentai API v2 — Comments
 *
 * GET    /api/v2/galleries/:id/comments        All comments for a gallery
 * GET    /api/v2/galleries/:id/comments/count  Comment count
 * POST   /api/v2/galleries/:id/comments        Post a comment (auth required)
 * DELETE /api/v2/comments/:id                  Delete comment (owner or staff)
 * POST   /api/v2/comments/:id/flag             Flag comment for review
 *
 * Protections on POST:
 *   - PoW: GET /api/v2/pow?action=comment
 *   - Captcha: GET /api/v2/captcha
 */

import { nhApi } from "./client";
import type { Comment, Paginated, SuccessResponse } from "./types";

function normalizeCommentList(raw: unknown): Comment[] {
  if (Array.isArray(raw)) return raw as Comment[];
  if (raw && typeof raw === "object" && Array.isArray((raw as Paginated<Comment>).result)) {
    return (raw as Paginated<Comment>).result;
  }
  return [];
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function getGalleryComments(galleryId: number): Promise<Comment[]> {
  const raw = await nhApi.get<unknown>(`/galleries/${galleryId}/comments`, {
    public: true,
  });
  return normalizeCommentList(raw);
}

export async function getCommentCount(
  galleryId: number
): Promise<{ count: number }> {
  return nhApi.get(`/galleries/${galleryId}/comments/count`, { public: true });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface PostCommentParams {
  body: string;
  /** PoW challenge from GET /api/v2/pow?action=comment */
  pow_challenge: string;
  pow_nonce: string;
  /** Captcha response token */
  captcha_response?: string;
}

export async function postComment(
  galleryId: number,
  params: PostCommentParams
): Promise<Comment> {
  return nhApi.post(`/galleries/${galleryId}/comments`, params);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteComment(
  commentId: number
): Promise<SuccessResponse> {
  return nhApi.delete(`/comments/${commentId}`);
}

// ─── Flag ─────────────────────────────────────────────────────────────────────

export async function flagComment(
  commentId: number,
  reason: string
): Promise<SuccessResponse> {
  return nhApi.post(`/comments/${commentId}/flag`, { reason });
}
