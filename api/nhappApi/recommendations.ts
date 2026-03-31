/**
 * Client-side recommendation engine.
 *
 * Builds a preference profile from all available user signals:
 *   - bookFavorites (local)
 *   - bookFavoritesOnline.v1 (cloud-synced)
 *   - readHistory
 *   - searchHistory
 *   - tag.favs.v1 (explicitly starred tags)
 *
 * Then fires multiple parallel queries against recommendation_lib
 * and scores/ranks results by relevance to the user's taste.
 *
 * Results are cached in module-level memory and only refresh
 * when clearRecommendationCache() is called (pull-to-refresh / re-entry).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Book } from "@/api/nhentai";
import {
  nhappApiBase,
  recommendationLibRowToBook,
  hydrateMissingThumbnails,
  type RecommendationLibBatchRow,
} from "@/api/recommendationLib";
import { initCdn } from "@/api/v2";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ScoredTerm {
  name: string;
  score: number;
  /** Which data sources contributed to this score. */
  sources: string[];
}

export interface RecommendationProfile {
  tags: ScoredTerm[];
  artists: ScoredTerm[];
  parodies: ScoredTerm[];
  characters: ScoredTerm[];
  groups: ScoredTerm[];
  /** Preferred languages, sorted by frequency. */
  languages: string[];
  /** All book IDs the user has already seen — excluded from results. */
  seenIds: Set<number>;
  // ── Stats for "How it works" modal ───────────────────────────────────────
  totalLocalFavorites: number;
  totalOnlineFavorites: number;
  totalReadHistory: number;
  totalTagFavs: number;
  totalSearchHistory: number;
}

export interface RecommendationResult {
  books: Book[];
  profile: RecommendationProfile;
  /** Human-readable list of queries that were executed. */
  queriesUsed: string[];
  generatedAt: number;
}

// ─── Session cache ────────────────────────────────────────────────────────────

let _cache: RecommendationResult | null = null;

export function clearRecommendationCache(): void {
  _cache = null;
}

export function getCachedRecommendations(): RecommendationResult | null {
  return _cache;
}

// ─── Internal score map helpers ───────────────────────────────────────────────

type ScoreMap = Map<string, { score: number; sources: Set<string> }>;

function addScore(
  map: ScoreMap,
  rawName: string,
  score: number,
  source: string
): void {
  const key = rawName.trim().toLowerCase();
  if (!key) return;
  const entry = map.get(key);
  if (entry) {
    entry.score += score;
    entry.sources.add(source);
  } else {
    map.set(key, { score, sources: new Set([source]) });
  }
}

function mapToSorted(map: ScoreMap): ScoredTerm[] {
  return Array.from(map.entries())
    .map(([name, { score, sources }]) => ({
      name,
      score,
      sources: [...sources],
    }))
    .sort((a, b) => b.score - a.score);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function parseArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ─── Batch metadata fetch (recommendation_lib/books/batch) ───────────────────

async function fetchMetadataBatch(
  ids: number[]
): Promise<RecommendationLibBatchRow[]> {
  if (ids.length === 0) return [];
  const base = nhappApiBase();
  const CHUNK = 200;
  const rows: RecommendationLibBatchRow[] = [];

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const res = await fetch(
        `${base}/api/recommendation-lib/books/batch?q=${encodeURIComponent(
          chunk.join(",")
        )}`
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        books: RecommendationLibBatchRow[];
      };
      rows.push(...(data.books ?? []));
    } catch {
      /* skip on network error */
    }
  }
  return rows;
}

// ─── Profile builder ──────────────────────────────────────────────────────────

type ReadHistoryEntry = [number, number, number, number]; // [id, curPage, totalPages, timestamp]

/**
 * Reads all user data from AsyncStorage, batch-fetches metadata for
 * recently seen books, and builds a scored preference profile.
 */
export async function buildRecommendationProfile(): Promise<RecommendationProfile> {
  const [
    rawLocalFavs,
    rawOnlineFavs,
    rawReadHistory,
    rawSearchHistory,
    rawTagFavs,
    rawTagFavsLegacy,
  ] = await Promise.all([
    AsyncStorage.getItem("bookFavorites"),
    AsyncStorage.getItem("bookFavoritesOnline.v1"),
    AsyncStorage.getItem("readHistory"),
    AsyncStorage.getItem("searchHistory"),
    AsyncStorage.getItem("tag.favs.v1"),
    AsyncStorage.getItem("tag.favs"),
  ]);

  const localFavIds: number[] = rawLocalFavs ? JSON.parse(rawLocalFavs) : [];
  const onlineFavIds: number[] = rawOnlineFavs ? JSON.parse(rawOnlineFavs) : [];
  const readHistory: ReadHistoryEntry[] = rawReadHistory
    ? JSON.parse(rawReadHistory)
    : [];
  const searchHistory: string[] = rawSearchHistory
    ? JSON.parse(rawSearchHistory)
    : [];
  const tagFavObj: Record<string, true> = rawTagFavs
    ? JSON.parse(rawTagFavs)
    : rawTagFavsLegacy
    ? JSON.parse(rawTagFavsLegacy)
    : {};

  // Everything the user has already interacted with → exclude from results
  const localFavSet = new Set(localFavIds);
  const seenIds = new Set<number>([
    ...localFavIds,
    ...onlineFavIds,
    ...readHistory.map((e) => e[0]),
  ]);

  const tagScores: ScoreMap = new Map();
  const artistScores: ScoreMap = new Map();
  const parodyScores: ScoreMap = new Map();
  const characterScores: ScoreMap = new Map();
  const groupScores: ScoreMap = new Map();
  const langCount = new Map<string, number>();

  // ── Signal 1: Explicitly starred tags (highest weight = 10) ─────────────
  let totalTagFavs = 0;
  for (const key of Object.keys(tagFavObj)) {
    const colon = key.indexOf(":");
    if (colon === -1) continue;
    const kind = key.slice(0, colon);
    const name = key.slice(colon + 1);
    if (!name) continue;
    totalTagFavs++;
    if (kind === "tags") addScore(tagScores, name, 10, "tagFavs");
    else if (kind === "artists") addScore(artistScores, name, 10, "tagFavs");
    else if (kind === "parodies") addScore(parodyScores, name, 10, "tagFavs");
    else if (kind === "characters")
      addScore(characterScores, name, 10, "tagFavs");
    else if (kind === "groups") addScore(groupScores, name, 10, "tagFavs");
  }

  // ── Signal 2–4: Batch fetch book metadata for profile building ───────────
  // Local favs: last 150 most recently added (slice from end)
  const recentLocalIds = localFavIds.slice(-150).reverse();
  // Online-only favs: not already in local fav list, last 80
  const onlineOnlyIds = onlineFavIds
    .filter((id) => !localFavSet.has(id))
    .slice(-80)
    .reverse();
  // Read history: 60 most recently read
  const recentReadHistory = readHistory
    .slice()
    .sort((a, b) => b[3] - a[3])
    .slice(0, 60);
  const recentReadIds = recentReadHistory.map((e) => e[0]);

  const [localRows, onlineRows, readRows] = await Promise.all([
    fetchMetadataBatch(recentLocalIds),
    fetchMetadataBatch(onlineOnlyIds),
    fetchMetadataBatch(recentReadIds),
  ]);

  function processRow(
    row: RecommendationLibBatchRow,
    weight: number,
    source: string
  ): void {
    for (const t of row.tags ?? []) addScore(tagScores, t, weight, source);
    for (const a of parseArr(row.artists))
      addScore(artistScores, a, weight, source);
    for (const p of parseArr(row.parodies))
      addScore(parodyScores, p, weight, source);
    for (const c of parseArr(row.characters))
      addScore(characterScores, c, weight * 0.7, source);
    for (const g of parseArr(row.groups))
      addScore(groupScores, g, weight * 0.7, source);
    for (const l of parseArr(row.languages)) {
      langCount.set(l, (langCount.get(l) ?? 0) + 1);
    }
  }

  for (const row of localRows) processRow(row, 3, "localFavorites");
  for (const row of onlineRows) processRow(row, 2, "onlineFavorites");

  // Read history: recency bonus (+1) for books read within last 7 days
  const now = Date.now();
  const readTsById = new Map(recentReadHistory.map((e) => [e[0], e[3]]));
  for (const row of readRows) {
    const ts = readTsById.get(Number(row.book_id)) ?? 0;
    const recent = now - ts < 7 * 24 * 3_600_000;
    processRow(row, recent ? 3 : 2, "readHistory");
  }

  // ── Signal 5: Search history (lightweight — queries might match names) ───
  for (const query of searchHistory.slice(0, 10)) {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) continue;
    addScore(tagScores, q, 1, "searchHistory");
    addScore(artistScores, q, 1, "searchHistory");
    addScore(parodyScores, q, 1, "searchHistory");
  }

  const languages = [...langCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  return {
    tags: mapToSorted(tagScores),
    artists: mapToSorted(artistScores),
    parodies: mapToSorted(parodyScores),
    characters: mapToSorted(characterScores),
    groups: mapToSorted(groupScores),
    languages,
    seenIds,
    totalLocalFavorites: localFavIds.length,
    totalOnlineFavorites: onlineFavIds.length,
    totalReadHistory: readHistory.length,
    totalTagFavs,
    totalSearchHistory: searchHistory.length,
  };
}

// ─── Query execution ──────────────────────────────────────────────────────────

interface QueryDef {
  label: string;
  params: Record<string, string>;
  /** Score of the preference term driving this query. */
  termScore: number;
}

async function executeQuery(
  params: Record<string, string>
): Promise<RecommendationLibBatchRow[]> {
  const base = nhappApiBase();
  const qs = new URLSearchParams({
    ...params,
    limit: "50",
    order: "desc",
    sort_by: "uploaded_at",
  }).toString();
  try {
    const res = await fetch(`${base}/api/recommendation-lib/books?${qs}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { books: RecommendationLibBatchRow[] };
    return data.books ?? [];
  } catch {
    return [];
  }
}

// ─── Relevance scoring ────────────────────────────────────────────────────────

interface ScoringCtx {
  tagMap: Map<string, number>;
  artistMap: Map<string, number>;
  parodyMap: Map<string, number>;
  charMap: Map<string, number>;
  groupMap: Map<string, number>;
  preferredLang: string | null;
}

function buildScoringCtx(profile: RecommendationProfile): ScoringCtx {
  return {
    tagMap: new Map(profile.tags.map((t) => [t.name, t.score])),
    artistMap: new Map(profile.artists.map((t) => [t.name, t.score])),
    parodyMap: new Map(profile.parodies.map((t) => [t.name, t.score])),
    charMap: new Map(profile.characters.map((t) => [t.name, t.score])),
    groupMap: new Map(profile.groups.map((t) => [t.name, t.score])),
    preferredLang: profile.languages[0] ?? null,
  };
}

function computeAdditionalScore(
  row: RecommendationLibBatchRow,
  ctx: ScoringCtx
): number {
  let bonus = 0;

  // Tags (only available from batch endpoint; absent from list endpoint)
  for (const t of row.tags ?? []) {
    const s = ctx.tagMap.get(t.toLowerCase());
    if (s) bonus += s * 0.3;
  }

  // Metadata fields present in both endpoints
  for (const a of parseArr(row.artists)) {
    const s = ctx.artistMap.get(a.toLowerCase());
    if (s) bonus += s * 0.5;
  }
  for (const p of parseArr(row.parodies)) {
    const s = ctx.parodyMap.get(p.toLowerCase());
    if (s) bonus += s * 0.5;
  }
  for (const c of parseArr(row.characters)) {
    const s = ctx.charMap.get(c.toLowerCase());
    if (s) bonus += s * 0.3;
  }
  for (const g of parseArr(row.groups)) {
    const s = ctx.groupMap.get(g.toLowerCase());
    if (s) bonus += s * 0.3;
  }

  // Language match: +10% multiplier on bonus
  if (ctx.preferredLang) {
    const langs = parseArr(row.languages);
    if (langs.includes(ctx.preferredLang)) bonus *= 1.1;
  }

  return bonus;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates personalized recommendations.
 * Results are cached — call clearRecommendationCache() to force a refresh.
 */
export async function generateRecommendations(): Promise<RecommendationResult> {
  if (_cache) return _cache;

  await initCdn();
  const profile = await buildRecommendationProfile();

  const hasSignals =
    profile.tags.length > 0 ||
    profile.artists.length > 0 ||
    profile.parodies.length > 0;

  if (!hasSignals) {
    const empty: RecommendationResult = {
      books: [],
      profile,
      queriesUsed: [],
      generatedAt: Date.now(),
    };
    _cache = empty;
    return empty;
  }

  // ── Build query plan ────────────────────────────────────────────────────
  const queryDefs: QueryDef[] = [];

  // Top 5 content tags
  for (const term of profile.tags.slice(0, 5)) {
    queryDefs.push({
      label: `tag: "${term.name}"`,
      params: { tags: term.name },
      termScore: term.score,
    });
  }

  // Top 3 artists (weight ×1.5 — artist is a strong preference signal)
  for (const term of profile.artists.slice(0, 3)) {
    queryDefs.push({
      label: `artist: "${term.name}"`,
      params: { artists: term.name },
      termScore: term.score * 1.5,
    });
  }

  // Top 2 parodies (franchise/series is also a strong signal)
  for (const term of profile.parodies.slice(0, 2)) {
    queryDefs.push({
      label: `parody: "${term.name}"`,
      params: { parodies: term.name },
      termScore: term.score * 1.5,
    });
  }

  // ── Execute all queries in parallel ────────────────────────────────────
  const queryResults = await Promise.all(
    queryDefs.map(async (def) => ({
      def,
      rows: await executeQuery(def.params),
    }))
  );

  // ── Accumulate scores per book ─────────────────────────────────────────
  // bookId → { first-seen row, cumulative query-match score }
  const bookScores = new Map<number, number>();
  const bookRows = new Map<number, RecommendationLibBatchRow>();

  for (const { def, rows } of queryResults) {
    for (const row of rows) {
      const id = Number(row.book_id);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (profile.seenIds.has(id)) continue;

      // Accumulate query-match scores across all queries that found this book
      bookScores.set(id, (bookScores.get(id) ?? 0) + def.termScore);
      if (!bookRows.has(id)) bookRows.set(id, row);
    }
  }

  // ── Final scoring: query-match + cross-signal bonuses ─────────────────
  const ctx = buildScoringCtx(profile);

  const scored = [...bookRows.entries()]
    .map(([id, row]) => ({
      row,
      score:
        (bookScores.get(id) ?? 0) + computeAdditionalScore(row, ctx),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 150);

  const rawBooks = scored.map(({ row }) =>
    recommendationLibRowToBook({ ...row, tags: row.tags ?? [] })
  );

  const books = await hydrateMissingThumbnails(rawBooks);

  const result: RecommendationResult = {
    books,
    profile,
    queriesUsed: queryDefs.map((d) => d.label),
    generatedAt: Date.now(),
  };

  _cache = result;
  return result;
}
