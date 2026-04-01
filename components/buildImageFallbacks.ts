import { getThumbServerList, normalizeV2MediaPath } from "@/api/v2/config";

/** Одиночные и составные расширения (как на сайте / в старых клиентах). */
function suffixVariants(preferredExt: string): string[] {
  let e = preferredExt.toLowerCase();
  while (/\.webp\.webp$/i.test(e)) {
    e = e.replace(/\.webp\.webp$/i, ".webp");
  }
  if (e === "jpeg") e = "jpg";
  const rest = [
    "webp",
    "jpg",
    "png",
    "gif",
    "jpg.webp",
    "png.webp",
    "webp.webp",
    "gif.webp",
  ];
  const merged = [e, ...rest].filter((x, i, a) => a.indexOf(x) === i);
  return merged;
}

function pathnameOf(url: string): string {
  const n = normalizeV2MediaPath(url.trim());
  if (!n) return "";
  if (/^https?:\/\//i.test(n)) {
    try {
      return new URL(n).pathname;
    } catch {
      return "";
    }
  }
  return n.startsWith("/") ? n : `/${n}`;
}

/**
 * Список URL для SmartImageWithRetry:
 * — нормализация .webp.webp;
 * — все зеркала thumb (t1–t4 из /config);
 * — thumb|cover и расширения webp / jpg / png / … / jpg.webp и т.д.
 */
export const buildImageFallbacks = (url: string): string[] => {
  const cleaned = normalizeV2MediaPath((url || "").trim());
  if (!cleaned) return [];

  const pathname = pathnameOf(cleaned);
  if (!pathname) return [cleaned];

  const servers = getThumbServerList().map((s) => s.replace(/\/$/, ""));
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (u: string) => {
    const x = u.trim();
    if (!x || seen.has(x)) return;
    seen.add(x);
    out.push(x);
  };

  const gallery = pathname.match(/^\/galleries\/(\d+)\/(thumb|cover)\.(.+)$/i);

  if (gallery) {
    const id = gallery[1];
    const role = gallery[2].toLowerCase() as "thumb" | "cover";
    const extPart = gallery[3];
    const names =
      role === "thumb" ? (["thumb", "cover"] as const) : (["cover", "thumb"] as const);
    const suffixes = suffixVariants(extPart);

    add(cleaned);

    for (const srv of servers) {
      add(`${srv}${pathname}`);
    }

    for (const name of names) {
      for (const suf of suffixes) {
        const p = `/galleries/${id}/${name}.${suf}`;
        if (p === pathname) continue;
        for (const srv of servers) {
          add(`${srv}${p}`);
        }
      }
    }

    const i = out.indexOf(cleaned);
    if (i > 0) {
      out.splice(i, 1);
      out.unshift(cleaned);
    }
    return out;
  }

  add(cleaned);
  if (/^https?:\/\/t[1-4]\.nhentai\.net/i.test(cleaned)) {
    try {
      const p = new URL(cleaned).pathname;
      for (const srv of servers) {
        add(`${srv}${p}`);
      }
    } catch {
      /* ignore */
    }
  }

  return out.length ? out : [cleaned];
};
