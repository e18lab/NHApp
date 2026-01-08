import type { Book, GalleryComment } from "@/api/nhentai";
import { deleteCommentById, type ApiComment } from "@/api/online/comments";
import BookList from "@/components/BookList";
import CommentCard from "@/components/CommentCard";
import CommentComposer from "@/components/CommentComposer";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const s = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 2,
  },
  galleryLabel: { fontSize: 16, fontWeight: "700", letterSpacing: 0.6 },
  showMoreBtn: {
    marginTop: 16,
    alignSelf: "center",
    borderWidth: 2,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  showMoreTxt: { fontWeight: "700", fontSize: 14, letterSpacing: 0.3 },
  sectionBookList: { marginHorizontal: -16 },
});

function absUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("/")) return "https://nhentai.net" + s;
  return s;
}

export default function Footer({
  galleryId,
  related,
  relLoading,
  refetchRelated,
  favorites,
  toggleFav,
  baseGrid,
  allComments,
  visibleCount,
  setVisibleCount,
  cmtLoading,
  innerPadding,
  myUserId,
  myAvatarUrl,
  myUsername,
  refetchComments,
  onCommentSectionLayout,
}: {
  galleryId: number;
  related: Book[];
  relLoading: boolean;
  refetchRelated: () => Promise<void>;
  favorites: Set<number>;
  toggleFav: (bid: number, next: boolean) => void;
  baseGrid: any;
  allComments: GalleryComment[];
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  cmtLoading: boolean;
  innerPadding: number;
  myUserId?: number;
  myAvatarUrl?: string;
  myUsername?: string;
  refetchComments?: () => Promise<void>;
  onCommentSectionLayout?: (offset: number) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const ui = { text: colors.txt, accent: colors.accent };

  const oneRowGrid = useMemo(
    () => ({
      ...baseGrid,
      numColumns: Math.min(5, related.length || 5),
      paddingHorizontal: innerPadding * 1.9,
      columnGap: 12,
      minColumnWidth: 180,
    }),
    [baseGrid, related.length, innerPadding]
  );

  const [localNew, setLocalNew] = useState<GalleryComment[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

  const makeKey = (c: GalleryComment) => {
    const id = c.id as number | undefined;
    if (id) return `id:${id}`;
    const uid =
      (c.poster as any)?.id ??
      (c.poster as any)?.username ??
      (c.poster as any)?.slug ??
      "u";
    const ts =
      typeof c.post_date === "number"
        ? c.post_date
        : Date.parse(String(c.post_date ?? "")) || 0;
    const bodyHead = (c.body || "").slice(0, 48);
    return `tmp:${uid}|${ts}|${bodyHead}`;
  };

  const mergeUnique = (a: GalleryComment[], b: GalleryComment[]) => {
    const seen = new Set<string>();
    const out: GalleryComment[] = [];
    for (const c of [...a, ...b]) {
      if (!c) continue;
      const key = makeKey(c);
      if (seen.has(key)) continue;
      const id = c.id as number | undefined;
      if (id && hiddenIds.has(id)) continue;
      out.push(c);
      seen.add(key);
    }
    return out;
  };

  const mergedComments = useMemo(
    () => mergeUnique(localNew, allComments),
    [localNew, allComments, hiddenIds]
  );

  const totalCount = mergedComments.length;
  const visibleComments = mergedComments.slice(0, visibleCount);
  const hasMore = visibleCount < totalCount;

  const toGalleryComment = (c: ApiComment): GalleryComment => {
    const poster = (c.poster as any) || {};
    const avatar =
      absUrl(poster.avatar_url || poster.avatar) || absUrl(myAvatarUrl) || "";

    const username = poster.username || myUsername || "user";

    // Для нового комментария используем ID из poster или myUserId
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
        // Убеждаемся, что slug есть (для навигации) и в нижнем регистре
        slug: (poster.slug || poster.username || username || 'user').toLowerCase(),
      } as any,
      avatar,
    };
  };

  const handleSubmitted = async (c: ApiComment) => {
    setLocalNew((prev) => [toGalleryComment(c), ...prev]);
    setVisibleCount((n) => Math.max(n, 1));
    try {
      await refetchComments?.();
    } catch {}
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    await deleteCommentById(id);
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      await refetchComments?.();
    } catch {}
  };

  useEffect(() => {
    if (!myAvatarUrl && !myUsername && !myUserId) return;
    setLocalNew((prev) =>
      prev.map((c) => {
        const hasAvatar =
          (c as any).avatar ||
          (c.poster as any)?.avatar_url ||
          (c.poster as any)?.avatar;

        if (!hasAvatar) {
          const poster = {
            ...(c.poster as any),
            id: (c.poster as any)?.id ?? myUserId,
            username: (c.poster as any)?.username ?? myUsername,
            avatar_url:
              absUrl((c.poster as any)?.avatar_url) ?? absUrl(myAvatarUrl),
          };
          return {
            ...c,
            poster,
            avatar: absUrl((c as any).avatar) ?? absUrl(myAvatarUrl),
          } as any;
        }
        return c;
      })
    );
  }, [myAvatarUrl, myUsername, myUserId]);

  return (
    <View style={{ paddingTop: 24 }}>
      {}
      <View style={s.sectionHead}>
        <Text
          style={[
            s.galleryLabel,
            {
              paddingHorizontal: innerPadding,
              paddingBottom: 16,
              color: ui.text,
            },
          ]}
        >
          {t("related")}
        </Text>
      </View>

      <View style={[s.sectionBookList, { marginHorizontal: -innerPadding }]}>
        <BookList
          data={related}
          loading={relLoading}
          refreshing={false}
          onRefresh={refetchRelated}
          isFavorite={(bid) => favorites.has(bid)}
          onToggleFavorite={toggleFav}
          onPress={(bid) =>
            router.push({
              pathname: "/book/[id]",
              params: {
                id: String(bid),
                title: related.find((b) => b.id === bid)?.title.pretty,
              },
            })
          }
          gridConfig={{ default: oneRowGrid }}
          horizontal
        />
      </View>

      {}
      <View 
        style={[s.sectionHead, { marginTop: 32 }]}
        ref={(ref) => {
          if (ref && onCommentSectionLayout) {
            // Используем setTimeout для измерения после рендера
            setTimeout(() => {
              ref.measureInWindow((x, y, width, height, pageX, pageY) => {
                // Сохраняем примерную позицию для прокрутки
                // В реальности позиция будет рассчитываться динамически
                if (onCommentSectionLayout) {
                  onCommentSectionLayout(y);
                }
              });
            }, 100);
          }
        }}
      >
        <Text
          style={[
            s.galleryLabel,
            {
              paddingHorizontal: innerPadding,
              paddingBottom: 10,
              color: ui.text,
            },
          ]}
        >
          {t("comments.title")} ({totalCount})
        </Text>
      </View>

      {}
      {!!myUserId && (
        <View style={{ paddingHorizontal: innerPadding, marginBottom: 12 }}>
          <CommentComposer
            galleryId={galleryId}
            placeholder={t("comments.writeComment")}
            onSubmitted={handleSubmitted}
          />
        </View>
      )}

      {}
      {cmtLoading ? (
        <View
          style={{
            paddingHorizontal: innerPadding,
            paddingVertical: 32,
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color={ui.accent} />
        </View>
      ) : (
        <View
          style={{ paddingHorizontal: innerPadding, gap: 8, paddingBottom: 24 }}
        >
          {visibleComments.map((c) => {
            const pid = Number(c?.poster?.id);
            const isMine =
              Number.isFinite(pid) &&
              Number.isFinite(myUserId as number) &&
              pid === myUserId;

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
                  if (!posterId) {
                    console.warn('[Footer] No poster ID for comment:', c);
                    return;
                  }
                  const slug = (
                    (c.poster as any).slug ||
                    (c.poster as any).username ||
                    "user"
                  ).toLowerCase();
                  router.push({
                    pathname: "/profile/[id]/[slug]",
                    params: {
                      id: String(posterId),
                      slug: String(slug),
                    },
                  });
                }}
                onDelete={handleDelete}
              />
            );
          })}

          {hasMore && (
            <Pressable
              onPress={() =>
                setVisibleCount((n) => Math.min(n + 20, totalCount))
              }
              style={[
                s.showMoreBtn,
                {
                  borderColor: ui.accent,
                  backgroundColor: "transparent",
                  borderRadius: 18,
                  overflow: "hidden",
                },
              ]}
              android_ripple={{
                color: `${ui.accent}22`,
                borderless: false,
                foreground: true,
              }}
            >
              <Text style={[s.showMoreTxt, { color: ui.accent }]}>
                {t("showMore", {
                  count: Math.min(20, totalCount - visibleCount),
                })}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
