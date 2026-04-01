/**
 * nhentai API v2 — Auth
 *
 * POST /api/v2/auth/login          Login with username/password
 * POST /api/v2/auth/register       Create new account
 * POST /api/v2/auth/refresh        Rotate tokens
 * POST /api/v2/auth/logout         Revoke refresh token
 * POST /api/v2/auth/logout/all     Revoke all sessions
 * GET  /api/v2/auth/sessions       List active sessions
 * DELETE /api/v2/auth/sessions/:id Revoke specific session
 * POST /api/v2/auth/reset          Request password reset email
 * POST /api/v2/auth/reset/confirm  Confirm password reset with token
 */

import { clearUserLocalDataOnLogout } from "@/lib/clearUserLocalDataOnLogout";
import { nhApi, storeTokens, clearTokens, loadRefreshToken } from "./client";
import type { AuthTokens, Session, SuccessResponse } from "./types";

// ─── Login ────────────────────────────────────────────────────────────────────

export interface LoginParams {
  username: string;
  password: string;
  /** PoW challenge from GET /api/v2/pow?action=login */
  pow_challenge: string;
  pow_nonce: string;
  /** Captcha response token */
  captcha_response?: string;
}

export async function login(params: LoginParams): Promise<AuthTokens> {
  const result = await nhApi.post<AuthTokens>("/auth/login", params, {
    public: true,
    skipRefresh: true,
  });
  await storeTokens(result.access_token, result.refresh_token);
  void import("@/lib/onlineFavoritesStartupSync").then((m) =>
    m.syncOnlineFavoritesFullOnLaunch()
  );
  return result;
}

// ─── Register ─────────────────────────────────────────────────────────────────

export interface RegisterParams {
  username: string;
  email: string;
  password: string;
  pow_challenge: string;
  pow_nonce: string;
  captcha_response?: string;
}

export async function register(params: RegisterParams): Promise<AuthTokens> {
  const result = await nhApi.post<AuthTokens>("/auth/register", params, {
    public: true,
    skipRefresh: true,
  });
  await storeTokens(result.access_token, result.refresh_token);
  void import("@/lib/onlineFavoritesStartupSync").then((m) =>
    m.syncOnlineFavoritesFullOnLaunch()
  );
  return result;
}

// ─── Token refresh ────────────────────────────────────────────────────────────

/** Called internally by client.ts on 401. Also useful to call manually. */
export async function refresh(refreshToken?: string): Promise<AuthTokens> {
  const token = refreshToken ?? (await loadRefreshToken());
  if (!token) throw new Error("No refresh token available");

  return nhApi.post<AuthTokens>(
    "/auth/refresh",
    { refresh_token: token },
    { public: true, skipRefresh: true }
  );
}

// ─── Logout ───────────────────────────────────────────────────────────────────

/** Revoke current session's refresh token and clear local storage. */
export async function logout(): Promise<void> {
  const refreshToken = await loadRefreshToken();
  if (refreshToken) {
    try {
      await nhApi.post<SuccessResponse>(
        "/auth/logout",
        { refresh_token: refreshToken },
        { skipRefresh: true }
      );
    } catch {
      // best-effort — clear locally regardless
    }
  }
  await clearTokens();
  await clearUserLocalDataOnLogout();
}

/** Revoke all sessions for this account. */
export async function logoutAll(): Promise<SuccessResponse> {
  const result = await nhApi.post<SuccessResponse>("/auth/logout/all", {});
  await clearTokens();
  await clearUserLocalDataOnLogout();
  return result;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getSessions(refreshToken?: string): Promise<Session[]> {
  const token = refreshToken ?? (await loadRefreshToken());
  return nhApi.get<Session[]>("/auth/sessions", {
    headers: token ? { "x-refresh-token": token } : undefined,
  });
}

export async function revokeSession(sessionId: string): Promise<SuccessResponse> {
  return nhApi.delete<SuccessResponse>(`/auth/sessions/${sessionId}`);
}

// ─── Password reset ───────────────────────────────────────────────────────────

export interface RequestPasswordResetParams {
  email: string;
  pow_challenge: string;
  pow_nonce: string;
  captcha_response?: string;
}

export async function requestPasswordReset(
  params: RequestPasswordResetParams
): Promise<SuccessResponse> {
  return nhApi.post<SuccessResponse>("/auth/reset", params, {
    public: true,
    skipRefresh: true,
  });
}

export interface ConfirmResetParams {
  token: string;
  new_password: string;
  pow_challenge: string;
  pow_nonce: string;
  captcha_response?: string;
}

export async function confirmPasswordReset(
  params: ConfirmResetParams
): Promise<SuccessResponse> {
  return nhApi.post<SuccessResponse>("/auth/reset/confirm", params, {
    public: true,
    skipRefresh: true,
  });
}
