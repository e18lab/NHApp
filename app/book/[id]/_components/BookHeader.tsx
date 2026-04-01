import {
  createCharacterCard,
  getCharactersWithCards,
  getGlobalCharacterCardForCharacter,
  Rect,
} from "@/api/nhappApi/characterCards";
import type { Book } from "@/api/nhappApi/types";
import { buildImageFallbacks } from "@/components/buildImageFallbacks";
import { CharacterCropModal } from "@/components/CharacterCropModal";
import { CharacterSelectModal } from "@/components/CharacterSelectModal";
import ExpoImage from "@/components/ExpoImageCompat";
import Ring from "@/components/book/Ring";
import TagBlock, { TagLite } from "@/components/book/TagBlock";
import { useOnlineFavorite } from "@/hooks/book/useOnlineFavorite";
import { useOnlineMe } from "@/hooks/useOnlineMe";
import { useI18n } from "@/lib/i18n/I18nContext";
import { useTheme } from "@/lib/ThemeContext";
import { timeAgo } from "@/utils/book/timeAgo";
import { Feather, FontAwesome, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { isElectron, openReaderWindow, showMessageBox } from "@/electron/bridge";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (!n || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function normalizeNhentaiImageUrl(url: string): string {
  return url.replace(/\/(\d+)w\.(jpg|jpeg|png|gif)$/i, "/$1.$2");
}

const READ_HISTORY_KEY = "readHistory";
type ReadHistoryEntry = [number, number, number, number];
type CharacterTag = TagLite & { hasCard?: boolean };

// ─── Page Picker Modal ───────────────────────────────────────────────────────

const PagePickerModal: React.FC<{
  visible: boolean;
  pagesCount: number;
  getPageImageUri: (i: number) => string;
  onClose: () => void;
  onSelect: (i: number, uri: string) => void;
}> = ({ visible, pagesCount, getPageImageUri, onClose, onSelect }) => {
  const pages = Array.from({ length: Math.max(1, pagesCount) }, (_, i) => i + 1);
  if (!visible) return null;
  return (
    <Modal visible statusBarTranslucent animationType="fade" transparent onRequestClose={onClose}>
      <View style={ps.backdrop}>
        <View style={ps.modal}>
          <Text style={ps.title}>Select a page for character card</Text>
          <FlatList
            horizontal data={pages} keyExtractor={(i) => String(i)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => onSelect(item, getPageImageUri(item))} style={ps.pageItem}>
                <ExpoImage source={{ uri: getPageImageUri(item) }} style={ps.pageImage} contentFit="cover" cachePolicy="memory-disk" transition={0} />
                <View style={ps.pageLabel}><Text style={ps.pageLabelText}>{item}</Text></View>
              </Pressable>
            )}
          />
          <Pressable style={ps.closeBtn} onPress={onClose}>
            <Text style={ps.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const ps = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modal: { width: "90%", borderRadius: 20, padding: 16, backgroundColor: "#111" },
  title: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 10 },
  pageItem: { width: 90, height: 130, borderRadius: 12, marginHorizontal: 4, overflow: "hidden", backgroundColor: "#222" },
  pageImage: { width: "100%", height: "100%" },
  pageLabel: { position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center" },
  pageLabelText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  closeBtn: { marginTop: 10, alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "#333" },
  closeText: { color: "#fff", fontSize: 13, fontWeight: "500" },
});

// ─── Main component ──────────────────────────────────────────────────────────

export default function BookHeader({
  book,
  containerW,
  pad,
  wide,
  cols,
  cycleCols,
  dl,
  pr,
  local,
  handleDownloadOrDelete,
  cancel,
  modeOf,
  onTagPress,
  win,
  innerPadding,
  cycle,
  commentCount,
  bookmarked,
  onToggleBookmark,
}: {
  book: Book;
  containerW: number;
  pad: number;
  wide: boolean;
  cols: number;
  cycleCols: () => void;
  dl: boolean;
  pr: number;
  local: boolean;
  handleDownloadOrDelete: () => void;
  cancel: () => void;
  modeOf: (t: { type: string; name: string }) => "include" | "exclude" | undefined;
  onTagPress: (name: string) => void;
  win: { w: number; h: number };
  innerPadding: number;
  cycle: (t: { type: string; name: string }) => void;
  commentCount: number;
  bookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  const { colors } = useTheme();
  const { t, resolvedDateFns } = useI18n();
  const router = useRouter();
  const me = useOnlineMe();
  const meId = me?.id ?? null;
  const gold = "#F5C542";

  const coverAR = book.coverW && book.coverH ? book.coverW / book.coverH : 3 / 4;

  // Online favorites
  const initialOnlineLiked =
    typeof (book as any)?.raw?.is_favorited === "boolean"
      ? ((book as any).raw.is_favorited as boolean)
      : undefined;
  const { onlineLiked, toggleOnlineLike, likeLoading } = useOnlineFavorite(
    book.id,
    meId,
    initialOnlineLiked
  );

  // ── Read history ──────────────────────────────────────────────────────────

  const [readBtn, setReadBtn] = useState<{ label: string; page: number; restart: boolean }>({
    label: t("book.read"), page: 1, restart: false,
  });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(READ_HISTORY_KEY);
          if (!alive) return;
          let entry: ReadHistoryEntry | undefined;
          if (raw) {
            try {
              const arr = JSON.parse(raw) as any;
              if (Array.isArray(arr)) entry = arr.find((e: ReadHistoryEntry) => e?.[0] === book.id);
            } catch {}
          }
          if (!entry) { setReadBtn({ label: t("book.read"), page: 1, restart: false }); return; }
          const [, current0, total0] = entry;
          const total = Math.max(1, Number(total0) || book.pagesCount || 1);
          const current = Math.min(Math.max(0, Number(current0) || 0), total - 1);
          const done = current >= total - 1;
          if (done) setReadBtn({ label: t("book.readAgain"), page: 1, restart: true });
          else setReadBtn({ label: t("book.continuePage", { page: current + 1 }), page: current + 1, restart: false });
        } catch { setReadBtn({ label: t("book.read"), page: 1, restart: false }); }
      })();
      return () => { alive = false; };
    }, [book.id, book.pagesCount, t])
  );

  const handleReadPress = useCallback(async () => {
    if (!book.id) return;
    if (isElectron()) {
      const ok = await openReaderWindow(book.id, readBtn.page);
      if (!ok) router.push({ pathname: "/read", params: { id: String(book.id), page: String(readBtn.page) } });
    } else {
      router.push({ pathname: "/read", params: { id: String(book.id), page: String(readBtn.page) } });
    }
  }, [book.id, readBtn.page, router]);

  const openComments = useCallback(() => {
    router.push({
      pathname: "/book/[id]/comments",
      params: { id: String(book.id), title: String(book.title?.pretty ?? "") },
    });
  }, [book.id, book.title?.pretty, router]);

  // ── Tags ──────────────────────────────────────────────────────────────────

  const dedupTags = useMemo(() => {
    const skip = new Set([
      ...(book.artists ?? []), ...(book.characters ?? []), ...(book.parodies ?? []),
      ...(book.groups ?? []), ...(book.categories ?? []), ...(book.languages ?? []),
    ].map((t) => t.name));
    return book.tags.filter((t) => !skip.has(t.name));
  }, [book]);

  // ── Character cards ───────────────────────────────────────────────────────

  const [charactersWithCards, setCharactersWithCards] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCharactersWithCards(book.id)
      .then((n) => { if (!cancelled) setCharactersWithCards(n); })
      .catch(() => { if (!cancelled) setCharactersWithCards([]); });
    return () => { cancelled = true; };
  }, [book.id, refreshKey]);

  const [characterCardsMap, setCharacterCardsMap] = useState<
    Record<string, { imageUrl: string; parodyName: string | null; rect: Rect }>
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!book.characters?.length || !charactersWithCards.length) {
        if (!cancelled) setCharacterCardsMap({});
        return;
      }
      const names = book.characters.map((c) => c.name).filter((n) => charactersWithCards.includes(n));
      if (!names.length) { if (!cancelled) setCharacterCardsMap({}); return; }
      const current = { ...characterCardsMap };
      await Promise.all(names.filter((n) => !current[n]).map(async (name) => {
        try {
          const card = await getGlobalCharacterCardForCharacter(name);
          if (!card) return;
          current[name] = { imageUrl: card.imageUrl, parodyName: card.parodyName ?? null, rect: card.rect };
        } catch {}
      }));
      if (!cancelled) setCharacterCardsMap(current);
    })();
    return () => { cancelled = true; };
  }, [book.characters, charactersWithCards, refreshKey]);

  const characterTagsWithInfo = useMemo<CharacterTag[]>(() => {
    if (!book.characters?.length) return [];
    const withCard: CharacterTag[] = [], withoutCard: CharacterTag[] = [];
    (book.characters as CharacterTag[]).forEach((tag) => {
      const base: CharacterTag = { ...tag };
      const cardInfo = characterCardsMap[tag.name];
      if (charactersWithCards.includes(tag.name) && cardInfo) {
        Object.assign(base, { hasCard: true, cardImageUrl: cardInfo.imageUrl, cardParodyName: cardInfo.parodyName, cardRect: cardInfo.rect });
        withCard.push(base);
      } else {
        if (charactersWithCards.includes(tag.name)) base.hasCard = true;
        withoutCard.push(base);
      }
    });
    return [...withCard, ...withoutCard];
  }, [book.characters, charactersWithCards, characterCardsMap]);

  const availableCharacters = useMemo(() =>
    !book.characters?.length ? [] :
    !charactersWithCards.length ? book.characters.map((c) => c.name) :
    book.characters.map((c) => c.name).filter((n) => !charactersWithCards.includes(n)),
    [book.characters, charactersWithCards]);

  const canAddCards = availableCharacters.length > 0 && !!meId;

  // ── Card modals ───────────────────────────────────────────────────────────

  const [pagePickerVisible, setPagePickerVisible] = useState(false);
  const [cropVisible, setCropVisible] = useState(false);
  const [selectVisible, setSelectVisible] = useState(false);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);
  const [selectedPageImageUri, setSelectedPageImageUri] = useState<string | null>(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const closeAllModals = () => {
    setPagePickerVisible(false); setCropVisible(false); setSelectVisible(false);
    setSelectedPageIndex(null); setSelectedPageImageUri(null); setCurrentRect(null);
    setSubmitError(null); setSubmitting(false);
  };

  const getPageImageUri = (i: number): string => {
    const p = (book as any).pages?.[i - 1];
    if (typeof p === "string") return p;
    if (p?.url) return p.url;
    return book.cover;
  };

  const handleCharacterSelectConfirm = async (characterName: string, parodyName: string | null) => {
    if (!selectedPageIndex || !selectedPageImageUri || !currentRect || submitting || !meId) return;
    setSubmitting(true); setSubmitError(null);
    try {
      await createCharacterCard(book.id, selectedPageIndex, {
        characterName, parodyName,
        imageUrl: normalizeNhentaiImageUrl(selectedPageImageUri),
        cropX: currentRect.x, cropY: currentRect.y,
        cropWidth: currentRect.width, cropHeight: currentRect.height,
        userId: meId,
      });
      closeAllModals();
      setRefreshKey((x) => x + 1);
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to save character card");
      setSubmitting(false);
    }
  };

  // ── Shared blocks ─────────────────────────────────────────────────────────

  /** [🔖] [❤️] [💬] [⬇️] pill buttons row */
  const ActionPills = () => (
    <View style={[s.actionsRow, { marginTop: 16 }]}>
      {/* Download — first */}
      {!dl && !local && (
        <Pressable
          onPress={handleDownloadOrDelete}
          style={[s.pill, { borderColor: colors.metaText + "50" }]}
          android_ripple={{ color: colors.accent + "22", borderless: false }}
          accessibilityLabel={t("download") || "Download"}
        >
          <Feather name="download" size={15} color={colors.metaText} />
        </Pressable>
      )}
      {!dl && local && (
        <Pressable
          onPress={async () => {
            const title = t("book.removeDownload") || "Remove download";
            const message =
              t("book.removeDownloadConfirm") ||
              "Delete this downloaded book from device?";

            if (isElectron()) {
              const res = await showMessageBox({
                type: "warning",
                title,
                message,
                buttons: [t("common.cancel") || "Cancel", t("common.delete") || "Delete"],
                defaultId: 0,
                cancelId: 0,
              });
              if (res) {
                if (res.response === 1) handleDownloadOrDelete();
                return;
              }

              if (typeof window !== "undefined" && typeof window.confirm === "function") {
                if (window.confirm(`${title}\n\n${message}`)) handleDownloadOrDelete();
                return;
              }
              return;
            }

            Alert.alert(title, message, [
              { text: t("common.cancel") || "Cancel", style: "cancel" },
              {
                text: t("common.delete") || "Delete",
                style: "destructive",
                onPress: handleDownloadOrDelete,
              },
            ]);
          }}
          style={[s.pill, { borderColor: colors.accent, backgroundColor: colors.accent + "14" }]}
          android_ripple={{ color: colors.accent + "22", borderless: false }}
          accessibilityLabel={t("book.removeDownload") || "Remove download"}
        >
          <Feather name="trash-2" size={15} color={colors.accent} />
        </Pressable>
      )}
      {dl && (
        <Pressable
          onPress={cancel}
          style={[s.pill, { borderColor: colors.accent, backgroundColor: colors.accent + "12" }]}
          android_ripple={{ color: colors.accent + "22", borderless: false }}
          accessibilityLabel={t("cancel") || "Cancel"}
        >
          <View style={s.ringWrap}>
            <Ring progress={pr} size={20} />
            <View style={s.ringInner}>
              <Feather name="x" size={10} color={colors.accent} />
            </View>
          </View>
        </Pressable>
      )}

      {/* Bookmark */}
      <Pressable
        onPress={onToggleBookmark}
        style={[
          s.pill,
          !wide && s.pillStretchMobile,
          {
            borderColor: bookmarked ? gold : colors.metaText + "50",
            backgroundColor: bookmarked ? gold + "1A" : "transparent",
          },
        ]}
        android_ripple={{ color: colors.accent + "22", borderless: false }}
      >
        <Feather name="bookmark" size={15} color={bookmarked ? gold : colors.metaText} />
      </Pressable>

      {/* Comments */}
      <Pressable
        onPress={openComments}
        style={[s.pill, { borderColor: colors.metaText + "50" }]}
        android_ripple={{ color: colors.accent + "22", borderless: false }}
      >
        <Feather name="message-square" size={15} color={colors.metaText} />
        {commentCount > 0 && (
          <Text style={[s.pillTxt, { color: colors.metaText }]}>
            {fmtNum(commentCount)}
          </Text>
        )}
      </Pressable>

      {/* Online like — last, only when authenticated */}
      {!!meId && (
        <Pressable
          onPress={toggleOnlineLike}
          disabled={likeLoading}
          style={[s.pill, {
            borderColor: onlineLiked ? "#FF5A5F" : colors.metaText + "50",
            backgroundColor: onlineLiked ? "#FF5A5F1A" : "transparent",
          }]}
          android_ripple={{ color: "#FF5A5F22", borderless: false }}
        >
          {likeLoading ? (
            <ActivityIndicator size={14} color="#FF5A5F" />
          ) : (
            <FontAwesome
              name={onlineLiked ? "heart" : "heart-o"}
              size={14}
              color={onlineLiked ? "#FF5A5F" : colors.metaText}
            />
          )}
          <Text style={[s.pillTxt, { color: onlineLiked ? "#FF5A5F" : colors.metaText }]}>
            {fmtNum(book.favorites)}
          </Text>
        </Pressable>
      )}
    </View>
  );

  /** Big read button only */
  const ReadRow = () => (
    <View style={{ marginTop: 14, borderRadius: 999, overflow: "hidden" }}>
      <Pressable
        onPress={handleReadPress}
        style={[s.readBtn, { backgroundColor: colors.accent }]}
        android_ripple={{ color: "#ffffff22", borderless: false }}
      >
        <Feather name={readBtn.restart ? "rotate-ccw" : "book-open"} size={18} color={colors.bg} />
        <Text style={[s.readTxt, { color: colors.bg }]}>{readBtn.label}</Text>
      </Pressable>
    </View>
  );

  /** Metadata rows */
  const MetaBlock = () => (
    <View style={s.metaBlock}>
      <View style={s.metaRow}>
        <Feather name="hash" size={13} color={colors.metaText} />
        <Pressable onLongPress={() => Clipboard.setStringAsync(String(book.id))}>
          <Text style={[s.metaText, { color: colors.metaText }]}>{book.id}</Text>
        </Pressable>
        <Text style={[s.metaDot, { color: colors.metaText }]}>·</Text>
        <Feather name="calendar" size={13} color={colors.metaText} />
        <Text style={[s.metaText, { color: colors.metaText }]}>{timeAgo(book.uploaded, resolvedDateFns)}</Text>
        <Text style={[s.metaDot, { color: colors.metaText }]}>·</Text>
        <Feather name="book-open" size={13} color={colors.metaText} />
        <Text style={[s.metaText, { color: colors.metaText }]}>{book.pagesCount} {t("book.pages") || "стр."}</Text>
      </View>

      {!!book.scanlator && (
        <View style={s.metaRow}>
          <Feather name="edit-3" size={13} color={colors.metaText} />
          <Text style={[s.metaText, { color: colors.metaText }]}>Scanlated by {book.scanlator}</Text>
        </View>
      )}
    </View>
  );

  /** All tag blocks */
  const TagsBlock = () => (
    <>
      <TagBlock label={t("tags.artists")} tags={book.artists as TagLite[]} modeOf={modeOf} cycle={cycle} onTagPress={onTagPress} />
      <TagBlock
        label={t("tags.characters")}
        tags={characterTagsWithInfo as TagLite[]}
        modeOf={modeOf} cycle={cycle} onTagPress={onTagPress}
        renderLabelExtra={canAddCards ? (
          <Pressable onPress={() => { setSubmitError(null); setSelectedPageIndex(null); setSelectedPageImageUri(null); setCurrentRect(null); setPagePickerVisible(true); }} hitSlop={8} style={{ paddingHorizontal: 4, paddingVertical: 2 }}>
            <Feather name="settings" size={15} color={colors.metaText} />
          </Pressable>
        ) : null}
      />
      <TagBlock label={t("tags.parodies")} tags={book.parodies as TagLite[]} modeOf={modeOf} cycle={cycle} onTagPress={onTagPress} />
      <TagBlock label={t("tags.groups")} tags={book.groups as TagLite[]} modeOf={modeOf} cycle={cycle} onTagPress={onTagPress} />
      <TagBlock label={t("tags.categories")} tags={book.categories as TagLite[]} modeOf={modeOf} cycle={cycle} onTagPress={onTagPress} />
      <TagBlock label={t("tags.languages")} tags={book.languages as TagLite[]} modeOf={modeOf} cycle={cycle} onTagPress={onTagPress} />
      <TagBlock label={t("tags.tags")} tags={dedupTags as TagLite[]} modeOf={modeOf} cycle={cycle} onTagPress={onTagPress} />
    </>
  );

  /** Gallery section header with column toggle */
  const GalleryRow = () => (
    <View style={[s.galleryRow, { marginTop: 16, marginBottom: 4 }]}>
      <Text style={[s.galleryLabel, { color: colors.metaText }]}>{t("book.gallery")}</Text>
      <Pressable onPress={cycleCols} style={s.layoutBtn}>
        <Feather name="layout" size={17} color={colors.metaText} />
        <Text style={[s.layoutTxt, { color: colors.metaText }]}>{cols}×</Text>
      </Pressable>
    </View>
  );

  const Modals = () => (
    <>
      <PagePickerModal visible={pagePickerVisible} pagesCount={book.pagesCount || 1} onClose={closeAllModals} onSelect={(page, uri) => { setSelectedPageIndex(page); setSelectedPageImageUri(uri); setPagePickerVisible(false); setCropVisible(true); }} getPageImageUri={getPageImageUri} />
      <CharacterCropModal visible={cropVisible} imageUri={selectedPageImageUri ? normalizeNhentaiImageUrl(selectedPageImageUri) : normalizeNhentaiImageUrl(book.cover)} onCancel={() => { setCropVisible(false); setCurrentRect(null); }} onConfirm={(rect) => { setCurrentRect(rect); setCropVisible(false); setSelectVisible(true); }} />
      <CharacterSelectModal visible={selectVisible} characters={availableCharacters} parodies={(book.parodies ?? []).map((p) => p.name)} onCancel={() => { setSelectVisible(false); setCurrentRect(null); setSelectedPageIndex(null); setSelectedPageImageUri(null); setSubmitError(null); setSubmitting(false); }} onConfirm={handleCharacterSelectConfirm} currentUserId={meId} currentUsername={me?.username ?? null} />
      {submitError && <Text style={s.submitError}>{submitError}</Text>}
    </>
  );

  // ── WIDE (PC / tablet) ────────────────────────────────────────────────────

  if (wide) {
    const coverW = Math.min(280, win.w * 0.26);
    return (
      <View style={{ paddingHorizontal: innerPadding, paddingTop: 20, paddingBottom: 8 }}>
        <View style={s.wideRow}>
          {/* Left: poster */}
          <View style={{ width: coverW }}>
            <Pressable onPress={handleReadPress} style={[s.wideCover, { aspectRatio: coverAR, backgroundColor: colors.page }]}>
              <ExpoImage
                source={buildImageFallbacks(book.cover)}
                style={{ width: "100%", height: "100%" }}
                pointerEvents="none"
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
            </Pressable>
          </View>

          {/* Right: info */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Pressable onLongPress={() => Clipboard.setStringAsync(book.title.pretty)}>
              <Text style={[s.widePrettyTitle, { color: colors.txt }]} numberOfLines={3}>{book.title.pretty}</Text>
            </Pressable>

            {book.title.english && book.title.english !== book.title.pretty && (
              <Pressable onLongPress={() => Clipboard.setStringAsync(book.title.english)}>
                <Text style={[s.subTitle, { color: colors.metaText }]} numberOfLines={2}>{book.title.english}</Text>
              </Pressable>
            )}
            {book.title.japanese && book.title.japanese !== book.title.english && (
              <Pressable onLongPress={() => Clipboard.setStringAsync(book.title.japanese)}>
                <Text style={[s.subTitle, { color: colors.metaText, fontStyle: "italic" }]} numberOfLines={2}>{book.title.japanese}</Text>
              </Pressable>
            )}

            <ActionPills />
            <ReadRow />
            <MetaBlock />
            <TagsBlock />
            <GalleryRow />
            <Modals />
          </View>
        </View>
      </View>
    );
  }

  // ── MOBILE ────────────────────────────────────────────────────────────────

  const contentW = containerW - pad * 2;
  const cardW = contentW * 0.72;

  return (
    <View style={{ paddingHorizontal: pad }}>
      {/* Blurred banner background */}
      <View style={{ width: containerW, alignSelf: "center", aspectRatio: coverAR, overflow: "hidden", position: "relative" }}>
        <ExpoImage source={buildImageFallbacks(book.cover)} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" priority="high" transition={0} />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "#00000066" },
          ]}
        />
        <LinearGradient
          colors={[`${colors.bg}22`, `${colors.bg}dd`, `${colors.bg}ff`]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      {/* Floating cover card */}
      <View style={[s.mobileCard, {
        left: (contentW - cardW) / 2,
        top: contentW * 0.08,
        width: cardW,
        height: cardW / coverAR,
        backgroundColor: colors.page,
      }]}>
        <Pressable onPress={handleReadPress} style={{ width: "100%", height: "100%" }}>
          <ExpoImage
            source={buildImageFallbacks(book.cover)}
            style={{ width: "100%", height: "100%" }}
            pointerEvents="none"
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
          />
        </Pressable>
      </View>

      {/* Content below the card */}
      <View style={{ marginTop: cardW / coverAR + contentW * 0.08 + 14 - contentW / coverAR }}>
        <Pressable onLongPress={() => Clipboard.setStringAsync(book.title.pretty)}>
          <Text style={[s.mobilePrettyTitle, { color: colors.txt }]}>{book.title.pretty}</Text>
        </Pressable>

        {book.title.english && book.title.english !== book.title.pretty && (
          <Pressable onLongPress={() => Clipboard.setStringAsync(book.title.english)}>
            <Text style={[s.subTitle, { color: colors.metaText }]}>{book.title.english}</Text>
          </Pressable>
        )}
        {book.title.japanese && book.title.japanese !== book.title.english && (
          <Pressable onLongPress={() => Clipboard.setStringAsync(book.title.japanese)}>
            <Text style={[s.subTitle, { color: colors.metaText, fontStyle: "italic" }]}>{book.title.japanese}</Text>
          </Pressable>
        )}

        <ActionPills />
        <ReadRow />
        <MetaBlock />
        <TagsBlock />
        <GalleryRow />
        <Modals />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Wide
  wideRow: { flexDirection: "row", gap: 24, alignItems: "flex-start" },
  wideCover: { width: "100%", borderRadius: 16, overflow: "hidden", elevation: 8, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  widePrettyTitle: { fontSize: 23, fontWeight: "800", lineHeight: 29, marginBottom: 4 },

  // Mobile
  mobileCard: { position: "absolute", borderRadius: 20, overflow: "hidden", elevation: 10, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  mobilePrettyTitle: { fontSize: 20, fontWeight: "800", lineHeight: 25, marginBottom: 4 },

  // Shared text
  subTitle: { fontSize: 13, marginBottom: 2 },

  // Pills (Kinopoisk-style action buttons)
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  pillTxt: { fontSize: 13, fontWeight: "600" },
  pillStretchMobile: { flex: 1, justifyContent: "center" },

  // Read row
  readRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  readBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, minHeight: 48 },
  readTxt: { fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },
  ringWrap: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  ringInner: { position: "absolute", alignItems: "center", justifyContent: "center" },

  // Meta block
  metaBlock: { marginTop: 16, gap: 7 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  metaText: { fontSize: 13 },
  metaDot: { fontSize: 13, marginHorizontal: 1, opacity: 0.5 },

  // Gallery header
  galleryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  galleryLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  layoutBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 6 },
  layoutTxt: { fontSize: 12 },

  submitError: { color: "#ff6b6b", fontSize: 12, marginTop: 4 },
});
