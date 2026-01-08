import {
  createCharacterCard,
  getCharactersWithCards,
  getGlobalCharacterCardForCharacter,
  Rect,
} from "@/api/characterCards";
import type { Book } from "@/api/nhentai";
import { buildImageFallbacks } from "@/components/buildImageFallbacks";
import { CharacterCropModal } from "@/components/CharacterCropModal";
import { CharacterSelectModal } from "@/components/CharacterSelectModal";
import { useOnlineMe } from "@/hooks/useOnlineMe";
import { useI18n } from "@/lib/i18n/I18nContext";
import { useTheme } from "@/lib/ThemeContext";
import { timeAgo } from "@/utils/book/timeAgo";
import { Feather, FontAwesome } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import ExpoImage from "@/components/ExpoImageCompat";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { openReaderWindow, isElectron } from "@/electron/bridge";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ring from "./Ring";
import TagBlock, { TagLite } from "./TagBlock";

const READ_HISTORY_KEY = "readHistory";
type ReadHistoryEntry = [number, number, number, number];

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  readBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 10,
  },
  readTxt: { fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },

  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  dlCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dlInner: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

  galleryRow: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  galleryLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  layoutBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 6 },
  layoutTxt: { fontSize: 12 },
});

type CharacterTag = TagLite & {
  hasCard?: boolean;
};

function normalizeNhentaiImageUrl(url: string): string {
  return url.replace(/\/(\d+)w\.(jpg|jpeg|png|gif)$/i, "/$1.$2");
}

export default function Hero({
  book,
  containerW,
  pad,
  wide,
  cols,
  cycleCols,
  liked,
  toggleLike,
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
}: {
  book: Book;
  containerW: number;
  pad: number;
  wide: boolean;
  cols: number;
  cycleCols: () => void;
  liked: boolean;
  toggleLike: () => void;
  dl: boolean;
  pr: number;
  local: boolean;
  handleDownloadOrDelete: () => void;
  cancel: () => void;
  modeOf: (t: {
    type: string;
    name: string;
  }) => "include" | "exclude" | undefined;
  onTagPress: (name: string) => void;
  win: { w: number; h: number };
  innerPadding: number;
  cycle: (t: { type: string; name: string }) => void;
}) {
  const { colors } = useTheme();
  const { t, resolvedDateFns } = useI18n();
  const router = useRouter();

  const me = useOnlineMe();
  const meId = me?.id ?? null;

  const coverAR =
    book.coverW && book.coverH ? book.coverW / book.coverH : 3 / 4;

  const [readBtn, setReadBtn] = useState<{
    label: string;
    page: number;
    restart: boolean;
  }>({
    label: t("book.read"),
    page: 1,
    restart: false,
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
              if (Array.isArray(arr))
                entry = arr.find((e: ReadHistoryEntry) => e?.[0] === book.id);
            } catch {}
          }

          if (!entry) {
            setReadBtn({ label: t("book.read"), page: 1, restart: false });
            return;
          }

          const [, current0, total0] = entry;
          const total = Math.max(1, Number(total0) || book.pagesCount || 1);
          const current = Math.min(
            Math.max(0, Number(current0) || 0),
            total - 1
          );
          const done = current >= total - 1;

          if (done)
            setReadBtn({ label: t("book.readAgain"), page: 1, restart: true });
          else
            setReadBtn({
              label: t("book.continuePage", { page: current + 1 }),
              page: current + 1,
              restart: false,
            });
        } catch {
          setReadBtn({ label: t("book.read"), page: 1, restart: false });
        }
      })();
      return () => {
        alive = false;
      };
    }, [book.id, book.pagesCount, t])
  );

  const dedupTags = useMemo(() => {
    const skip = new Set(
      [
        ...(book.artists ?? []),
        ...(book.characters ?? []),
        ...(book.parodies ?? []),
        ...(book.groups ?? []),
        ...(book.categories ?? []),
        ...(book.languages ?? []),
      ].map((t) => t.name)
    );
    return book.tags.filter((t) => !skip.has(t.name));
  }, [book]);

  const [charactersWithCards, setCharactersWithCards] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadCharacters = async () => {
      try {
        const names = await getCharactersWithCards(book.id);
        if (!cancelled) setCharactersWithCards(names);
      } catch {
        if (!cancelled) setCharactersWithCards([]);
      }
    };

    loadCharacters();

    return () => {
      cancelled = true;
    };
  }, [book.id, refreshKey]);

  const [characterCardsMap, setCharacterCardsMap] = useState<
    Record<string, { imageUrl: string; parodyName: string | null; rect: Rect }>
  >({});

  useEffect(() => {
    let cancelled = false;

    const loadCards = async () => {
      if (!book.characters?.length || !charactersWithCards.length) {
        if (!cancelled) setCharacterCardsMap({});
        return;
      }

      const names = book.characters
        .map((c) => c.name)
        .filter((name) => charactersWithCards.includes(name));

      if (!names.length) {
        if (!cancelled) setCharacterCardsMap({});
        return;
      }

      const current = { ...characterCardsMap };
      const toLoad = names.filter((n) => !current[n]);

      if (!toLoad.length) return;

      await Promise.all(
        toLoad.map(async (name) => {
          try {
            const card = await getGlobalCharacterCardForCharacter(name);
            if (!card) return;
            current[name] = {
              imageUrl: card.imageUrl,
              parodyName: card.parodyName ?? null,
              rect: card.rect,
            };
          } catch {}
        })
      );

      if (!cancelled) setCharacterCardsMap(current);
    };

    loadCards();

    return () => {
      cancelled = true;
    };
  }, [book.characters, charactersWithCards, refreshKey]);

  const characterTagsWithInfo = useMemo<CharacterTag[]>(() => {
    if (!book.characters?.length) return [];

    const withCard: CharacterTag[] = [];
    const withoutCard: CharacterTag[] = [];

    (book.characters as CharacterTag[]).forEach((tag) => {
      const name = tag.name;
      const base: CharacterTag = { ...tag };
      const hasCard = charactersWithCards.includes(name);
      const cardInfo = characterCardsMap[name];

      if (hasCard && cardInfo) {
        base.hasCard = true;
        base.cardImageUrl = cardInfo.imageUrl;
        base.cardParodyName = cardInfo.parodyName;
        base.cardRect = cardInfo.rect;
        withCard.push(base);
      } else if (hasCard && !cardInfo) {
        base.hasCard = true;
        withoutCard.push(base);
      } else {
        withoutCard.push(base);
      }
    });

    return [...withCard, ...withoutCard];
  }, [book.characters, charactersWithCards, characterCardsMap]);

  const availableCharacters: string[] = useMemo(() => {
    if (!book.characters?.length) return [];
    if (!charactersWithCards.length) return book.characters.map((c) => c.name);

    return book.characters
      .map((c) => c.name)
      .filter((name) => !charactersWithCards.includes(name));
  }, [book.characters, charactersWithCards]);

  const canAddCards = availableCharacters.length > 0 && !!meId;

  const [pagePickerVisible, setPagePickerVisible] = useState(false);
  const [cropVisible, setCropVisible] = useState(false);
  const [selectVisible, setSelectVisible] = useState(false);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(
    null
  );
  const [selectedPageImageUri, setSelectedPageImageUri] = useState<
    string | null
  >(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openPagePicker = () => {
    if (!canAddCards) return;
    if (!meId) {
      return;
    }
    setSubmitError(null);
    setSelectedPageIndex(null);
    setSelectedPageImageUri(null);
    setCurrentRect(null);
    setPagePickerVisible(true);
  };

  const closeAllModals = () => {
    setPagePickerVisible(false);
    setCropVisible(false);
    setSelectVisible(false);
    setSelectedPageIndex(null);
    setSelectedPageImageUri(null);
    setCurrentRect(null);
    setSubmitError(null);
    setSubmitting(false);
  };

  const handlePageSelected = (pageIndex: number, imageUri: string) => {
    setSelectedPageIndex(pageIndex);
    setSelectedPageImageUri(imageUri);
    setPagePickerVisible(false);
    setCropVisible(true);
  };

  const handleCropCancel = () => {
    setCropVisible(false);
    setCurrentRect(null);
  };

  const handleCropConfirm = (rect: Rect) => {
    setCurrentRect(rect);
    setCropVisible(false);
    setSelectVisible(true);
  };

  const handleCharacterSelectCancel = () => {
    setSelectVisible(false);
    setCurrentRect(null);
    setSelectedPageIndex(null);
    setSelectedPageImageUri(null);
    setSubmitError(null);
    setSubmitting(false);
  };

  const handleCharacterSelectConfirm = async (
    characterName: string,
    parodyName: string | null
  ) => {
    if (
      !selectedPageIndex ||
      !selectedPageImageUri ||
      !currentRect ||
      submitting
    ) {
      return;
    }
    if (!meId) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const normalizedImageUrl = normalizeNhentaiImageUrl(selectedPageImageUri);

    try {
      await createCharacterCard(book.id, selectedPageIndex, {
        characterName,
        parodyName,
        imageUrl: normalizedImageUrl,
        cropX: currentRect.x,
        cropY: currentRect.y,
        cropWidth: currentRect.width,
        cropHeight: currentRect.height,
        userId: meId,
      });

      setSelectVisible(false);
      setCurrentRect(null);
      setSelectedPageIndex(null);
      setSelectedPageImageUri(null);
      setSubmitting(false);

      setRefreshKey((x) => x + 1);
    } catch (err: any) {
      const msg = err?.message || "Не удалось сохранить карточку персонажа";
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  const DownloadControl = () => {
    if (!dl && !local) {
      return (
        <View style={{ borderRadius: 20, overflow: "hidden" }}>
          <Pressable
            onPress={handleDownloadOrDelete}
            style={[styles.circleBtn, { backgroundColor: colors.tagBg }]}
            android_ripple={{ color: colors.accent + "22", borderless: false }}
            accessibilityRole="button"
            accessibilityLabel={t("book.download")}
          >
            <Feather name="download" size={20} color={colors.accent} />
          </Pressable>
        </View>
      );
    }

    if (!dl && local) {
      return (
        <View style={{ borderRadius: 20, overflow: "hidden" }}>
          <Pressable
            onPress={handleDownloadOrDelete}
            style={[styles.circleBtn, { backgroundColor: colors.tagBg }]}
            android_ripple={{ color: colors.accent + "22", borderless: false }}
            accessibilityRole="button"
            accessibilityLabel={t("book.removeDownload")}
          >
            <Feather name="trash-2" size={20} color={colors.accent} />
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ borderRadius: 20, overflow: "hidden" }}>
        <Pressable
          onPress={cancel}
          style={[styles.dlCircle, { backgroundColor: colors.tagBg }]}
          android_ripple={{ color: colors.accent + "22", borderless: false }}
          accessibilityRole="button"
          accessibilityLabel={t("book.cancelDownload")}
        >
          <Ring progress={pr} size={28} />
          <View style={styles.dlInner}>
            <Feather name="x" size={14} color={colors.accent} />
          </View>
        </Pressable>
      </View>
    );
  };

  const getPageImageUri = (pageIndex: number): string => {
    const anyBook: any = book;

    if (Array.isArray(anyBook.pages) && anyBook.pages[pageIndex - 1]) {
      const p = anyBook.pages[pageIndex - 1];
      if (typeof p === "string") return p;
      if (p && typeof p.url === "string") return p.url;
    }

    if (anyBook.images?.pages && anyBook.images.pages[pageIndex - 1]) {
      const p = anyBook.images.pages[pageIndex - 1];
      if (p && typeof p.url === "string") return p.url;
    }

    return book.cover;
  };

  if (wide) {
    return (
      <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
        <View
          style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}
        >
          <View style={{ width: Math.min(360, win.w * 0.35) }}>
            <View
              style={{
                width: "100%",
                aspectRatio: coverAR,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: colors.page,
              }}
            >
              <ExpoImage
                source={buildImageFallbacks(book.cover)}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Pressable
              onLongPress={() => Clipboard.setStringAsync(book.title.pretty)}
            >
              <Text
                style={{
                  color: colors.txt,
                  fontSize: 22,
                  fontWeight: "800",
                  marginBottom: 4,
                }}
              >
                {book.title.pretty}
              </Text>
            </Pressable>

            <Pressable
              onLongPress={() => Clipboard.setStringAsync(book.title.english)}
            >
              <Text style={{ color: colors.metaText, fontSize: 14 }}>
                {book.title.english}
              </Text>
            </Pressable>

            {book.title.japanese !== book.title.english && (
              <Pressable
                onLongPress={() =>
                  Clipboard.setStringAsync(book.title.japanese)
                }
              >
                <Text
                  style={{
                    color: colors.metaText,
                    fontSize: 13,
                    fontStyle: "italic",
                  }}
                >
                  {book.title.japanese}
                </Text>
              </Pressable>
            )}

            {!!book.scanlator && (
              <Text
                style={{ color: colors.metaText, fontSize: 12, marginTop: 4 }}
              >
                Scanlated by {book.scanlator}
              </Text>
            )}

            <View style={styles.metaRow}>
              <Feather name="hash" size={14} color={colors.metaText} />
              <Pressable
                onLongPress={() => Clipboard.setStringAsync(String(book.id))}
              >
                <Text style={{ fontSize: 13, color: colors.metaText }}>
                  {book.id}
                </Text>
              </Pressable>

              <Feather
                name="calendar"
                size={14}
                color={colors.metaText}
                style={{ marginLeft: 12 }}
              />
              <Text style={{ fontSize: 13, color: colors.metaText }}>
                {timeAgo(book.uploaded, resolvedDateFns)}
              </Text>

              <Feather
                name="heart"
                size={14}
                color={colors.metaText}
                style={{ marginLeft: 12 }}
              />
              <Text style={{ fontSize: 13, color: colors.metaText }}>
                {book.favorites}
              </Text>

              <Feather
                name="book-open"
                size={14}
                color={colors.metaText}
                style={{ marginLeft: 12 }}
              />
              <Text style={{ fontSize: 13, color: colors.metaText }}>
                {book.pagesCount}
              </Text>
            </View>

            <View style={[styles.actionRow, { marginTop: 14 }]}>
              <View style={{ borderRadius: 14, overflow: "hidden", flex: 1 }}>
                <Pressable
                  onPress={async () => {
                    // Для Electron открываем отдельное окно, для Android - обычная навигация
                    if (isElectron() && book.id) {
                      await openReaderWindow(book.id, readBtn.page);
                    } else {
                      router.push({
                        pathname: "/read",
                        params: {
                          id: String(book.id),
                          page: String(readBtn.page),
                        },
                      });
                    }
                  }}
                  style={[styles.readBtn, { backgroundColor: colors.accent }]}
                  android_ripple={{ color: "#ffffff22", borderless: false }}
                >
                  <Feather
                    name={readBtn.restart ? "rotate-ccw" : "book-open"}
                    size={18}
                    color={colors.bg}
                  />
                  <Text style={[styles.readTxt, { color: colors.bg }]}>
                    {readBtn.label}
                  </Text>
                </Pressable>
              </View>

              <DownloadControl />

              <View style={{ borderRadius: 20, overflow: "hidden" }}>
                <Pressable
                  onPress={toggleLike}
                  style={[styles.circleBtn, { backgroundColor: colors.tagBg }]}
                  android_ripple={{
                    color: colors.accent + "22",
                    borderless: false,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    liked ? "Убрать из избранного" : "Добавить в избранное"
                  }
                >
                  <FontAwesome
                    name={liked ? "heart" : "heart-o"}
                    size={20}
                    color={liked ? "#FF5A5F" : colors.accent}
                  />
                </Pressable>
              </View>
            </View>

            <TagBlock
              label={t("tags.artists")}
              tags={book.artists as TagLite[]}
              modeOf={modeOf}
              cycle={cycle}
              onTagPress={onTagPress}
            />
            <TagBlock
              label={t("tags.characters")}
              tags={characterTagsWithInfo as TagLite[]}
              modeOf={modeOf}
              cycle={cycle}
              onTagPress={onTagPress}
              renderLabelExtra={
                canAddCards ? (
                  <Pressable
                    onPress={openPagePicker}
                    hitSlop={8}
                    style={{ paddingHorizontal: 4, paddingVertical: 2 }}
                  >
                    <Feather
                      name="settings"
                      size={16}
                      color={colors.metaText}
                    />
                  </Pressable>
                ) : null
              }
            />
            <TagBlock
              label={t("tags.parodies")}
              tags={book.parodies as TagLite[]}
              modeOf={modeOf}
              cycle={cycle}
              onTagPress={onTagPress}
            />
            <TagBlock
              label={t("tags.groups")}
              tags={book.groups as TagLite[]}
              modeOf={modeOf}
              cycle={cycle}
              onTagPress={onTagPress}
            />
            <TagBlock
              label={t("tags.categories")}
              tags={book.categories as TagLite[]}
              modeOf={modeOf}
              cycle={cycle}
              onTagPress={onTagPress}
            />
            <TagBlock
              label={t("tags.languages")}
              tags={book.languages as TagLite[]}
              modeOf={modeOf}
              cycle={cycle}
              onTagPress={onTagPress}
            />
            <TagBlock
              label={t("tags.tags")}
              tags={dedupTags as TagLite[]}
              modeOf={modeOf}
              cycle={cycle}
              onTagPress={onTagPress}
            />

            <View style={[styles.galleryRow, { marginTop: 16 }]}>
              <Text style={[styles.galleryLabel, { color: colors.metaText }]}>
                {t("book.gallery")}
              </Text>
              <Pressable onPress={cycleCols} style={styles.layoutBtn}>
                <Feather name="layout" size={18} color={colors.metaText} />
                <Text style={[styles.layoutTxt, { color: colors.metaText }]}>
                  {cols}×
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <PagePickerModal
          visible={pagePickerVisible}
          pagesCount={book.pagesCount || 1}
          onClose={closeAllModals}
          onSelect={(page, uri) => handlePageSelected(page, uri)}
          getPageImageUri={getPageImageUri}
        />

        <CharacterCropModal
          visible={cropVisible}
          imageUri={
            selectedPageImageUri
              ? normalizeNhentaiImageUrl(selectedPageImageUri)
              : normalizeNhentaiImageUrl(book.cover)
          }
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />

        <CharacterSelectModal
          visible={selectVisible}
          characters={availableCharacters}
          parodies={(book.parodies ?? []).map((p) => p.name)}
          onCancel={handleCharacterSelectCancel}
          onConfirm={handleCharacterSelectConfirm}
          currentUserId={meId}
          currentUsername={me?.username ?? null}
        />

        {submitError && (
          <Text
            style={{
              color: "#ff6b6b",
              fontSize: 12,
              marginTop: 4,
              paddingHorizontal: 4,
            }}
          >
            {submitError}
          </Text>
        )}
      </View>
    );
  }

  const contentW = containerW - pad * 2;
  const cardW = contentW * 0.78;

  return (
    <View style={{ paddingHorizontal: pad, position: "relative" }}>
      <View
        style={{
          width: containerW,
          alignSelf: "center",
          aspectRatio: coverAR,
          overflow: "hidden",
        }}
      >
        <ExpoImage
          source={buildImageFallbacks(book.cover)}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          transition={0}
        />
        <LinearGradient
          colors={[`${colors.bg}ff`, `${colors.bg}b8`, `${colors.bg}ff`]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      <View
        style={{
          position: "absolute",
          left: (contentW - cardW) / 2,
          top: contentW * 0.1,
          width: cardW,
          height: cardW * 1.35,
          borderRadius: 26,
          overflow: "hidden",
          backgroundColor: colors.page,
          elevation: 8,
          shadowColor: "#000",
          shadowOpacity: 0.16,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <ExpoImage
          source={buildImageFallbacks(book.cover)}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      </View>

      <View
        style={{
          paddingHorizontal: 0,
          marginTop:
            cardW * 1.35 + contentW * 0.1 + 12 - contentW / (coverAR || 0.75),
        }}
      >
        <Pressable
          onLongPress={() => Clipboard.setStringAsync(book.title.pretty)}
        >
          <Text
            style={{
              color: colors.txt,
              fontSize: 20,
              fontWeight: "800",
              marginBottom: 4,
            }}
          >
            {book.title.pretty}
          </Text>
        </Pressable>
        <Pressable
          onLongPress={() => Clipboard.setStringAsync(book.title.english)}
        >
          <Text style={{ color: colors.metaText, fontSize: 14 }}>
            {book.title.english}
          </Text>
        </Pressable>
        {book.title.japanese !== book.title.english && (
          <Pressable
            onLongPress={() => Clipboard.setStringAsync(book.title.japanese)}
          >
            <Text
              style={{
                color: colors.metaText,
                fontSize: 13,
                fontStyle: "italic",
              }}
            >
              {book.title.japanese}
            </Text>
          </Pressable>
        )}

        {!!book.scanlator && (
          <Text style={{ color: colors.metaText, fontSize: 12, marginTop: 4 }}>
            Scanlated by {book.scanlator}
          </Text>
        )}

        <View style={styles.metaRow}>
          <Feather name="hash" size={14} color={colors.metaText} />
          <Pressable
            onLongPress={() => Clipboard.setStringAsync(String(book.id))}
          >
            <Text style={{ fontSize: 13, color: colors.metaText }}>
              {book.id}
            </Text>
          </Pressable>

          <Feather
            name="calendar"
            size={14}
            color={colors.metaText}
            style={{ marginLeft: 12 }}
          />
          <Text style={{ fontSize: 13, color: colors.metaText }}>
            {timeAgo(book.uploaded, resolvedDateFns)}
          </Text>

          <Feather
            name="heart"
            size={14}
            color={colors.metaText}
            style={{ marginLeft: 12 }}
          />
          <Text style={{ fontSize: 13, color: colors.metaText }}>
            {book.favorites}
          </Text>

          <Feather
            name="book-open"
            size={14}
            color={colors.metaText}
            style={{ marginLeft: 12 }}
          />
          <Text style={{ fontSize: 13, color: colors.metaText }}>
            {book.pagesCount}
          </Text>
        </View>

        <View style={[styles.actionRow, { marginTop: 14 }]}>
          <View style={{ borderRadius: 14, overflow: "hidden", flex: 1 }}>
            <Pressable
              onPress={async () => {
                // Для Electron открываем отдельное окно, для Android - обычная навигация
                if (isElectron() && book.id) {
                  await openReaderWindow(book.id, readBtn.page);
                } else {
                  router.push({
                    pathname: "/read",
                    params: { id: String(book.id), page: String(readBtn.page) },
                  });
                }
              }}
              style={[styles.readBtn, { backgroundColor: colors.accent }]}
              android_ripple={{ color: "#ffffff22", borderless: false }}
            >
              <Feather
                name={readBtn.restart ? "rotate-ccw" : "book-open"}
                size={18}
                color={colors.bg}
              />
              <Text style={[styles.readTxt, { color: colors.bg }]}>
                {readBtn.label}
              </Text>
            </Pressable>
          </View>

          <DownloadControl />

          <View style={{ borderRadius: 20, overflow: "hidden" }}>
            <Pressable
              onPress={toggleLike}
              style={[styles.circleBtn, { backgroundColor: colors.tagBg }]}
              android_ripple={{
                color: colors.accent + "22",
                borderless: false,
              }}
              accessibilityRole="button"
              accessibilityLabel={
                liked ? "Убрать из избранного" : "Добавить в избранное"
              }
            >
              <FontAwesome
                name={liked ? "heart" : "heart-o"}
                size={20}
                color={liked ? "#FF5A5F" : colors.accent}
              />
            </Pressable>
          </View>
        </View>

        <TagBlock
          label={t("tags.artists")}
          tags={book.artists as TagLite[]}
          modeOf={modeOf}
          cycle={cycle}
          onTagPress={onTagPress}
        />
        <TagBlock
          label={t("tags.characters")}
          tags={characterTagsWithInfo as TagLite[]}
          modeOf={modeOf}
          cycle={cycle}
          onTagPress={onTagPress}
          renderLabelExtra={
            canAddCards ? (
              <Pressable
                onPress={openPagePicker}
                hitSlop={8}
                style={{ paddingHorizontal: 4, paddingVertical: 2 }}
              >
                <Feather name="settings" size={16} color={colors.metaText} />
              </Pressable>
            ) : null
          }
        />
        <TagBlock
          label={t("tags.parodies")}
          tags={book.parodies as TagLite[]}
          modeOf={modeOf}
          cycle={cycle}
          onTagPress={onTagPress}
        />
        <TagBlock
          label={t("tags.groups")}
          tags={book.groups as TagLite[]}
          modeOf={modeOf}
          cycle={cycle}
          onTagPress={onTagPress}
        />
        <TagBlock
          label={t("tags.categories")}
          tags={book.categories as TagLite[]}
          modeOf={modeOf}
          cycle={cycle}
          onTagPress={onTagPress}
        />
        <TagBlock
          label={t("tags.languages")}
          tags={book.languages as TagLite[]}
          modeOf={modeOf}
          cycle={cycle}
          onTagPress={onTagPress}
        />
        <TagBlock
          label={t("tags.tags")}
          tags={dedupTags as TagLite[]}
          modeOf={modeOf}
          cycle={cycle}
          onTagPress={onTagPress}
        />

        <View style={[styles.galleryRow, { marginTop: 16 }]}>
          <Text style={[styles.galleryLabel, { color: colors.metaText }]}>
            {t("book.gallery")}
          </Text>
          <Pressable onPress={cycleCols} style={styles.layoutBtn}>
            <Feather name="layout" size={18} color={colors.metaText} />
            <Text style={[styles.layoutTxt, { color: colors.metaText }]}>
              {cols}×
            </Text>
          </Pressable>
        </View>

        <PagePickerModal
          visible={pagePickerVisible}
          pagesCount={book.pagesCount || 1}
          onClose={closeAllModals}
          onSelect={(page, uri) => handlePageSelected(page, uri)}
          getPageImageUri={getPageImageUri}
        />

        <CharacterCropModal
          visible={cropVisible}
          imageUri={
            selectedPageImageUri
              ? normalizeNhentaiImageUrl(selectedPageImageUri)
              : normalizeNhentaiImageUrl(book.cover)
          }
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />

        <CharacterSelectModal
          visible={selectVisible}
          characters={availableCharacters}
          parodies={(book.parodies ?? []).map((p) => p.name)}
          onCancel={handleCharacterSelectCancel}
          onConfirm={handleCharacterSelectConfirm}
          currentUserId={meId}
          currentUsername={me?.username ?? null}
        />

        {submitError && (
          <Text
            style={{
              color: "#ff6b6b",
              fontSize: 12,
              marginTop: 4,
              paddingHorizontal: 4,
            }}
          >
            {submitError}
          </Text>
        )}
      </View>
    </View>
  );
}

type PagePickerModalProps = {
  visible: boolean;
  pagesCount: number;
  getPageImageUri: (pageIndex: number) => string;
  onClose: () => void;
  onSelect: (pageIndex: number, imageUri: string) => void;
};

const PagePickerModal: React.FC<PagePickerModalProps> = ({
  visible,
  pagesCount,
  getPageImageUri,
  onClose,
  onSelect,
}) => {
  const totalPages = Math.max(1, pagesCount || 1);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      statusBarTranslucent
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={pickerStyles.backdrop}>
        <View style={pickerStyles.modal}>
          <Text style={pickerStyles.title}>Select a page to edit</Text>

          <FlatList
            horizontal
            data={pages}
            keyExtractor={(item) => String(item)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={pickerStyles.carousel}
            renderItem={({ item }) => {
              const uri = getPageImageUri(item);
              return (
                <Pressable
                  onPress={() => onSelect(item, uri)}
                  style={pickerStyles.pageItem}
                >
                  <ExpoImage
                    source={{ uri }}
                    style={pickerStyles.pageImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                  <View style={pickerStyles.pageLabel}>
                    <Text style={pickerStyles.pageLabelText}>{item}</Text>
                  </View>
                </Pressable>
              );
            }}
          />

          <Pressable style={pickerStyles.closeBtn} onPress={onClose}>
            <Text style={pickerStyles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "90%",
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#111",
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  carousel: {
    paddingVertical: 8,
  },
  pageItem: {
    width: 90,
    height: 130,
    borderRadius: 12,
    marginHorizontal: 4,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  pageImage: {
    width: "100%",
    height: "100%",
  },
  pageLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
  },
  pageLabelText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  closeBtn: {
    marginTop: 10,
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  closeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
});
