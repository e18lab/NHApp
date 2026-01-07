import axios from "axios";
import * as FileSystem from "expo-file-system/legacy";
import { Image, Platform } from "react-native";

// Proxy URL for web version to bypass CORS
const PROXY_BASE = Platform.OS === "web" 
  ? (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3002") + "/fpi"
  : null;

const baseURL = Platform.OS === "web" && PROXY_BASE
  ? `${PROXY_BASE}/nhentai/api`
  : "https://nhentai.net/api";

// On web, don't set User-Agent header (browser doesn't allow it)
const headers: Record<string, string> = {};
if (Platform.OS !== "web") {
  headers["User-Agent"] = "nh-client";
}

const api = axios.create({
  baseURL,
  headers,
  timeout: 10_000,
});

// Request interceptor removed - no proxy needed for web

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readRetryAfterMs = (headers?: any): number | null => {
  const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!raw) return null;
  const s = parseInt(Array.isArray(raw) ? raw[0] : String(raw), 10);
  return Number.isFinite(s) ? s * 1000 : null;
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg: any = err?.config ?? {};
    const status = err?.response?.status;
    if (!cfg || !status) throw err;

    cfg.__retryCount = cfg.__retryCount ?? 0;
    const canRetry = (status === 429 || status >= 500) && cfg.__retryCount < 3;
    if (!canRetry) throw err;

    cfg.__retryCount++;
    const retryAfter = readRetryAfterMs(err?.response?.headers);
    const backoff =
      (retryAfter ?? Math.min(1000 * 2 ** (cfg.__retryCount - 1), 8000)) +
      Math.floor(Math.random() * 300); // jitter

    await sleep(backoff);
    return api(cfg);
  }
);

export interface Tag {
  id: number;
  type: string;
  name: string;
  url: string;
  count: number;
}

export interface BookPage {
  page: number;
  url: string;
  urlThumb: string;
  width: number;
  height: number;
}

export interface Book {
  id: number;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  uploaded: string;
  media: number;
  favorites: number;
  pagesCount: number;
  scanlator: string;
  tags: Tag[];
  cover: string;
  coverW: number;
  coverH: number;
  thumbnail: string;
  pages: BookPage[];
  artists?: Tag[];
  characters?: Tag[];
  parodies?: Tag[];
  groups?: Tag[];
  categories?: Tag[];
  languages?: Tag[];
  raw?: any;
}

export interface ApiUser {
  id: number;
  username: string;
  slug: string;
  avatar_url: string;
  is_superuser: boolean;
  is_staff: boolean;
  avatar?: string;
}

export interface GalleryComment {
  id: number;
  gallery_id: number;
  poster: ApiUser;
  post_date: number;
  body: string;
  avatar: string;
}

const AVATAR_BASE = "https://i.nhentai.net/";

const absolutizeAvatar = (u?: string): string => {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return AVATAR_BASE + u.replace(/^\/+/, "");
};

const mapComment = (c: any): GalleryComment => {
  const epochSec = Number(c?.post_date ?? 0); // из API приходит в секундах
  const poster: ApiUser = {
    ...(c.poster || {}),
    avatar: absolutizeAvatar(c.poster?.avatar_url), // <— alias
  };

  return {
    id: c.id,
    gallery_id: c.gallery_id,
    poster,
    post_date: epochSec * 1000, // <— теперь ms-таймстамп
    body: String(c.body ?? ""),
    avatar: absolutizeAvatar(c.poster?.avatar_url),
  };
};

export const getComments = async (id: number): Promise<GalleryComment[]> => {
  if (!id) throw new Error("getComments: invalid gallery id");
  const { data } = await api.get(`/gallery/${id}/comments`);
  const arr = Array.isArray(data) ? data : [];
  return arr.map(mapComment);
};

export const getRelatedByApi = async (id: number): Promise<Book[]> => {
  if (!id) throw new Error("getRelatedByApi: invalid gallery id");
  const { data } = await api.get(`/gallery/${id}/related`);
  const arr = Array.isArray(data?.result) ? data.result : [];
  return arr.map(parseBookData);
};

export const getRelatedBooks = async (
  id: number,
  includeTags: TagFilter[] = [],
  excludeTags: TagFilter[] = []
): Promise<{ books: Book[] }> => {
  const passFilters = (b: Book) => {
    const tagKeys = new Set(b.tags.map((t) => `${t.type}:${t.name}`));
    for (const t of excludeTags) {
      if (tagKeys.has(`${t.type}:${t.name}`)) return false;
    }
    for (const t of includeTags) {
      if (!tagKeys.has(`${t.type}:${t.name}`)) return false;
    }
    return true;
  };

  try {
    const viaApi = (await getRelatedByApi(id)).filter((b) => b.id !== id);
    const filtered = viaApi.filter(passFilters);
    if (filtered.length) {
      return { books: filtered.slice(0, 12) };
    }
  } catch {}

  try {
    const book = await getBook(id);
    const first = book.tags[0]?.name ?? "";
    if (!first) return { books: [] };

    const { books } = await searchBooks({
      query: first,
      sort: "popular",
      includeTags,
      excludeTags,
    });

    return {
      books: books.filter((b) => b.id !== id && passFilters(b)).slice(0, 12),
    };
  } catch {
    return { books: [] };
  }
};

export const loadBookFromLocal = async (id: number): Promise<Book | null> => {
  const nhDir = `${FileSystem.documentDirectory}NHAppAndroid/`;
  if (!(await FileSystem.getInfoAsync(nhDir)).exists) return null;

  const titles = await FileSystem.readDirectoryAsync(nhDir);

  for (const title of titles) {
    const titleDir = `${nhDir}${title}/`;

    const idMatch = title.match(/^(\d+)_/);
    const titleId = idMatch ? Number(idMatch[1]) : null;

    const langs = await FileSystem.readDirectoryAsync(titleDir);
    for (const lang of langs) {
      const langDir = `${titleDir}${lang}/`;
      const metaUri = `${langDir}metadata.json`;

      if (!(await FileSystem.getInfoAsync(metaUri)).exists) continue;

      try {
        const raw = await FileSystem.readAsStringAsync(metaUri);
        const book: Book = JSON.parse(raw);

        if (book.id !== id) continue;
        if (titleId && titleId !== book.id) continue;

        const images = (await FileSystem.readDirectoryAsync(langDir))
          .filter((f) => f.startsWith("Image"))
          .sort();

        const pages: BookPage[] = await Promise.all(
          images.map(
            (img, idx) =>
              new Promise<BookPage>((res, rej) => {
                const uri = `${langDir}${img}`;
                Image.getSize(
                  uri,
                  (w, h) =>
                    res({
                      url: uri,
                      urlThumb: uri,
                      width: w,
                      height: h,
                      page: idx + 1,
                    }),
                  rej
                );
              })
          )
        );

        book.pages = pages;
        book.cover = pages[0].url;
        return book;
      } catch (e) {
        console.warn("Failed to load metadata:", e);
        continue;
      }
    }
  }

  return null;
};

export interface Paged<T> {
  items: T[];
  books: T[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
  perPage?: number;
  [extra: string]: any;
}

export const getCoverVariants = (base: string, token: string): string[] => {
  switch (token) {
    case "j":
      return [`${base}.jpg`, `${base}.png`, `${base}.webp`];
    case "J":
      return [`${base}.jpg.webp`, `${base}.jpg`, `${base}.png`];
    case "p":
      return [`${base}.png`, `${base}.jpg`, `${base}.webp`];
    case "P":
      return [`${base}.png.webp`, `${base}.png`, `${base}.jpg`];
    case "w":
      return [`${base}.webp`, `${base}.jpg`, `${base}.png`];
    case "W":
      return [`${base}.webp.webp`, `${base}.webp`, `${base}.jpg`];
    case "g":
      return [`${base}.gif`, `${base}.jpg`];
    case "G":
      return [`${base}.gif.webp`, `${base}.gif`, `${base}.jpg`];
    default:
      return [`${base}.jpg`, `${base}.png`];
  }
};

const extByToken = (t: string): string => {
  switch (t) {
    case "J":
      return "jpg.webp";
    case "j":
      return "jpg";
    case "P":
      return "png.webp";
    case "p":
      return "png";
    case "W":
      return "webp.webp";
    case "w":
      return "webp";
    case "G":
      return "gif.webp";
    case "g":
      return "gif";
    default:
      throw new Error(`Unknown image token: ${t}`);
  }
};

const pickHost = (media: number, page: number): string => {
  const hosts = ["i1", "i2", "i3", "i4"];
  return hosts[(media + page) % hosts.length];
};

export interface TagFilter {
  type: Tag["type"];
  name: string;
}

export const parseBookData = (item: any): Book => {
  const media = item.media_id;
  const coverExt = extByToken(item.images.cover?.t || "j");
  const thumbExt = extByToken(item.images.thumbnail?.t || "j");

  const coverBase = `https://t3.nhentai.net/galleries/${media}/cover`;
  const thumbBase = `https://t3.nhentai.net/galleries/${media}/thumb`;

  const pages: BookPage[] = Array.from({ length: item.num_pages }, (_, i) => {
    const pageNum = i + 1;
    const img = item.images.pages[i] || {};
    const pageExt = extByToken(img.t || "j");
    const host = pickHost(media, pageNum);

    const pageBase = `https://${host}.nhentai.net/galleries/${media}/${pageNum}`;
    const pageBaseThumb = `https://t1.nhentai.net/galleries/${media}/${pageNum}t`;

    return {
      page: pageNum,
      url: `${pageBase}.${pageExt}`,
      urlThumb: `${pageBaseThumb}.${pageExt}`,
      width: img.w ?? 0,
      height: img.h ?? 0,
    };
  });

  const tags: Tag[] = item.tags || [];
  const filterTags = (type: string) => tags.filter((t) => t.type === type);

  return {
    id: Number(item.id),
    title: {
      english: item.title.english,
      japanese: item.title.japanese,
      pretty: item.title.pretty,
    },
    uploaded: item.upload_date
      ? new Date(item.upload_date * 1000).toISOString()
      : "",
    media,
    favorites: item.num_favorites,
    pagesCount: item.num_pages,
    scanlator: item.scanlator || "",
    tags,

    cover: `${coverBase}.${coverExt}`,
    coverW: item.images.cover?.w ?? 0,
    coverH: item.images.cover?.h ?? 0,

    thumbnail: `${thumbBase}.${thumbExt}`,
    pages,

    artists: filterTags("artist"),
    characters: filterTags("character"),
    parodies: filterTags("parody"),
    groups: filterTags("group"),
    categories: filterTags("category"),
    languages: filterTags("language"),

    raw: item,
  };
};

export const getBook = async (id: number): Promise<Book> =>
  parseBookData((await api.get(`/gallery/${id}`)).data);

export const getBookPages = async (
  id: number,
  startPage: number,
  endPage: number
): Promise<{ pages: Book["pages"]; totalPages: number }> => {
  if (!id || !startPage || !endPage) throw new Error("Invalid parameters");
  const { data } = await api.get(`/gallery/${id}`);
  const book = parseBookData(data);
  return {
    pages: book.pages.slice(startPage - 1, endPage),
    totalPages: book.pagesCount,
  };
};

export const getFavorites = async (params: {
  ids: number[];
  sort?: "relevance" | "popular";
  page?: number;
  perPage?: number;
}): Promise<Paged<Book>> => {
  const { ids, sort = "relevance", page = 1, perPage = 24 } = params;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("Ids array required");
  }

  const promises = ids.map((id) =>
    api
      .get(`/gallery/${id}`)
      .then((res) => parseBookData(res.data))
      .catch(() => null)
  );
  const all = (await Promise.all(promises)).filter(Boolean) as Book[];

  let sorted = all;
  if (sort === "popular") {
    sorted = [...all].sort((a: Book, b: Book) => b.favorites - a.favorites);
  }

  const start = (page - 1) * perPage;
  const paged = sorted.slice(start, start + perPage);

  return {
    items: paged,
    books: paged,
    totalPages: Math.max(1, Math.ceil(sorted.length / perPage)),
    currentPage: page,
    totalItems: sorted.length,
    perPage,
  };
};

export type DateSearchPhase =
  | "idle"
  | "meta"
  | "range:start"
  | "range:end"
  | "range:probe"
  | "fetch"
  | "done";

export type DateSearchProgress = {
  phase: DateSearchPhase;
  which?: "start" | "end";
  bounds?: {
    lo: number;
    hi: number;
    mid: number;
    decision?: "left" | "right" | "hit";
  };
  probe?: { page: number; headSec: number; tailSec: number };
  window?: { startIndex: number; endIndex: number; total: number };
};

type Dateish = string | number | Date | null | undefined;
const toEpochSec = (v?: Dateish): number | null => {
  if (v == null) return null;
  if (v instanceof Date) return Math.floor(v.getTime() / 1000);
  if (typeof v === "number")
    return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v);
  if (typeof v === "string" && v.trim()) {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return Math.floor(t / 1000);
  }
  return null;
};

type RangeKey = string;
type RangeInfo = {
  startIndex: number;
  endIndex: number;
  serverPerPage: number;
  serverNumPages: number;
  totalItemsExact: number;
};
const RANGE_CACHE = new Map<RangeKey, RangeInfo>();
const RANGE_ORDER: RangeKey[] = [];
const RANGE_LIMIT = 60;

const PAGE_CACHE = new Map<string, Book[]>();
const PAGE_ORDER: string[] = [];
const PAGE_LIMIT = 180;

const putLRU = <T>(
  map: Map<string, T>,
  order: string[],
  limit: number,
  k: string,
  v: T
) => {
  map.set(k, v);
  order.push(k);
  while (order.length > limit) {
    const old = order.shift()!;
    map.delete(old);
  }
};

type ProbeInfo = { headSec: number; tailSec: number; len: number };
type SessionKey = string;

interface SearchSession {
  key: SessionKey;
  nhQuery: string;
  sort: string;
  serverPerPage: number;
  serverNumPages: number;
  probes: Map<number, ProbeInfo>;
  last?: {
    toSec?: number;
    fromSec?: number;
    startIndex?: number;
    endIndex?: number;
    startPage?: number;
    endPage?: number;
  };
  createdAt: number;
  touchedAt: number;
}

const SESSIONS = new Map<SessionKey, SearchSession>();
const SESS_ORDER: SessionKey[] = [];
const SESS_LIMIT = 20;

const putSession = (s: SearchSession) => {
  s.touchedAt = Date.now();
  if (!SESSIONS.has(s.key)) SESS_ORDER.push(s.key);
  SESSIONS.set(s.key, s);
  while (SESS_ORDER.length > SESS_LIMIT) {
    const old = SESS_ORDER.shift()!;
    SESSIONS.delete(old);
  }
};

const makeSessionKey = (nhQuery: string, sort: string): SessionKey =>
  `sess::${sort || "date"}::${nhQuery}`;

const getOrCreateSession = (
  nhQuery: string,
  sort: string,
  serverPerPage: number,
  serverNumPages: number
): SearchSession => {
  const key = makeSessionKey(nhQuery, sort || "date");
  let s = SESSIONS.get(key);
  if (!s) {
    s = {
      key,
      nhQuery,
      sort: sort || "date",
      serverPerPage,
      serverNumPages,
      probes: new Map(),
      createdAt: Date.now(),
      touchedAt: Date.now(),
    };
  } else {
    s.serverPerPage = serverPerPage;
    s.serverNumPages = serverNumPages;
  }
  putSession(s);
  return s;
};

const rememberProbe = (sess: SearchSession, page: number, info: ProbeInfo) => {
  sess.probes.set(page, info);
  putSession(sess);
};
const getProbe = (sess: SearchSession, page: number): ProbeInfo | undefined =>
  sess.probes.get(page);

async function fetchSearchPage(
  nhQuery: string,
  sort?: string,
  p?: number,
  per?: number,
  force = false
): Promise<readonly Book[]> {
  const sortKey = sort && sort.trim() ? sort : undefined;
  const key = `${nhQuery}||${sortKey ?? "default"}||${p}`;
  if (!force && PAGE_CACHE.has(key)) return PAGE_CACHE.get(key)!;
  const { data } = await api.get("/galleries/search", {
    params: { query: nhQuery, page: p, ...(sortKey ? { sort: sortKey } : {}), ...(per ? { per_page: per } : {}) },
  });
  const arr = Array.isArray(data?.result) ? data.result : [];
  const books = arr.map(parseBookData) as Book[];
  putLRU(PAGE_CACHE, PAGE_ORDER, PAGE_LIMIT, key, books); // перезапись свежими
  return books;
}


async function probePageDates(
  nhQuery: string,
  sort: string,
  p: number,
  perPage: number,
  sess?: SearchSession
) {
  const { data } = await api.get("/galleries/search", {
    params: { query: nhQuery, page: p, sort, per_page: perPage },
  });
  const arr: any[] = Array.isArray(data?.result) ? data.result : [];
  const len = arr.length;
  const headSec = Math.floor(arr[0]?.upload_date ?? 0);
  const tailSec = Math.floor(arr[len - 1]?.upload_date ?? headSec ?? 0);
  if (sess) rememberProbe(sess, p, { headSec, tailSec, len });
  return { headSec, tailSec, len };
}
function seededBounds(
  sess: SearchSession,
  cutoffSec: number,
  which: "start" | "end"
): { lo: number; hi: number } | null {
  const N = sess.serverNumPages;

  const prevPage =
    which === "start" ? sess.last?.startPage : sess.last?.endPage;
  if (prevPage && prevPage >= 1 && prevPage <= N) {
    const seen = getProbe(sess, prevPage);
    if (seen) {
      const newer = seen.headSec;
      const older = seen.tailSec;
      const fits = older <= cutoffSec && newer > cutoffSec;
      if (fits) return { lo: prevPage, hi: prevPage };
    }
    return { lo: Math.max(1, prevPage - 8), hi: Math.min(N + 1, prevPage + 8) };
  }

  if (sess.probes.size >= 3) {
    let below: { page: number; val: number } | null = null;
    let above: { page: number; val: number } | null = null;
    for (const [page, info] of sess.probes.entries()) {
      const v = info.headSec;
      if (v > cutoffSec) {
        if (!above || page < above.page) above = { page, val: v };
      } else {
        if (!below || page > below.page) below = { page, val: v };
      }
    }
    if (above && below && above.page > below.page) {
      const p1 = below.page,
        v1 = below.val;
      const p2 = above.page,
        v2 = above.val;
      const ratio = (v1 - cutoffSec) / Math.max(1, v1 - v2);
      const est = Math.floor(p1 + (p2 - p1) * ratio);
      const lo = Math.max(1, est - 16);
      const hi = Math.min(N + 1, est + 16);
      return { lo, hi };
    }
  }

  return null;
}
async function findFirstIndexLE(
  nhQuery: string,
  sort: string,
  cutoffSec: number,
  serverPerPage: number,
  serverNumPages: number,
  which: "start" | "end",
  onProgress?: (p: DateSearchProgress) => void,
  sess?: SearchSession
) {
  const local = new Map<number, ProbeInfo>();
  const get = async (p: number) => {
    const known = local.get(p) || (sess && getProbe(sess, p));
    if (known) return known;
    const probed = await probePageDates(nhQuery, sort, p, serverPerPage, sess);
    local.set(p, probed);
    return probed;
  };

  let lo = 1,
    hi = serverNumPages + 1;
  let seeded = sess ? seededBounds(sess, cutoffSec, which) : null;

  if (seeded) {
    const left = await get(Math.max(1, seeded.lo));
    const right = await get(
      Math.min(serverNumPages, Math.max(1, seeded.hi - 1))
    );
    const newestInWindow = left.headSec;
    const oldestInWindow = right.tailSec;
    const inside = oldestInWindow <= cutoffSec && cutoffSec < newestInWindow;

    if (inside) {
      lo = Math.max(1, seeded.lo);
      hi = Math.min(serverNumPages + 1, seeded.hi);
    } else {
      seeded = null;
      lo = 1;
      hi = serverNumPages + 1;
    }
  }

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const { headSec, tailSec } = await get(mid);

    onProgress?.({
      phase: "range:probe",
      which,
      bounds: { lo, hi, mid },
      probe: { page: mid, headSec, tailSec },
    });

    if (headSec > cutoffSec) {
      lo = mid + 1;
      onProgress?.({
        phase: "range:probe",
        which,
        bounds: { lo, hi, mid, decision: "right" },
        probe: { page: mid, headSec, tailSec },
      });
    } else {
      hi = mid;
      onProgress?.({
        phase: "range:probe",
        which,
        bounds: { lo, hi, mid, decision: "left" },
        probe: { page: mid, headSec, tailSec },
      });
    }
  }

  if (lo === serverNumPages + 1) {
    const last = await get(serverNumPages);
    const total = (serverNumPages - 1) * serverPerPage + last.len;

    onProgress?.({
      phase: "range:probe",
      which,
      bounds: { lo, hi, mid: serverNumPages, decision: "hit" },
    });

    if (sess) {
      const lastObj = { ...(sess.last || {}) };
      if (which === "start") lastObj.startPage = serverNumPages;
      else lastObj.endPage = serverNumPages;
      sess.last = lastObj;
      putSession(sess);
    }
    return total;
  }

  const p = Math.min(lo, serverNumPages);
  const page = await fetchSearchPage(nhQuery, sort, p, serverPerPage);
  let within = 0;
  while (within < page.length) {
    const sec = Math.floor(
      new Date(page[within].uploaded || 0).getTime() / 1000
    );
    if (sec <= cutoffSec) break;
    within++;
  }

  onProgress?.({
    phase: "range:probe",
    which,
    bounds: { lo, hi, mid: p, decision: "hit" },
  });

  if (sess) {
    const lastObj = { ...(sess.last || {}) };
    if (which === "start") lastObj.startPage = p;
    else lastObj.endPage = p;
    sess.last = lastObj;
    putSession(sess);
  }

  return (p - 1) * serverPerPage + within;
}

interface SearchParams {
  query?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  includeTags?: TagFilter[];
  excludeTags?: TagFilter[];
  filterTags?: TagFilter[];
  contentType?: "new" | "popular" | "";
  dateFrom?: string | number | Date;
  dateTo?: string | number | Date;
  onProgress?: (p: DateSearchProgress) => void;
  sessionKey?: string;
  force?: boolean;
}

export const searchBooks = async (
  params: SearchParams = {}
): Promise<Paged<Book>> => {
  const {
    query = "",
    sort = "",
    page = 1,
    perPage: clientPerPageRaw,
    includeTags = params.filterTags ?? [],
    excludeTags = [],
    contentType = "",
    dateFrom,
    dateTo,
    onProgress,
    sessionKey,
    force = false,
  } = params as SearchParams & { force?: boolean };

  const includePart = includeTags.length
    ? includeTags
        .map((t) => `${t.type.replace(/s$/, "")}:"${t.name}"`)
        .join(" ")
    : "";
  const excludePart = excludeTags.length
    ? excludeTags
        .map((t) => `-${t.type.replace(/s$/, "")}:"${t.name}"`)
        .join(" ")
    : "";
  let nhQuery = [query.trim(), includePart, excludePart]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!nhQuery) nhQuery = " ";

  const allowedSorts = [
    "popular",
    "popular-week",
    "popular-today",
    "popular-month",
    "date",
  ];
  const hasDates = dateFrom != null || dateTo != null;
  let realSort =
    contentType === "new"
      ? "date"
      : contentType === "popular" && !allowedSorts.includes(sort as any)
      ? "popular"
      : sort || (hasDates ? "date" : "");
  if (hasDates && realSort !== "date") realSort = "date";

  const pageSafe = Math.max(1, Number(page ?? 1));

  onProgress?.({ phase: "meta" });
  const metaRes = await api.get("/galleries/search", {
    params: { query: nhQuery, page: 1, sort: realSort || undefined },
  });
  const meta = metaRes.data ?? {};
  const firstResult = Array.isArray(meta.result) ? meta.result : [];
  const serverPerPage =
    Number(meta.per_page) || (firstResult.length > 0 ? firstResult.length : 25);
  const serverNumPages = Number.isFinite(Number(meta.num_pages))
    ? Number(meta.num_pages)
    : firstResult.length > 0
    ? 1
    : 0;

  const sess = getOrCreateSession(
    sessionKey || nhQuery,
    realSort || "date",
    serverPerPage,
    serverNumPages
  );

  if (!hasDates) {
    onProgress?.({ phase: "fetch" });

    const totalItemsApprox = serverNumPages * serverPerPage;

    const clientPerPage = Math.max(1, Number(clientPerPageRaw ?? 45));
    const clientTotalPages = Math.max(
      1,
      Math.ceil(totalItemsApprox / clientPerPage)
    );
    const clientPage = Math.min(pageSafe, clientTotalPages);

    const startIndex = (clientPage - 1) * clientPerPage;
    const endIndex = Math.min(totalItemsApprox, startIndex + clientPerPage);
    const neededCount = Math.max(0, endIndex - startIndex);
    const startServerPage = Math.floor(startIndex / serverPerPage) + 1;
    const endServerPage =
      neededCount > 0
        ? Math.floor((endIndex - 1) / serverPerPage) + 1
        : startServerPage;

    const pages = await Promise.all(
      Array.from({ length: endServerPage - startServerPage + 1 }, (_, i) =>
        fetchSearchPage(
          nhQuery,
          realSort || "",
          startServerPage + i,
          serverPerPage,
          force
        )
      )
    );

    const merged = ([] as Book[]).concat(...pages);
    const offsetInFirst = startIndex - (startServerPage - 1) * serverPerPage;
    let pageItems = merged.slice(
      Math.max(0, offsetInFirst),
      Math.max(0, offsetInFirst) + neededCount
    );

    pageItems = dedupBooks(pageItems);

    void fetchSearchPage(
      nhQuery,
      realSort || "",
      Math.max(1, endServerPage + 1)
    );
    void fetchSearchPage(
      nhQuery,
      realSort || "",
      Math.max(1, startServerPage - 1)
    );

    onProgress?.({ phase: "done" });
    return {
      items: pageItems,
      books: pageItems,
      totalPages: clientTotalPages,
      currentPage: clientPage,
      totalItems: totalItemsApprox,
      perPage: clientPerPage,
    };
  }

  const toSec = toEpochSec(dateTo);
  const fromSec = toEpochSec(dateFrom);
  const toSecAdjusted = toSec == null ? null : toSec + 86399;
  const fromSecStrictLT = fromSec == null ? null : Math.max(0, fromSec - 1);

  const lastProbe = await probePageDates(
    nhQuery,
    realSort,
    serverNumPages,
    serverPerPage,
    sess
  );
  const totalExact = (serverNumPages - 1) * serverPerPage + lastProbe.len;

  const rKey = JSON.stringify({
    nhQuery,
    realSort,
    fromSec,
    toSec,
    serverPerPage,
    serverNumPages,
  });

  let r = RANGE_CACHE.get(rKey);
  if (!r) {
    onProgress?.({ phase: "range:start", which: "start" });
    const startIndex =
      toSecAdjusted == null
        ? 0
        : await findFirstIndexLE(
            nhQuery,
            realSort,
            toSecAdjusted,
            serverPerPage,
            serverNumPages,
            "start",
            onProgress,
            sess
          );

    onProgress?.({ phase: "range:end", which: "end" });
    const endIndex =
      fromSecStrictLT == null
        ? totalExact
        : await findFirstIndexLE(
            nhQuery,
            realSort,
            fromSecStrictLT,
            serverPerPage,
            serverNumPages,
            "end",
            onProgress,
            sess
          );

    r = {
      startIndex,
      endIndex,
      serverPerPage,
      serverNumPages,
      totalItemsExact: totalExact,
    };
    putLRU(RANGE_CACHE, RANGE_ORDER, RANGE_LIMIT, rKey, r);

    sess.last = {
      toSec: toSec ?? undefined,
      fromSec: fromSec ?? undefined,
      startIndex,
      endIndex,
      startPage: Math.floor(startIndex / serverPerPage) + 1,
      endPage: Math.floor(Math.max(0, endIndex - 1) / serverPerPage) + 1,
    };
    putSession(sess);
  }

  const windowTotal = Math.max(0, r.endIndex - r.startIndex);
  onProgress?.({
    phase: "fetch",
    window: {
      startIndex: r.startIndex,
      endIndex: r.endIndex,
      total: windowTotal,
    },
  });

  const clientPerPage = Math.max(1, Number(clientPerPageRaw ?? 45));
  const clientTotalPages = Math.max(1, Math.ceil(windowTotal / clientPerPage));
  const clientPage = Math.min(pageSafe, clientTotalPages);

  const gEnd = Math.max(
    r.startIndex,
    r.endIndex - (clientPage - 1) * clientPerPage
  );
  const gStart = Math.max(r.startIndex, gEnd - clientPerPage);
  const neededCount = Math.max(0, gEnd - gStart);

  if (neededCount <= 0) {
    onProgress?.({ phase: "done" });
    return {
      items: [],
      books: [],
      totalPages: clientTotalPages,
      currentPage: clientPage,
      totalItems: windowTotal,
      perPage: clientPerPage,
    };
  }

  const startServerPage = Math.floor(gStart / serverPerPage) + 1;
  const endServerPage = Math.floor((gEnd - 1) / serverPerPage) + 1;

  const pages = await Promise.all(
    Array.from({ length: endServerPage - startServerPage + 1 }, (_, i) =>
      fetchSearchPage(
        nhQuery,
        realSort,
        startServerPage + i,
        serverPerPage,
        force
      )
    )
  );
  let bufferStartPage = startServerPage;
  let buffer = ([] as Book[]).concat(...pages);

  const sliceFromBuffer = (absStart: number, absEnd: number) => {
    const offset = absStart - (bufferStartPage - 1) * serverPerPage;
    return buffer.slice(
      Math.max(0, offset),
      Math.max(0, offset) + (absEnd - absStart)
    );
  };

  let pageItems = sliceFromBuffer(gStart, gEnd);

  const dateFilter = (arr: Book[]) =>
    arr
      .filter((b) => {
        const sec = Math.floor(new Date(b.uploaded || 0).getTime() / 1000);
        const passTo = toSecAdjusted == null || sec <= toSecAdjusted;
        const passFrom = fromSec == null || sec >= fromSec;
        return passTo && passFrom;
      })
      .reverse();

  pageItems = dateFilter(pageItems);

  const isLastClientPage = clientPage === clientTotalPages;
  if (isLastClientPage && pageItems.length < clientPerPage) {
    const targetStart = Math.max(r.startIndex, gEnd - clientPerPage);

    if (targetStart < gStart) {
      const addStartPage = Math.floor(targetStart / serverPerPage) + 1;
      if (addStartPage < bufferStartPage) {
        const addPages = await Promise.all(
          Array.from({ length: bufferStartPage - addStartPage }, (_, i) =>
            fetchSearchPage(nhQuery, realSort, addStartPage + i, serverPerPage, force)
          )
        );
        buffer = ([] as Book[]).concat(
          ([] as Book[]).concat(...addPages),
          buffer
        );
        bufferStartPage = addStartPage;
      }
    }

    pageItems = dateFilter(sliceFromBuffer(targetStart, gEnd));
  }

  pageItems = dedupBooks(pageItems);

  void fetchSearchPage(
    nhQuery,
    realSort || "",
    Math.max(1, endServerPage + 1),
    serverPerPage
  ); // без force
  void fetchSearchPage(
    nhQuery,
    realSort || "",
    Math.max(1, startServerPage - 1),
    serverPerPage
  );

  onProgress?.({ phase: "done" });
  return {
    items: pageItems,
    books: pageItems,
    totalPages: clientTotalPages,
    currentPage: clientPage,
    totalItems: windowTotal,
    perPage: clientPerPage,
  };
};

function dedupBooks(arr: Book[]): Book[] {
  const seen = new Set<number>();
  const out: Book[] = [];
  for (const b of arr) {
    if (!seen.has(b.id)) {
      seen.add(b.id);
      out.push(b);
    }
  }
  return out;
}

const siteBase = Platform.OS === "web" && PROXY_BASE
  ? `${PROXY_BASE}/nhentai`
  : "https://nhentai.net";

async function getRandomId(): Promise<number> {
  try {
    const res = await axios.get(siteBase + "/random", {
      transformResponse: (r) => r,
      validateStatus: (s) => s >= 200 && s < 400,
    });

    const loc =
      (res.headers && (res.headers.location as string)) ||
      (res.request && res.request.responseURL) ||
      "";

    const finalUrl = String(
      loc || (res as any).request?.responseURL || ""
    ).trim();
    if (!finalUrl) throw new Error("Random: no redirect URL");

    const m = finalUrl.match(/\/g\/(\d+)\//);
    if (m?.[1]) return Number(m[1]);

    const html = typeof res.data === "string" ? res.data : "";
    const mc =
      html.match(/rel=["']canonical["'][^>]*href=["'][^"']*\/g\/(\d+)\//i) ||
      html.match(/property=["']og:url["'][^>]*content=["'][^"']*\/g\/(\d+)\//i);
    if (mc?.[1]) return Number(mc[1]);

    throw new Error("Random: failed to extract gallery id");
  } catch (e) {
    throw new Error(
      `getRandomId failed: ${(e as Error)?.message || String(e)}`
    );
  }
}

export const getRandomBook = async (): Promise<Book> => {
  const id = await getRandomId();
  return getBook(id);
};

import tagsDb from "./nhentai-tags.json";
export const getTags = async (): Promise<{
  tags: typeof tagsDb;
  updated: string;
}> => {
  return { tags: tagsDb as any, updated: (tagsDb as any).updated ?? "" };
};

export interface RecommendParams {
  ids: number[];
  sentIds?: number[];
  page?: number;
  perPage?: number;
  includeTags?: TagFilter[];
  excludeTags?: TagFilter[];
  filterTags?: TagFilter[];
  randomSeed?: number;
}

const KNOWN_BUCKETS = [
  "artist",
  "parody",
  "group",
  "category",
  "character",
] as const;
type Bucket = (typeof KNOWN_BUCKETS)[number] | "tag";
const TAG_W: Record<Bucket, number> = {
  character: 4,
  artist: 3,
  parody: 2,
  group: 2,
  category: 1.5,
  tag: 1,
};
const blankFreq = () => Object.create(null) as Record<string, number>;
const bucketOf = (t: Tag["type"]): Bucket =>
  KNOWN_BUCKETS.includes(t as any) ? (t as Bucket) : "tag";

export interface CandidateBook extends Book {
  isExploration?: boolean;
}

export const searchBooksRecomendation = async (
  params: SearchParams = {}
): Promise<Paged<Book>> => {
  const {
    query = "",
    sort = "",
    page = 1,
    perPage = 24,
    includeTags = params.filterTags ?? [],
    excludeTags = [],
    contentType = "",
  } = params;

  const includePart = includeTags.length
    ? includeTags
        .map((t) => `${t.type.replace(/s$/, "")}:"${t.name}"`)
        .join(" ")
    : "";
  const excludePart = excludeTags.length
    ? excludeTags
        .map((t) => `-${t.type.replace(/s$/, "")}:"${t.name}"`)
        .join(" ")
    : "";
  const nhQuery = `${query.trim()} ${includePart} ${excludePart}`.trim() || " ";

  const allowedSorts = [
    "popular",
    "popular-week",
    "popular-today",
    "popular-month",
    "date",
  ];
  const realSort =
    contentType === "new"
      ? "date"
      : contentType === "popular" && !allowedSorts.includes(sort as any)
      ? "popular"
      : sort;

  const effectivePerPage = Math.min(perPage || 24, 100);
  const { data } = await api.get("/galleries/search", {
    params: {
      query: nhQuery,
      page: +page || 1,
      per_page: effectivePerPage,
      sort: realSort,
    },
  });

  const books = data.result.map(parseBookData) as Book[];
  const totalPages = data.num_pages || 1;
  const totalItems = data.total || books.length;

  if (totalItems > effectivePerPage && books.length < totalItems) {
    const remainingPages = Math.ceil(
      (totalItems - books.length) / effectivePerPage
    );
    const additionalPages = await Promise.all(
      Array.from({ length: remainingPages }, (_, i) =>
        api.get("/galleries/search", {
          params: {
            query: nhQuery,
            page: page + i + 1,
            per_page: effectivePerPage,
            sort: realSort,
          },
        })
      )
    );
    additionalPages.forEach(({ data }) => {
      books.push(...data.result.map(parseBookData));
    });
  }

  return {
    items: books,
    books,
    totalPages,
    currentPage: +page || 1,
    perPage: effectivePerPage,
    totalItems,
  };
};

export async function getRecommendations(
  p: RecommendParams
): Promise<
  Paged<CandidateBook & { explain: string[]; score: number }> & { debug: any }
> {
  const {
    ids,
    sentIds = [],
    page = 1,
    perPage = 24,
    includeTags = p.filterTags ?? [],
    excludeTags = [],
    randomSeed = Date.now(),
  } = p;
  if (!ids.length) throw new Error("Ids array required");

  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const freq: Record<Bucket, Record<string, number>> = {
    character: blankFreq(),
    artist: blankFreq(),
    parody: blankFreq(),
    group: blankFreq(),
    category: blankFreq(),
    tag: blankFreq(),
  };

  const likedBooks = (await Promise.all(ids.map(getBook))).filter(
    Boolean
  ) as Book[];
  likedBooks.forEach((b) =>
    b.tags.forEach((t) => {
      const bkt = bucketOf(t.type);
      freq[bkt][t.name] = (freq[bkt][t.name] ?? 0) + 1;
    })
  );

  const calcTagWeight = (
    bucket: Bucket,
    tag: string,
    isRare: boolean
  ): number => {
    const base = TAG_W[bucket] ?? 1;
    const count = freq[bucket][tag] ?? 0;
    const totalTags = Object.keys(freq[bucket]).length;
    const variance = totalTags > 1 ? 1 / Math.sqrt(totalTags) : 1;
    const rarityBonus = isRare ? 1.5 : 1;
    return (
      base * (count > 0 ? Math.pow(count, 1.2) : 0.7) * variance * rarityBonus
    );
  };

  const topN = (m: Record<string, number>, n = 5) =>
    Object.entries(m)
      .sort(([, v1], [, v2]) => v2 - v1)
      .slice(0, n)
      .map(([k]) => k);
  const rareN = (m: Record<string, number>, n = 5) =>
    Object.entries(m)
      .filter(([, v]) => v <= 2)
      .slice(0, n)
      .map(([k]) => k);

  const topChars = topN(freq.character, 8);
  const topArts = topN(freq.artist, 6);
  const topTags = topN(freq.tag, 12);
  const rareTags = rareN(freq.tag, 8);
  const rareChars = rareN(freq.character, 5);

  const favQueries = [
    ...topChars.map((c) => `character:"${c}"`),
    ...topArts.map((a) => `artist:"${a}"`),
    ...topChars
      .slice(0, 3)
      .flatMap((c, i) =>
        topArts[i] ? [`character:"${c}" artist:"${topArts[i]}"`] : []
      ),
    ...rareChars.map((c) => `character:"${c}"`),
  ];
  const tagQueries = [
    topTags.join(" "),
    ...topTags.slice(0, 6).map((t) => `"${t}"`),
    ...rareTags.map((t) => `"${t}"`),
  ];

  const includePart = includeTags.length
    ? includeTags
        .map((t) => `${t.type.replace(/s$/, "")}:"${t.name}"`)
        .join(" ")
    : "";
  const withFilter = (arr: string[]) =>
    includePart ? arr.map((q) => `${includePart} ${q}`) : arr;

  const excludeIds = new Set(sentIds);
  const candidates = new Map<number, CandidateBook>();
  const fetchPage = async (q: string, pN: number) =>
    searchBooksRecomendation({ query: q, sort: "popular", page: pN, perPage })
      .then((r) => r.books)
      .catch(() => [] as Book[]);

  const grab = async (queries: string[], isExploration = false) => {
    const uniqueQueries = [...new Set(queries)];
    await Promise.all(
      [1, 2, 3, 4].map((pn) =>
        Promise.all(uniqueQueries.map((q) => fetchPage(q, pn)))
      )
    ).then((pages) =>
      pages.flat(2).forEach((b) => {
        if (
          !excludeIds.has(b.id) &&
          !candidates.has(b.id) &&
          candidates.size < perPage * 15
        ) {
          candidates.set(b.id, { ...b, isExploration });
        }
      })
    );
  };

  await grab(withFilter(favQueries));
  await grab(withFilter(tagQueries), true);

  const clusterBooks = (
    books: (CandidateBook & { score: number; explain: string[] })[]
  ) => {
    const clusters: Record<string, typeof books> = {};
    books.forEach((book) => {
      const primaryTag =
        book.tags.find((t) => t.type === "character" || t.type === "tag")
          ?.name || "other";
      clusters[primaryTag] = clusters[primaryTag] || [];
      clusters[primaryTag].push(book);
    });

    const result: typeof books = [];
    const maxPerCluster = 3;
    Object.values(clusters).forEach((cluster) => {
      shuffleArray(cluster, randomSeed);
      result.push(...cluster.slice(0, maxPerCluster));
    });
    return result;
  };

  const likedSet = new Set(ids);
  const required = new Set(includeTags.map((t) => `${t.type}:${t.name}`));
  const forbidden = new Set(excludeTags.map((t) => `${t.type}:${t.name}`));
  const scored: (CandidateBook & { explain: string[]; score: number })[] = [
    ...candidates.values(),
  ].flatMap((book) => {
    const tagKeys = new Set(book.tags.map((t) => `${t.type}:${t.name}`));

    for (const f of forbidden) if (tagKeys.has(f)) return [];
    for (const r of required) if (!tagKeys.has(r)) return [];

    let score = book.favorites / 10_000;
    const explain: string[] = [];

    if (likedSet.has(book.id)) {
      score *= 0.4;
      explain.push("<i>демотирован лайком (×0.4)</i>");
    }

    if (book.isExploration) {
      score *= 0.75;
      explain.push(
        "<i>экспериментальная рекомендация для разнообразия (×0.75)</i>"
      );
    }

    book.tags.forEach((t) => {
      const bkt = bucketOf(t.type);
      const cnt = freq[bkt][t.name] ?? 0;
      const isRare = cnt <= 2 && cnt > 0;
      const add = calcTagWeight(bkt, t.name, isRare);
      score += add;
      const label =
        bkt === "tag" ? "Tag" : `${bkt.charAt(0).toUpperCase()}${bkt.slice(1)}`;
      explain.push(
        `${label} <b>${t.name}</b> встречался в ${cnt || 1} избранных${
          isRare ? ", редкий" : ""
        } — +${add.toFixed(2)}`
      );
    });

    return [{ ...book, score, explain }];
  });

  const shuffleArray = <T>(array: T[], seed: number) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed + i) * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const diversified = clusterBooks(scored.sort((a, b) => b.score - a.score));

  shuffleArray(diversified, randomSeed);

  const start = (page - 1) * perPage;
  const pageItems = diversified.slice(start, start + perPage);

  return {
    items: pageItems,
    books: pageItems,
    totalPages: Math.max(1, Math.ceil(diversified.length / perPage)),
    currentPage: page,
    totalItems: diversified.length,
    perPage,
    debug: {
      freq,
      topChars,
      topArts,
      topTags,
      rareTags,
      rareChars,
      favQueries: withFilter(favQueries),
      tagQueries: withFilter(tagQueries),
      includeTags,
      excludeTags,
      candidateCount: candidates.size,
      seed: randomSeed,
    },
  };
}
