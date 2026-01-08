import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Proxy URL for web version to bypass CORS
const PROXY_BASE = Platform.OS === "web" 
  ? (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3002") + "/fpi"
  : null;

export const NH_HOST = "https://nhentai.net";
export const LOGIN_URL = `${NH_HOST}/login/?next=/`;

// Helper to get proxied URL on web
function getProxiedUrl(path: string): string {
  // Для Electron не используем proxy - используем IPC
  const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;
  if (isElectron) {
    return path; // Возвращаем оригинальный URL, IPC обработает его
  }
  
  if (Platform.OS === "web" && PROXY_BASE && path.startsWith("https://nhentai.net")) {
    return path.replace("https://nhentai.net", `${PROXY_BASE}/nhentai`);
  }
  return path;
}

export type AuthTokens = {
  csrftoken?: string;
  /** sessionid чаще всего HttpOnly → из JS его не видно */
  sessionid?: string;
};

const STORAGE_KEY = "@auth.tokens.v1";

// Доп. ключи, которые мы сохраняли из WebView/скрейперов:
const EXTRA_AUTH_KEYS = ["nh.csrf", "nh.session", "nh.cf_clearance", "nh.me"];

const COOKIE_NAMES = [
  "csrftoken",
  "sessionid",
  "cf_clearance",
  "__cf_bm",
  "csrftoken_legacy",
];

// -------- CookieManager (лениво и безопасно для Expo Go) ----------
let CookieManager: any = null;
if (Constants.appOwnership !== "expo") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    CookieManager = require("@react-native" + "-cookies/cookies").default;
  } catch {}
}

export const hasNativeCookieJar = () => Boolean(CookieManager);

// --------- helpers ----------
function normalizeTokens(obj: any): AuthTokens {
  const rawCsrf =
    typeof obj?.csrftoken === "string" ? obj.csrftoken.trim() : "";
  const rawSess =
    typeof obj?.sessionid === "string" ? obj.sessionid.trim() : "";
  return {
    csrftoken: rawCsrf || undefined,
    sessionid: rawSess || undefined,
  };
}

export function buildCookieHeader(tokens: AuthTokens): string {
  const parts: string[] = [];
  if (tokens.csrftoken) parts.push(`csrftoken=${tokens.csrftoken}`);
  if (tokens.sessionid) parts.push(`sessionid=${tokens.sessionid}`);
  return parts.join("; ");
}

const HOST_VARIANTS = [
  "https://nhentai.net",
  "http://nhentai.net",
  "https://www.nhentai.net",
  "http://www.nhentai.net",
];
const DOMAIN_VARIANTS = [
  "nhentai.net",
  ".nhentai.net",
  "www.nhentai.net",
  ".www.nhentai.net",
];

async function applyTokensToNativeJar(tokens: AuthTokens): Promise<void> {
  if (!CookieManager) return;
  try {
    const ops: Promise<any>[] = [];
    for (const h of HOST_VARIANTS) {
      if (tokens.csrftoken) {
        ops.push(
          CookieManager.set(h, {
            name: "csrftoken",
            value: String(tokens.csrftoken),
            path: "/",
            secure: h.startsWith("https"),
            sameSite: "Lax",
          })
        );
      }
      // sessionid не пишем руками — сервер кладёт HttpOnly сам
    }
    await Promise.all(ops);
    if (Platform.OS === "android") await CookieManager.flush?.();
  } catch {}
}

// --------- storage ----------
export async function saveTokens(tokens: AuthTokens): Promise<void> {
  const prev = await loadTokens();
  const next = normalizeTokens({
    csrftoken: tokens.csrftoken ?? prev.csrftoken,
    sessionid: tokens.sessionid ?? prev.sessionid,
  });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  await applyTokensToNativeJar(next);
}

/** Всегда возвращает объект с ключами { csrftoken?, sessionid? } */
export async function loadTokens(): Promise<AuthTokens> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { csrftoken: undefined, sessionid: undefined };
    const parsed = JSON.parse(raw);
    return normalizeTokens(parsed);
  } catch {
    return { csrftoken: undefined, sessionid: undefined };
  }
}

/** Полная очистка наших токенов + всех доп. ключей, которые могли сохранить WebView/скрейперы */
export async function clearTokens(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([STORAGE_KEY, ...EXTRA_AUTH_KEYS]);
  } catch {
    // fallback: удалить по одному
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    for (const k of EXTRA_AUTH_KEYS)
      await AsyncStorage.removeItem(k).catch(() => {});
  }
}

export async function getCookieHeader(): Promise<string> {
  return buildCookieHeader(await loadTokens());
}

// --------- manual ----------
export async function setManualTokens(csrftoken?: string, sessionid?: string) {
  await saveTokens({ csrftoken, sessionid });
}

// --------- native jar sync ----------
function pickCookieValue(cookies: any, name: string): string | undefined {
  if (!cookies) return undefined;
  return cookies?.[name]?.value ?? cookies?.[name];
}

export async function syncNativeCookiesFromJar(): Promise<AuthTokens> {
  if (!CookieManager) return await loadTokens();

  if (Platform.OS === "android") {
    try {
      await CookieManager.flush?.();
    } catch {}
  }

  let found: AuthTokens = {};
  for (const h of HOST_VARIANTS) {
    try {
      const jar = await CookieManager.get(h);
      if (!found.csrftoken) found.csrftoken = pickCookieValue(jar, "csrftoken");
      if (!found.sessionid) found.sessionid = pickCookieValue(jar, "sessionid");
      if (found.csrftoken && found.sessionid) break;
    } catch {}
  }

  const next = normalizeTokens({ ...(await loadTokens()), ...found });
  await saveTokens(next);
  return next;
}

/**
 * Строка Cookie. В НАТИВНЫХ сборках НЕ подставляем вручную,
 * иначе затрём HttpOnly sessionid из системного джара.
 */
export async function cookieHeaderString(opts?: {
  preferNative?: boolean;
}): Promise<string> {
  const preferNative = opts?.preferNative ?? true;
  if (preferNative && hasNativeCookieJar()) return "";
  return buildCookieHeader(await loadTokens());
}

/** Чек авторизации */
export async function hasValidTokens(): Promise<boolean> {
  const t = await loadTokens();
  if (t.csrftoken && t.sessionid) return true;

  if (CookieManager) {
    try {
      if (Platform.OS === "android") await CookieManager.flush?.();
      for (const h of HOST_VARIANTS) {
        const jar = await CookieManager.get(h);
        const sess = pickCookieValue(jar, "sessionid");
        if (sess) return true;
      }
    } catch {}
  }
  return false;
}

// ---------- fetch helpers ----------
export type NHFetchInit = RequestInit & {
  csrf?: boolean;
  withAuth?: boolean;
  noCache?: boolean;
};

export async function nhFetch(
  path: string,
  init: NHFetchInit = {}
): Promise<Response> {
  // Для Electron используем IPC метод вместо fetch
  const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;
  
  console.log(`[nhFetch] Platform.OS: ${Platform.OS}, isElectron: ${isElectron}, path: ${path}`);
  
  if (isElectron) {
    const electron = (window as any).electron;
    if (!electron || !electron.fetchJson) {
      console.warn("[nhFetch] Electron detected but fetchJson not available, falling back to proxy");
      // Fallback to proxy if IPC method not available - continue to normal fetch below
    } else {
      // Используем IPC метод для Electron
      const urlBase = path.startsWith("http") ? path : `${NH_HOST}${path}`;
      let url =
        init.noCache === true
          ? `${urlBase}${urlBase.includes("?") ? "&" : "?"}ts=${Date.now()}`
          : urlBase;

      const withAuth = init.withAuth !== false;
      const tokens = await loadTokens();
      
      // Формируем заголовки
      const headers: Record<string, string> = {};
      
      if (withAuth) {
        const cookieHeader = await cookieHeaderString({ preferNative: false });
        if (cookieHeader) {
          headers["Cookie"] = cookieHeader;
        }
      }

      const needsCsrf =
        init.csrf === true ||
        (init.method && !/^(GET|HEAD)$/i.test(String(init.method))) ||
        false;

      if (needsCsrf && tokens.csrftoken) {
        headers["X-CSRFToken"] = tokens.csrftoken;
        headers["Referer"] = NH_HOST + "/";
      }

      // Добавляем пользовательские заголовки
      if (init.headers) {
        const customHeaders = new Headers(init.headers);
        customHeaders.forEach((value, key) => {
          headers[key] = value;
        });
      }

      // Используем IPC метод для запроса
      console.log(`[nhFetch] Using Electron IPC for: ${url}`);
      
      try {
        const result = await electron.fetchJson(url, {
          method: init.method || "GET",
          headers,
          body: init.body,
        });

        if (!result.success) {
          console.error(`[nhFetch] IPC request failed:`, result.error);
          // Создаём Response с ошибкой
          return new Response(JSON.stringify({ error: result.error || "Request failed" }), {
            status: 500,
            statusText: result.error || "Request failed",
            headers: { "Content-Type": "application/json" },
          });
        }

        // Создаём Response-подобный объект
        const responseHeaders = new Headers();
        if (result.headers) {
          Object.keys(result.headers).forEach(key => {
            responseHeaders.set(key, String(result.headers[key]));
          });
        }

        console.log(`[nhFetch] IPC request success: ${result.status}`);
        return new Response(result.body || "", {
          status: result.status || 200,
          statusText: result.statusText || "OK",
          headers: responseHeaders,
        });
      } catch (err: any) {
        console.error("[nhFetch] Electron IPC error:", err);
        // Fallback: возвращаем ошибку
        return new Response(JSON.stringify({ error: err.message || "IPC request failed" }), {
          status: 500,
          statusText: err.message || "IPC request failed",
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  // Для нативных платформ и обычного браузера используем обычный fetch
  const urlBase = path.startsWith("http") ? path : `${NH_HOST}${path}`;
  let url =
    init.noCache === true
      ? `${urlBase}${urlBase.includes("?") ? "&" : "?"}ts=${Date.now()}`
      : urlBase;

  // Use proxy on web to bypass CORS
  url = getProxiedUrl(url);

  const withAuth = init.withAuth !== false;
  const headers = new Headers(init.headers || {});

  // On web, don't set User-Agent (browser doesn't allow it)
  if (Platform.OS !== "web") {
    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", "nh-client");
    }
  }

  if (withAuth && !headers.has("Cookie") && !hasNativeCookieJar()) {
    const cookieHeader = await cookieHeaderString({ preferNative: false });
    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
      if (Platform.OS === "web") {
        console.log(`[nhFetch] Added Cookie header (length: ${cookieHeader.length})`);
      }
    } else {
      if (Platform.OS === "web") {
        console.warn(`[nhFetch] No cookie header available for ${url}`);
      }
    }
  }

  const tokens = await loadTokens();
  const needsCsrf =
    init.csrf === true ||
    (init.method && !/^(GET|HEAD)$/i.test(String(init.method))) ||
    false;

  if (needsCsrf && tokens.csrftoken && !headers.has("X-CSRFToken")) {
    headers.set("X-CSRFToken", tokens.csrftoken);
    if (!headers.has("Referer")) headers.set("Referer", NH_HOST + "/");
  }

  return fetch(url, { ...init, headers });
}

export function nhFetchPublic(
  path: string,
  init: NHFetchInit = {}
): Promise<Response> {
  return nhFetch(path, { ...init, withAuth: false });
}

/* ================== LOGOUT ================== */

async function deepCookiePurge(): Promise<void> {
  // 1) Native (RN)
  if (CookieManager) {
    try {
      if (typeof CookieManager.clearByName === "function") {
        for (const host of HOST_VARIANTS) {
          for (const name of COOKIE_NAMES) {
            try {
              await CookieManager.clearByName(host, name);
            } catch {}
          }
        }
      } else {
        // Фолбэк через «просрочку»
        const expired = "1970-01-01T00:00:00.000Z";
        for (const host of HOST_VARIANTS) {
          for (const name of COOKIE_NAMES) {
            try {
              await CookieManager.set(host, {
                name,
                value: "",
                path: "/",
                expires: expired,
              });
            } catch {}
          }
        }
      }

      // На Android обязательно flush
      if (Platform.OS === "android") await CookieManager.flush?.();

      // И «последний шанс»
      try {
        await CookieManager.clearAll?.();
      } catch {}
    } catch {}
  }

  // 2) Web (если Expo web): удалим то, что доступно текущему домену
  if (Platform.OS === "web") {
    try {
      const expire = "Thu, 01 Jan 1970 00:00:00 GMT";
      for (const name of COOKIE_NAMES) {
        // Текущий хост
        document.cookie = `${name}=; expires=${expire}; path=/`;
        // Варианты домена (если совпадает с текущим — сработает)
        for (const d of DOMAIN_VARIANTS) {
          document.cookie = `${name}=; expires=${expire}; path=/; domain=${d}`;
        }
      }
    } catch {}
  }
}

async function tryRemoteLogout(): Promise<boolean> {
  try {
    const res = await nhFetch("/logout/", {
      method: "POST",
      csrf: true,
      withAuth: true,
      noCache: true,
    });
    if (res.status >= 200 && res.status < 400) return true;
  } catch {}
  try {
    const res2 = await nhFetch("/logout/?next=/", {
      method: "GET",
      withAuth: true,
      noCache: true,
    });
    if (res2.status >= 200 && res2.status < 400) return true;
  } catch {}
  return false;
}

export async function logout(): Promise<void> {
  // Попробовать сообщить серверу
  try {
    await tryRemoteLogout();
  } catch {}

  await deepCookiePurge();

  await clearTokens();

  try {
    await AsyncStorage.multiRemove([
      "nh.csrf",
      "nh.session",
      "nh.cf_clearance",
      "nh.me",
      "comments.cache",
      "profile.me",
    ]);
  } catch {}

  await new Promise((r) => setTimeout(r, 120));
}


export async function getAuthCookies(): Promise<AuthTokens> {
  try {
    if (hasNativeCookieJar()) return await syncNativeCookiesFromJar();
  } catch {}
  return await loadTokens();
}

export async function setAuthCookies(tokens: AuthTokens): Promise<void> {
  await saveTokens(tokens);
}

/**
 * Синхронизирует cookies из Electron session в AsyncStorage
 * Используется после логина через Electron окно
 */
export async function syncElectronCookies(): Promise<AuthTokens> {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return await loadTokens();
  }

  const electron = (window as any).electron;
  if (!electron || !electron.isElectron) {
    return await loadTokens();
  }

  try {
    const result = await electron.getCookies("https://nhentai.net");
    if (result.success && result.cookies) {
      const cookies = result.cookies;
      const tokens: AuthTokens = {
        csrftoken: cookies.csrftoken,
        sessionid: cookies.sessionid,
      };
      
      if (tokens.csrftoken || tokens.sessionid) {
        await saveTokens(tokens);
        return tokens;
      }
    }
  } catch (err) {
    console.error("[auth] Failed to sync Electron cookies:", err);
  }

  return await loadTokens();
}
