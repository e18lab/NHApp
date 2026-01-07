// api/comments.ts
import {
  cookieHeaderString, // вернёт "" на нативе, чтобы не перетирать HttpOnly
  loadTokens, // достанем актуальный csrftoken
  syncNativeCookiesFromJar,
} from "@/api/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const NH_HOST = "https://nhentai.net";

// Proxy URL for web version to bypass CORS
const PROXY_BASE = Platform.OS === "web" 
  ? (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3002") + "/fpi"
  : null;

// Helper to get proxied URL on web
function getProxiedUrl(url: string): string {
  if (Platform.OS === "web" && PROXY_BASE && url.startsWith("https://nhentai.net")) {
    return url.replace("https://nhentai.net", `${PROXY_BASE}/nhentai`);
  }
  return url;
}

// ===== Типы =====
export interface ApiUserLite {
  id: number;
  username: string;
  slug?: string;
  avatar_url?: string;
}
export interface ApiComment {
  id: number;
  gallery_id: number;
  body: string;
  post_date: number; // unix (sec)
  poster: ApiUserLite;
}

// ===== Куки =====
type AuthCookies = {
  csrftoken?: string;
  sessionid?: string;
  cf_clearance?: string;
};

export class CaptchaRequiredError extends Error {
  captchaPublicKey: string;
  constructor(key: string, msg = "Captcha required") {
    super(msg);
    this.name = "CaptchaRequired";
    this.captchaPublicKey = key;
  }
}

async function getAuthCookies(): Promise<AuthCookies> {
  const [csrf, sess, cfc] = await AsyncStorage.multiGet([
    "nh.csrf",
    "nh.session",
    "nh.cf_clearance",
  ]).then((arr) => arr.map(([, v]) => v || undefined));
  return { csrftoken: csrf, sessionid: sess, cf_clearance: cfc };
}

function buildCookieHeader(c: AuthCookies) {
  const parts: string[] = [];
  if (c.csrftoken) parts.push(`csrftoken=${c.csrftoken}`);
  if (c.sessionid) parts.push(`sessionid=${c.sessionid}`);
  if (c.cf_clearance) parts.push(`cf_clearance=${c.cf_clearance}`);
  return parts.join("; ");
}

// Пытаемся достать CSRF из cookie (на web)
function getCsrfFromCookie(): string | undefined {
  try {
    // @ts-ignore
    const c: string =
      typeof document !== "undefined" ? document.cookie || "" : "";
    const m = c.match(/(?:^|;\\s*)csrftoken=([^;]+)/i);
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

/** Отправить комментарий */
export async function submitComment(
  galleryId: number,
  text: string,
  captchaToken?: string
): Promise<ApiComment> {
  let url = `${NH_HOST}/api/gallery/${galleryId}/comments/submit`;
  url = getProxiedUrl(url);

  const payload: Record<string, any> = { body: text };
  if (captchaToken) {
    payload.captcha = captchaToken;
    payload["cf-turnstile-response"] = captchaToken;
  }

  const cookies = await getAuthCookies();
  const cookieHeader = buildCookieHeader(cookies);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    Referer: `${NH_HOST}/g/${galleryId}/`,
    Origin: NH_HOST,
  };
  
  // On web, don't set User-Agent (browser doesn't allow it)
  if (Platform.OS !== "web") {
    headers["User-Agent"] =
      Platform.OS === "ios"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";
  }
  
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const csrf = cookies.csrftoken || getCsrfFromCookie();
  if (csrf) {
    headers["X-CSRFToken"] = csrf;
    headers["X-Csrftoken"] = csrf;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    return (await res.json()) as ApiComment;
  }

  const raw = await res.text();
  let j: any = null;
  try {
    j = raw ? JSON.parse(raw) : null;
  } catch {}

  if (res.status === 403) {
    const key =
      j?.captcha_public_key ||
      j?.captchaPublicKey ||
      raw.match(/captcha_public_key["']?\\s*:\\s*["']([^"']+)["']/i)?.[1] ||
      raw.match(/0x[0-9A-Za-z]{30,}/)?.[0];

    const msg =
      j?.error || j?.detail || "You need to solve a CAPTCHA to continue";
    if (key) throw new CaptchaRequiredError(String(key), msg);
    throw new Error(msg || "Forbidden");
  }

  if (
    /timeout|duplicate|invalid[-_\\s]?input|captcha/i.test(
      JSON.stringify(j ?? raw)
    )
  ) {
    throw new Error(
      j?.error ||
        j?.detail ||
        "Токен капчи истёк или уже использован. Подтвердите капчу ещё раз."
    );
  }

  throw new Error(j?.error || j?.detail || raw || `HTTP ${res.status}`);
}

function commonHeaders(opts: {
  cookie: string;
  referer: string;
  csrf?: string; // если хочешь явно слать
}) {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    Origin: NH_HOST,
    Referer: opts.referer,
    Cookie: opts.cookie,
  };
  
  // On web, don't set User-Agent (browser doesn't allow it)
  if (Platform.OS !== "web") {
    h["User-Agent"] =
      Platform.OS === "ios"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";
  }
  
  if (opts.csrf) h["X-CSRFToken"] = opts.csrf; // должно совпадать с cookie csrftoken
  return h;
}

export async function deleteComment(
  commentId: number
): Promise<{ success: boolean }> {
  const cookies = await getAuthCookies();
  const cookieHeader = buildCookieHeader(cookies);

  let url = `${NH_HOST}/api/comments/${commentId}/delete`;
  url = getProxiedUrl(url);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...commonHeaders({
        cookie: cookieHeader,
        referer: `${NH_HOST}/`,
        csrf: cookies.csrftoken,
      }),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!res.ok) {
    throw new Error(
      `Delete failed: ${res.status} ${res.statusText}. ${text.slice(0, 400)}`
    );
  }
  return (json ?? { success: true }) as { success: boolean };
}

export async function deleteCommentById(
  commentId: number,
  opts?: { galleryId?: number }
): Promise<{ success: boolean }> {
  let url = `${NH_HOST}/api/comments/${commentId}/delete`;

  const buildHeaders = async () => {
    const cookieHeader = await cookieHeaderString(); // "" на нативе, строка на Expo/web
    const { csrftoken } = await loadTokens();

    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Origin: NH_HOST,
      Referer: opts?.galleryId ? `${NH_HOST}/g/${opts.galleryId}/` : `${NH_HOST}/`,
    };
    
    // On web, don't set User-Agent (browser doesn't allow it)
    if (Platform.OS !== "web") {
      headers["User-Agent"] =
        Platform.OS === "ios"
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
          : "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";
    }
    
    if (cookieHeader) headers["Cookie"] = cookieHeader;
    if (csrftoken) {
      headers["X-CSRFToken"] = csrftoken;   // должен совпадать с кукой csrftoken
      headers["X-Csrftoken"] = csrftoken;   // на всякий
    }
    return headers;
  };

  const tryOnce = async () => {
    let finalUrl = url;
    finalUrl = getProxiedUrl(finalUrl);
    const res = await fetch(finalUrl, { method: "POST", headers: await buildHeaders() });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`Delete failed: ${res.status} ${res.statusText} ${text.slice(0, 400)}`);
      // @ts-ignore
      err.body = text;
      throw err;
    }
    return text ? JSON.parse(text) : { success: true };
  };

  try {
    return await tryOnce();
  } catch (e: any) {
    const msg = String(e?.body || e?.message || "");
    // Cloudflare/CSRF? Синхронизируем нативные куки и повторяем один раз
    if (/403|csrf|cloudflare|1020|access was denied/i.test(msg)) {
      try { await syncNativeCookiesFromJar(); } catch {}
      return await tryOnce();
    }
    throw e;
  }
}