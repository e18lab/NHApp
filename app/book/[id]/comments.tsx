import type { GalleryComment } from "@/api/nhappApi/types";
import { getGallery, getGalleryComments, getMe, deleteComment } from "@/api/v2";
import type { Comment as ApiComment } from "@/api/v2";
import { commentToGalleryComment } from "@/api/v2/compat";
import CommentCard from "@/components/CommentCard";
import CommentComposer from "@/components/CommentComposer";
import LoadingSpinner from "@/components/LoadingSpinner";
import { FilterDropdown, SelectItem } from "@/components/uikit/FilterDropdown";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";

const PAGE_SIZE = 20;

function absUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  if (/^https?:\/\//.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("/")) return "https://i1.nhentai.net" + s;
  return "https://i1.nhentai.net/" + s;
}

export default function CommentsScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string | string[] }>();
  const galleryId = Number(id);
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const titleStr = useMemo(() => {
    const raw = Array.isArray(title) ? title[0] : title;
    const s = typeof raw === "string" ? raw : "";
    return s.trim();
  }, [title]);

  useEffect(() => {
    if (!galleryId || galleryId <= 0) return;
    let cancelled = false;
    const apply = (v: string) => {
      const s = (v || "").trim();
      if (!s) return;
      router.setParams({ title: s });
    };
    if (titleStr) { apply(titleStr); return; }
    (async () => {
      try {
        const g = await getGallery(galleryId);
        if (cancelled) return;
        const pretty = (g as any)?.title?.pretty;
        if (typeof pretty === "string") apply(pretty);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [galleryId, router, titleStr]);

  // Current user
  const [myUserId, setMyUserId] = useState<number | undefined>();
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | undefined>();
  const [myUsername, setMyUsername] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    getMe()
      .then((me) => {
        if (!alive) return;
        setMyUserId(me?.id ?? undefined);
        setMyAvatarUrl(me?.avatar_url ?? undefined);
        setMyUsername(me?.username ?? undefined);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Comments state
  const [allComments, setAllComments] = useState<GalleryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [localNew, setLocalNew] = useState<GalleryComment[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const listRef = useRef<FlatList>(null);

  const fetchComments = useCallback(async () => {
    if (!galleryId || galleryId <= 0) return;
    try {
      setLoading(true);
      const cs = await getGalleryComments(galleryId);
      setAllComments(cs.map(commentToGalleryComment));
    } catch {
      setAllComments([]);
    } finally {
      setLoading(false);
    }
  }, [galleryId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Sync avatar for locally added comments
  useEffect(() => {
    if (!myAvatarUrl && !myUsername && !myUserId) return;
    setLocalNew((prev) =>
      prev.map((c) => {
        const hasAvatar = (c as any).avatar || (c.poster as any)?.avatar_url || (c.poster as any)?.avatar;
        if (!hasAvatar) {
          const poster = {
            ...(c.poster as any),
            id: (c.poster as any)?.id ?? myUserId,
            username: (c.poster as any)?.username ?? myUsername,
            avatar_url: absUrl((c.poster as any)?.avatar_url) ?? absUrl(myAvatarUrl),
          };
          return { ...c, poster, avatar: absUrl((c as any).avatar) ?? absUrl(myAvatarUrl) } as any;
        }
        return c;
      })
    );
  }, [myAvatarUrl, myUsername, myUserId]);

  const makeKey = (c: GalleryComment) => {
    const cid = c.id as number | undefined;
    if (cid) return `id:${cid}`;
    const uid = (c.poster as any)?.id ?? (c.poster as any)?.username ?? "u";
    const ts = typeof c.post_date === "number" ? c.post_date : Date.parse(String(c.post_date ?? "")) || 0;
    return `tmp:${uid}|${ts}|${(c.body || "").slice(0, 48)}`;
  };

  const mergedComments = useMemo(() => {
    const seen = new Set<string>();
    const out: GalleryComment[] = [];
    for (const c of [...localNew, ...allComments]) {
      if (!c) continue;
      const key = makeKey(c);
      if (seen.has(key)) continue;
      const cid = c.id as number | undefined;
      if (cid && hiddenIds.has(cid)) continue;
      out.push(c);
      seen.add(key);
    }
    return out;
  }, [localNew, allComments, hiddenIds]);

  const totalCount = mergedComments.length;

  const sortedComments = useMemo(() => {
    const toTs = (c: GalleryComment) => {
      const v: any = (c as any)?.post_date;
      if (typeof v === "number") return v > 1e12 ? v : v * 1000;
      const ms = Date.parse(String(v ?? ""));
      return Number.isFinite(ms) ? ms : 0;
    };
    const dir = sort === "newest" ? -1 : 1;
    return mergedComments.slice().sort((a, b) => (toTs(a) - toTs(b)) * dir);
  }, [mergedComments, sort]);

  // When sort changes: reset visible count and scroll to top
  const prevSort = useRef(sort);
  useEffect(() => {
    if (prevSort.current === sort) return;
    prevSort.current = sort;
    setVisibleCount(PAGE_SIZE);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [sort]);

  const visibleComments = sortedComments.slice(0, visibleCount);
  const hasMore = visibleCount < totalCount;

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    // Defer so scroll isn't janky
    setTimeout(() => {
      setVisibleCount((n) => Math.min(n + PAGE_SIZE, totalCount));
      setLoadingMore(false);
    }, 100);
  }, [hasMore, loadingMore, totalCount]);

  const toGalleryComment = (c: ApiComment): GalleryComment => {
    const poster = (c.poster as any) || {};
    const avatar = absUrl(poster.avatar_url || poster.avatar) || absUrl(myAvatarUrl) || "";
    const username = poster.username || myUsername || "user";
    const uid = poster.id ?? myUserId;
    return {
      id: c.id,
      gallery_id: c.gallery_id,
      body: c.body,
      post_date: c.post_date,
      poster: {
        ...poster,
        id: uid,
        username,
        avatar_url: avatar,
        slug: (poster.slug || poster.username || username || "user").toLowerCase(),
      } as any,
      avatar,
    };
  };

  const handleSubmitted = async (c: ApiComment) => {
    setLocalNew((prev) => [toGalleryComment(c), ...prev]);
    setVisibleCount((n) => Math.max(n, 1));
    try { await fetchComments(); } catch {}
  };

  const handleDelete = async (cid?: number) => {
    if (!cid) return;
    await deleteComment(cid);
    setHiddenIds((prev) => { const next = new Set(prev); next.add(cid); return next; });
    try { await fetchComments(); } catch {}
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item: c }: { item: GalleryComment }) => {
      const pid = Number(c?.poster?.id);
      const isMine =
        Number.isFinite(pid) && Number.isFinite(myUserId as number) && pid === myUserId;
      return (
        <CommentCard
          key={c.id ?? `${c.post_date}-${c.poster?.username ?? "u"}`}
          id={c.id}
          body={c.body}
          post_date={c.post_date}
          poster={c.poster as any}
          avatar={(c as any).avatar}
          highlight={isMine}
          mineLabel={isMine ? t("comments.youComment") : undefined}
          onPressName={() => {
            const posterId = c?.poster?.id;
            if (!posterId) return;
            const slug = (
              (c.poster as any).slug || (c.poster as any).username || "user"
            ).toLowerCase();
            router.push({ pathname: "/profile/[id]/[slug]", params: { id: String(posterId), slug } });
          }}
          onDelete={handleDelete}
        />
      );
    },
    [myUserId, t, router]
  );

  const ListHeader = useMemo(() => {
    if (!myUserId) return null;
    return (
      <View style={{ paddingBottom: 16 }}>
        <CommentComposer
          galleryId={galleryId}
          placeholder={t("comments.writeComment")}
          onSubmitted={handleSubmitted}
        />
      </View>
    );
  }, [myUserId, galleryId, t]);

  const ListFooter = useMemo(() => {
    if (loading) return null;
    if (loadingMore) {
      return (
        <View style={s.footerLoader}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      );
    }
    return <View style={{ height: 32 }} />;
  }, [loading, loadingMore, colors.accent]);

  const SortBar = useMemo(() => {
    const countLabel =
      t("comments.totalCount", { count: totalCount }) || `${totalCount} total`;

    const groupLabel =
      sort === "newest"
        ? t("comments.sort.newest") || "Newest first"
        : t("comments.sort.oldest") || "Oldest first";

    const options: SelectItem[] = [
      { value: "newest", label: t("comments.sort.newest") || "Newest first" },
      { value: "oldest", label: t("comments.sort.oldest") || "Oldest first" },
    ];

    return (
      <View style={s.sortRow}>
        <Text style={[s.count, { color: colors.sub }]} numberOfLines={1}>
          {countLabel}
        </Text>
        <FilterDropdown
          value={sort}
          onChange={(v) => setSort(v as any)}
          options={options}
          placeholder={groupLabel}
          variant="ghost"
          minWidth={170}
          style={s.dd}
          trigger={({ open, onPress }) => (
            <Pressable
              onPress={onPress}
              style={[
                s.sortBtn,
                {
                  backgroundColor:
                    (colors as any).surfaceElevated ??
                    (colors as any).searchBg ??
                    (colors as any).page ??
                    colors.bg,
                },
              ]}
            >
              <Feather name="sliders" size={16} color={colors.sub} />
              <Text style={[s.sortBtnText, { color: colors.sub }]} numberOfLines={1}>
                {groupLabel}
              </Text>
              <Feather
                name={open ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.sub}
              />
            </Pressable>
          )}
        />
      </View>
    );
  }, [t, totalCount, sort, colors.sub, colors]);

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.sortWrap, { borderBottomColor: colors.tagBg, backgroundColor: colors.bg }]}>
        {SortBar}
      </View>

      {loading ? (
        <LoadingSpinner fullScreen size="large" color={colors.accent} />
      ) : (
        <FlatList
          ref={listRef}
          data={visibleComments}
          keyExtractor={(c) =>
            String(c.id ?? `${c.post_date}-${c.poster?.username ?? "u"}`)
          }
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Feather name="message-circle" size={48} color={colors.metaText} />
              <Text style={[s.emptyTxt, { color: colors.metaText }]}>No comments yet</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          initialNumToRender={PAGE_SIZE}
          maxToRenderPerBatch={PAGE_SIZE}
          windowSize={7}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  sortWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 12,
  },
  count: { fontSize: 13, fontWeight: "700" },
  dd: { maxWidth: 260 },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    minHeight: 42,
  },
  sortBtnText: { fontSize: 15, fontWeight: "600", letterSpacing: 0.2 },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },

  emptyWrap: {
    paddingTop: 80,
    alignItems: "center",
    gap: 14,
  },
  emptyTxt: { fontSize: 16, fontWeight: "500" },
});
