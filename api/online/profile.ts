import { NH_HOST } from "@/api/auth";
import { parse } from "date-fns";
import { getHtmlWithCookies, isBrowser } from "./http";
import { normalizeNhUrl } from "./scrape";
import type { Me, UserComment, UserOverview } from "./types";

function decodeEntities(s: string): string {
  if (!s) return "";
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function htmlToText(s: string): string {
  return decodeEntities(
    s
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/[ \t]+/g, " ")
  ).trim();
}

function parseProfileHeader(
  html: string,
  id: number,
  slug?: string
): Me | null {
  const name =
    html
      .match(
        /<div[^>]*class=["']user-info["'][^>]*>[\s\S]*?<h1>([^<]+)<\/h1>/i
      )?.[1]
      ?.trim() ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() ||
    (slug ? String(slug) : "");

  const avatar =
    html.match(
      /<div[^>]*class=["']bigavatar["'][^>]*>\s*<img[^>]+(?:data-src|src)=["']([^"']+)["']/i
    )?.[1] || null;

  if (!name && !avatar) return null;

  const profile_url = `${NH_HOST}/users/${id}/${encodeURIComponent(
    slug || name
  )}/`;
  return {
    id,
    username: name || (slug ?? ""),
    slug,
    avatar_url: avatar ? normalizeNhUrl(avatar) : undefined,
    profile_url,
  };
}

function parseJoinedTextToTs(s?: string): number | undefined {
  if (!s) return undefined;
  const normalized = s
    .replace(/\b([A-Za-z]{3})\./g, "$1") // Feb. → Feb
    .replace(/\bp\.m\./gi, "PM")
    .replace(/\ba\.m\./gi, "AM");
  try {
    const d = parse(normalized, "MMM d, yyyy, h:mm a", new Date());
    return Number.isNaN(+d) ? undefined : d.getTime();
  } catch {
    return undefined;
  }
}

function extractJoined(html: string): {
  joinedAt?: number;
  joinedText?: string;
} {
  const joinedBlock =
    html.match(
      /<b>\s*Joined:\s*<\/b>[\s\S]*?<time[^>]*?(?:\/>|>[\s\S]*?<\/time>)/i
    )?.[0] || "";

  const mISO = joinedBlock.match(/\bdatetime=["']([^"']+)["']/i);
  if (mISO) {
    const d = new Date(mISO[1]);
    if (!Number.isNaN(+d))
      return { joinedAt: d.getTime(), joinedText: undefined };
  }

  const mTitle = joinedBlock.match(/\btitle=["']([^"']+)["']/i);
  if (mTitle) {
    const d = parse(
      decodeEntities(mTitle[1]),
      "dd.MM.yyyy, HH:mm:ss",
      new Date()
    );
    if (!Number.isNaN(+d))
      return { joinedAt: d.getTime(), joinedText: undefined };
  }

  const inner = joinedBlock.match(/>([^<]+)<\/time>/i)?.[1]?.trim();
  const fallbackTs = parseJoinedTextToTs(inner);
  return { joinedAt: fallbackTs, joinedText: inner };
}

export async function getUserProfile(
  id: number,
  slug?: string
): Promise<Me | null> {
  if (!id) return null;
  const base = `${NH_HOST}/users/${id}/${encodeURIComponent(slug || "")}`;
  const url = base.endsWith("/") ? base : base + "/";
  try {
    let html: string;
    
    // Для Electron (web платформа) используем IPC метод
    if (isBrowser) {
      const isElectron = typeof window !== "undefined" && !!(window as any).electron?.isElectron;
      if (isElectron) {
        const electron = (window as any).electron;
        if (!electron || !electron.fetchHtml) {
          return null;
        }
        const result = await electron.fetchHtml(url);
        if (!result.success || !result.html) {
          return null;
        }
        html = result.html;
      } else {
        // Обычный браузер - не поддерживаем
        return null;
      }
    } else {
      // Нативные платформы: используем getHtmlWithCookies
      html = await getHtmlWithCookies(url);
    }
    const fromHeader = parseProfileHeader(html, id, slug);
    if (fromHeader?.username)
      return { ...fromHeader, profile_url: fromHeader.profile_url || url };

    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim();
    const av = html.match(
      /<img[^>]+class=["'][^"']*\bavatar\b[^"']*["'][^>]+(?:data-src|src)=["']([^"']+)["']/i
    )?.[1];
    return h1
      ? {
          id,
          username: h1,
          slug,
          avatar_url: av ? normalizeNhUrl(av) : undefined,
          profile_url: url,
        }
      : null;
  } catch {
    return null;
  }
}

export async function getUserOverview(
  id: number,
  slug?: string
): Promise<UserOverview | null> {
  if (!id) return null;
  const base = `${NH_HOST}/users/${id}/${encodeURIComponent(slug || "")}`;
  const url = base.endsWith("/") ? base : base;
  try {
    let html: string;
    
    // Для Electron (web платформа) используем IPC метод
    if (isBrowser) {
      const isElectron = typeof window !== "undefined" && !!(window as any).electron?.isElectron;
      if (isElectron) {
        const electron = (window as any).electron;
        if (!electron || !electron.fetchHtml) {
          return null;
        }
        const result = await electron.fetchHtml(url);
        if (!result.success || !result.html) {
          return null;
        }
        html = result.html;
      } else {
        // Обычный браузер - не поддерживаем
        return null;
      }
    } else {
      // Нативные платформы: используем getHtmlWithCookies
      html = await getHtmlWithCookies(url);
    }

    const headerUser = parseProfileHeader(html, id, slug) || {
      id,
      username: slug || "",
    };

    const { joinedAt, joinedText } = extractJoined(html);

    let favoriteTags: string[] | undefined;
    let favoriteTagsText: string | undefined;
    const favP =
      html.match(
        /<p[^>]*>\s*<b>\s*Favorite\s*tags:\s*<\/b>\s*([\s\S]*?)<\/p>/i
      ) || html.match(/Favorite\s*tags:\s*([\s\S]*?)<\/p>/i);

    if (favP) {
      const inner = favP[1];
      const aMatches = Array.from(inner.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)).map(
        (m) => decodeEntities(m[1].trim())
      );
      if (aMatches.length) favoriteTags = aMatches.filter(Boolean);
      const rawText = htmlToText(inner);
      if (rawText) favoriteTagsText = rawText;
    }

    let about: string | undefined;
    const aboutP =
      html.match(/<p[^>]*>\s*<b>\s*About:\s*<\/b>\s*([\s\S]*?)<\/p>/i) ||
      html.match(/<b>\s*About:\s*<\/b>\s*([\s\S]*?)<\/p>/i);
    if (aboutP) {
      about = htmlToText(aboutP[1]);
    }

    const ids = new Set<number>();
    const re = /href=["']\/g\/(\d+)\/["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && ids.size < 48) ids.add(Number(m[1]));

    const commentRe =
      /<div[^>]*\bclass=["'][^"']*\bcomment\b[^"']*["'][^>]*\bdata-state=["']([\s\S]*?)["'][^>]*>/gi;

    const recentComments: UserComment[] = [];
    let mc: RegExpExecArray | null;

    while ((mc = commentRe.exec(html)) && recentComments.length < 30) {
      try {
        const json = JSON.parse(decodeEntities(mc[1]));
        const c: UserComment = {
          id: Number(json?.id),
          gallery_id: Number(json?.gallery_id),
          body: String(json?.body || ""),
          post_date:
            typeof json?.post_date === "number"
              ? Math.floor(json.post_date)
              : Number.isFinite(+json?.post_date)
              ? Math.floor(+json.post_date)
              : undefined,
          avatar_url: json?.poster?.avatar_url
            ? normalizeNhUrl(json.poster.avatar_url)
            : undefined,
          page_url:
            json?.id && json?.gallery_id
              ? `/g/${json.gallery_id}/#comment-${json.id}`
              : undefined,
        };
        if (c.id && c.gallery_id) recentComments.push(c);
      } catch {
      }
    }

    return {
      me: {
        id: headerUser?.id ?? id,
        username: headerUser?.username || slug || "",
        slug: headerUser?.slug || slug,
        avatar_url: headerUser?.avatar_url,
        profile_url: headerUser?.profile_url || url,
      },
      joinedText,
      joinedAt,
      favoriteTags,
      favoriteTagsText,
      about,
      recentFavoriteIds: Array.from(ids),
      recentComments,
    };
  } catch {
    return null;
  }
}
