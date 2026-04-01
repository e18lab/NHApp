/**
 * nhentai API v2 — Current user (me)
 *
 * GET    /api/v2/user             Get own profile (private fields)
 * PUT    /api/v2/user             Update profile
 * DELETE /api/v2/user             Delete account
 * POST   /api/v2/user/avatar      Upload avatar (multipart/form-data)
 * GET    /api/v2/user/keys        List API keys
 * POST   /api/v2/user/keys        Create API key
 * DELETE /api/v2/user/keys/:id    Revoke API key
 *
 * Auth: User Token required for all endpoints
 */

import { Platform } from "react-native";
import { ApiError, loadAccessToken, nhApi, resolveUrl } from "./client";
import type { ApiKey, Me, SuccessResponse } from "./types";

// ─── Profile ──────────────────────────────────────────────────────────────────

let getMeInflight: Promise<Me> | null = null;

/** GET /user — параллельные вызовы (старт + SideMenu + хуки) делят один запрос. */
export async function getMe(): Promise<Me> {
  if (!getMeInflight) {
    getMeInflight = nhApi.get<Me>("/user").finally(() => {
      getMeInflight = null;
    });
  }
  return getMeInflight;
}

export interface UpdateProfileParams {
  username?: string;
  email?: string;
  about?: string;
  favorite_tags?: string;
  current_password?: string;
  new_password?: string;
  remove_avatar?: boolean;
}

export async function updateProfile(
  params: UpdateProfileParams
): Promise<SuccessResponse & { username: string; email: string; avatar_url: string }> {
  return nhApi.put("/user", params);
}

export async function deleteAccount(): Promise<SuccessResponse> {
  return nhApi.delete("/user");
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

/**
 * Upload a new avatar image.
 * @param formData FormData with an "avatar" file field attached.
 */
export async function uploadAvatar(
  formData: FormData
): Promise<SuccessResponse & { avatar_url: string }> {
  const url = resolveUrl("/user/avatar");
  const token = await loadAccessToken();

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `User ${token}`;
  // Do NOT set Content-Type — browser sets it with multipart boundary automatically
  const isElectron =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    !!(window as any).electron?.isElectron &&
    typeof (window as any).electron?.fetchJson === "function";

  // In Electron renderer, direct fetch to nhentai.net is CORS-blocked.
  // Use IPC bridge and send a real multipart body.
  const buildMultipartBody = async () => {
    const boundary = `----nhappform${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
    const enc = new TextEncoder();
    const chunks: Uint8Array[] = [];

    const entries: any[] =
      typeof (formData as any).entries === "function"
        ? Array.from((formData as any).entries())
        : [];

    for (const [name, value] of entries) {
      if (value instanceof Blob) {
        const filename = (value as any).name || "avatar.jpg";
        const contentType = value.type || "application/octet-stream";
        chunks.push(
          enc.encode(
            `--${boundary}\r\n` +
              `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
              `Content-Type: ${contentType}\r\n\r\n`
          )
        );
        chunks.push(new Uint8Array(await value.arrayBuffer()));
        chunks.push(enc.encode("\r\n"));
      } else {
        chunks.push(
          enc.encode(
            `--${boundary}\r\n` +
              `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
              `${String(value)}\r\n`
          )
        );
      }
    }
    chunks.push(enc.encode(`--${boundary}--\r\n`));

    const totalLen = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const out = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return { boundary, body: out.buffer };
  };

  let res: Response;
  let data: any = null;
  if (isElectron) {
    const { boundary, body } = await buildMultipartBody();
    const result = await (window as any).electron.fetchJson(url, {
      method: "POST",
      headers: {
        ...headers,
        Accept: "application/json",
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    const responseHeaders = new Headers(result.headers || {});
    res = new Response(result.body ?? "", {
      status: result.status ?? (result.success ? 200 : 500),
      headers: responseHeaders,
    });
    data = await res.json().catch(() => null);
  } else {
    res = await fetch(url, { method: "POST", headers, body: formData });
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    throw new ApiError(
      data?.detail || data?.message || `HTTP ${res.status}`,
      res.status,
      data
    );
  }
  return data;
}

// ─── API keys ─────────────────────────────────────────────────────────────────

export async function listApiKeys(): Promise<ApiKey[]> {
  return nhApi.get("/user/keys");
}

export async function createApiKey(
  name: string
): Promise<ApiKey & { key: string }> {
  return nhApi.post("/user/keys", { name });
}

export async function revokeApiKey(keyId: string): Promise<SuccessResponse> {
  return nhApi.delete(`/user/keys/${keyId}`);
}
