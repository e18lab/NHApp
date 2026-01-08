import { NH_HOST, nhFetch } from "@/api/auth";
import { getHtmlWithCookies, isBrowser } from "./http";
import {
  normalizeNhUrl,
  tryParseUserFromAppScript,
  tryParseUserFromRightMenu,
} from "./scrape";
import type { Me } from "./types";

export async function getMe(): Promise<Me | null> {
  try {
    let html: string;
    
    // Для Electron (web платформа) используем nhFetch с cookies из AsyncStorage
    if (isBrowser) {
      // Проверяем что это Electron, а не обычный браузер
      const isElectron = typeof window !== "undefined" && !!(window as any).electron?.isElectron;
      if (!isElectron) {
        // Обычный браузер - не поддерживаем
        console.log("[getMe] Not Electron, returning null");
        return null;
      }
      
      // Electron: используем IPC метод для получения HTML с cookies из Electron session
      console.log("[getMe] Electron detected, using IPC fetchHtml");
      try {
        const electron = (window as any).electron;
        if (!electron || !electron.fetchHtml) {
          console.error("[getMe] electron.fetchHtml not available");
          return null;
        }
        
        const result = await electron.fetchHtml(`${NH_HOST}/`);
        console.log(`[getMe] fetchHtml result:`, { success: result.success, status: result.status });
        
        if (!result.success || !result.html) {
          console.warn(`[getMe] fetchHtml failed:`, result.error);
          return null;
        }
        
        html = result.html;
        console.log(`[getMe] Got HTML, length: ${html.length}`);
      } catch (err) {
        console.error("[getMe] IPC fetchHtml error:", err);
        return null;
      }
    } else {
      // Нативные платформы: используем getHtmlWithCookies
      html = await getHtmlWithCookies(NH_HOST + "/");
    }

    const fromApp = tryParseUserFromAppScript(html);
    const fromMenu = tryParseUserFromRightMenu(html);

    if (!fromApp && !fromMenu) return null;

    const id = fromApp?.id ?? fromMenu?.id;
    const username = fromApp?.username ?? fromMenu?.username;
    const slug = fromApp?.slug ?? fromMenu?.slug;
    const avatar_url = normalizeNhUrl(
      fromApp?.avatar_url || fromMenu?.avatar_url
    );
    const profile_url =
      fromApp?.profile_url ||
      fromMenu?.profile_url ||
      (id && username
        ? `${NH_HOST}/users/${id}/${encodeURIComponent(slug || username)}/`
        : undefined);

    if (!username) return null;

    return { id, username, slug, avatar_url, profile_url };
  } catch (err) {
    console.error("[getMe] Error:", err);
    return null;
  }
}
