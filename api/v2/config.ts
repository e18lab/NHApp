/**
 * nhentai API v2 — Configuration / infrastructure
 *
 * GET /api/v2          API root (version info)
 * GET /api/v2/cdn      Legacy CDN list (optional fallback)
 * GET /api/v2/config   CDN hostnames (i1–i4, t1–t4) + announcement — primary for media URLs
 * GET /api/v2/pow      Proof-of-Work challenge (required for login/comment/register)
 * GET /api/v2/captcha  Captcha provider info
 */

import * as ExpoCrypto from "expo-crypto";
import { nhApi, buildQuery } from "./client";
import type { AppSiteConfig, CaptchaInfo, CdnConfig, PowChallenge } from "./types";

/** API root — returns version string and status message. */
export async function getApiRoot(): Promise<{ version: string; message: string }> {
  // path is empty → hits /api/v2
  return nhApi.get("", { public: true });
}

/** Get CDN server list. Cache this — it rarely changes. */
export async function getCdnConfig(): Promise<CdnConfig> {
  return nhApi.get("/cdn", { public: true });
}

// ─── CDN URL resolver ─────────────────────────────────────────────────────────

/** v2 CDN uses numbered hosts (see GET /config); bare i./t. often fail for app requests. */
const FALLBACK_THUMB = "https://t1.nhentai.net";
const FALLBACK_IMAGE = "https://i1.nhentai.net";

/** Дефолт до initCdn — тот же набор, что в /api/v2/config `thumb_servers`. */
const DEFAULT_THUMB_SERVERS: string[] = [
  "https://t1.nhentai.net",
  "https://t2.nhentai.net",
  "https://t3.nhentai.net",
  "https://t4.nhentai.net",
];

let _thumbServer: string = FALLBACK_THUMB;
let _imageServer: string = FALLBACK_IMAGE;
/** Все thumb-хосты для перебора обложек (t1–t4). */
let _thumbServers: string[] = [...DEFAULT_THUMB_SERVERS];
let _cdnInitialized = false;
let _cdnInitPromise: Promise<void> | null = null;

async function loadCdnServers(): Promise<CdnConfig | null> {
  try {
    const cfg = await nhApi.get<AppSiteConfig>("/config", { public: true });
    if (
      Array.isArray(cfg.image_servers) &&
      cfg.image_servers.length > 0 &&
      Array.isArray(cfg.thumb_servers) &&
      cfg.thumb_servers.length > 0
    ) {
      return {
        image_servers: cfg.image_servers,
        thumb_servers: cfg.thumb_servers,
      };
    }
  } catch {
    /* fall through */
  }
  try {
    return await getCdnConfig();
  } catch {
    return null;
  }
}

/**
 * Pre-fetch CDN hosts from GET /config (primary), else /cdn, else i1/t1 defaults.
 * Concurrent callers share one in-flight request.
 */
export async function initCdn(): Promise<void> {
  if (_cdnInitialized) return;
  if (!_cdnInitPromise) {
    _cdnInitPromise = (async () => {
      try {
        const cfg = await loadCdnServers();
        if (cfg?.thumb_servers?.length) {
          _thumbServers = cfg.thumb_servers.map((s) => String(s).replace(/\/$/, ""));
          _thumbServer = _thumbServers[0];
        } else {
          _thumbServers = [...DEFAULT_THUMB_SERVERS];
          _thumbServer = _thumbServers[0];
        }
        if (cfg?.image_servers?.[0]) {
          _imageServer = cfg.image_servers[0].replace(/\/$/, "");
        }
      } catch {
        /* keep FALLBACK_* */
        _thumbServers = [...DEFAULT_THUMB_SERVERS];
        _thumbServer = _thumbServers[0];
      } finally {
        _cdnInitialized = true;
        _cdnInitPromise = null;
      }
    })();
  }
  await _cdnInitPromise;
}

/** Список `thumb_servers` (после initCdn — из API, иначе t1–t4). Для перебора зеркал обложек. */
export function getThumbServerList(): string[] {
  return _thumbServers.length > 0 ? [..._thumbServers] : [...DEFAULT_THUMB_SERVERS];
}

/**
 * v2 sometimes returns duplicate ".webp" (e.g. `cover.webp.webp`, `3t.webp.webp`).
 * CDN serves a single `.webp` — collapse chains of `.webp.webp` at end of path.
 */
export function normalizeV2MediaPath(path: string): string {
  if (!path) return path;
  let p = path.trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      let pathname = u.pathname;
      while (/\.webp\.webp$/i.test(pathname)) {
        pathname = pathname.replace(/\.webp\.webp$/i, ".webp");
      }
      u.pathname = pathname;
      return u.toString();
    } catch {
      let s = p;
      while (/\.webp\.webp$/i.test(s)) {
        s = s.replace(/\.webp\.webp$/i, ".webp");
      }
      return s;
    }
  }
  while (/\.webp\.webp$/i.test(p)) {
    p = p.replace(/\.webp\.webp$/i, ".webp");
  }
  return p;
}

function rewriteLegacyImageHost(absUrl: string): string {
  return absUrl.replace(/^https?:\/\/i\.nhentai\.net(?=\/|$)/i, _imageServer);
}

function rewriteLegacyThumbHost(absUrl: string): string {
  return absUrl.replace(/^https?:\/\/t\.nhentai\.net(?=\/|$)/i, _thumbServer);
}

/**
 * Build a full thumbnail URL from a path returned by the API.
 * Path examples: "/galleries/123456/thumb.jpg"  or full "https://…"
 */
export function resolveThumbUrl(path: string): string {
  if (!path) return "";
  const p = normalizeV2MediaPath(path);
  if (/^https?:\/\//.test(p)) return rewriteLegacyThumbHost(p);
  return _thumbServer + (p.startsWith("/") ? p : "/" + p);
}

/**
 * Build a full image URL from a path returned by the API.
 */
export function resolveImageUrl(path: string): string {
  if (!path) return "";
  const p = normalizeV2MediaPath(path);
  if (/^https?:\/\//.test(p)) return rewriteLegacyImageHost(p);
  return _imageServer + (p.startsWith("/") ? p : "/" + p);
}

/**
 * Get a Proof-of-Work challenge.
 * @param action  "login" | "comment" | "register" — difficulty varies per action
 */
export async function getPowChallenge(
  action?: string
): Promise<PowChallenge> {
  return nhApi.get(`/pow${buildQuery({ action })}`, { public: true });
}

/** Get captcha provider and site key (API field name: `site_key`). */
export async function getCaptchaInfo(): Promise<CaptchaInfo> {
  const raw = await nhApi.get<{
    provider?: string;
    site_key?: string;
    public_key?: string;
  }>("/captcha", { public: true });
  const site_key = (raw.site_key ?? raw.public_key ?? "").trim();
  return {
    provider: raw.provider ?? "turnstile",
    site_key,
  };
}

/** Site config: CDN lists, announcement, etc. */
export async function getSiteConfig(): Promise<AppSiteConfig> {
  return nhApi.get("/config", { public: true });
}

// ─── PoW solver helper ────────────────────────────────────────────────────────

/**
 * Solve a Proof-of-Work challenge.
 * Uses synchronous pure-JS SHA-256 to avoid per-iteration bridge/async overhead.
 * Yields to the JS event loop every BATCH iterations to keep UI responsive.
 */
export async function solvePoW(
  challenge: string,
  difficulty: number
): Promise<string> {
  const BATCH = 2_000;
  let nonce = 0;

  while (true) {
    // Run a batch of iterations synchronously (no async overhead per hash)
    const end = nonce + BATCH;
    while (nonce < end) {
      const hash = sha256SyncHex(challenge + nonce.toString());
      if (hashMeetsDifficulty(hash, difficulty)) {
        return nonce.toString();
      }
      nonce++;
    }
    // Yield to event loop between batches so UI stays responsive
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}

/** Pure-JS synchronous SHA-256, returns lowercase hex string. */
function sha256SyncHex(message: string): string {
  // SHA-256 constants
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  // UTF-8 encode
  const bytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const c = message.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }

  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // Append 64-bit big-endian bit length (only lower 32 bits needed for typical inputs)
  bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Int32Array(64);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) |
              (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((w[t-15] >>> 7) | (w[t-15] << 25)) ^ ((w[t-15] >>> 18) | (w[t-15] << 14)) ^ (w[t-15] >>> 3);
      const s1 = ((w[t-2] >>> 17) | (w[t-2] << 15)) ^ ((w[t-2] >>> 19) | (w[t-2] << 13)) ^ (w[t-2] >>> 10);
      w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const tmp1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const tmp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + tmp1) | 0;
      d = c; c = b; b = a; a = (tmp1 + tmp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => (v >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

function hashMeetsDifficulty(hex: string, difficulty: number): boolean {
  const zeroBits = Math.floor(difficulty / 4);
  const remainder = difficulty % 4;
  const prefix = "0".repeat(zeroBits);
  if (!hex.startsWith(prefix)) return false;
  if (remainder === 0) return true;
  const nextNibble = parseInt(hex[zeroBits], 16);
  return nextNibble < Math.pow(2, 4 - remainder);
}
