import { NH_HOST, cookieHeaderString, hasNativeCookieJar } from "@/api/auth";
import axios from "axios";
import { Platform } from "react-native";

export const isBrowser = Platform.OS === "web";

function baseHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Referer: NH_HOST + "/",
    Accept: "text/html,application/xhtml+xml",
    "Cache-Control": "no-cache",
  };
  
  // On web, don't set User-Agent (browser doesn't allow it)
  if (Platform.OS !== "web") {
    headers["User-Agent"] = "nh-client";
  }
  
  return headers;
}

/** Универсальный HTML-GET с куками (нативный jar или руками через Header) */
export async function fetchHtml(url: string): Promise<{
  html: string;
  finalUrl: string;
  status: number;
}> {
  // On web, use direct fetch
  const finalUrl = url;
  
  if (isBrowser) {
    // On web, try to fetch directly
    try {
      const res = await fetch(finalUrl, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Cache-Control": "no-cache",
        },
      });
      const html = await res.text();
      return {
        html,
        finalUrl: res.url || url,
        status: res.status,
      };
    } catch (e) {
      return { html: "", finalUrl: url, status: 0 };
    }
  }

  const useNativeJar = hasNativeCookieJar();
  const headers = baseHeaders();

  if (!useNativeJar) {
    const cookie = await cookieHeaderString({ preferNative: false });
    if (cookie) headers.Cookie = cookie;
  }

  const res = await axios.get<string>(finalUrl, {
    transformResponse: (r) => r,
    validateStatus: (s) => s >= 200 && s < 500,
    withCredentials: true,
    headers,
  });

  const finalUrlFromResponse =
    String((res as any)?.request?.responseURL || res.headers?.location || url) || url;

  return {
    html: String(res.data || ""),
    finalUrl: finalUrlFromResponse,
    status: Number(res.status || 0),
  };
}

/** Простой помощник: только HTML (когда редирект не важен) */
export async function getHtmlWithCookies(url: string): Promise<string> {
  const { html } = await fetchHtml(url);
  return html;
}
