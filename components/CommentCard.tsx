import type { ApiUser } from "@/api/nhappApi/types";
import { deleteComment } from "@/api/v2";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { MaterialIcons } from "@expo/vector-icons";
import { formatDistanceToNowStrict } from "date-fns";
import { enUS, ja, ru, zhCN } from "date-fns/locale";
import * as Clipboard from "expo-clipboard";
import { franc } from "franc-min";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  useWindowDimensions,
  View,
} from "react-native";

type Props = {
  id?: number;
  body: string;
  post_date?: number | string;
  poster?: Partial<ApiUser>;
  avatar?: string;
  avatar_url?: string;
  highlight?: boolean;
  mineLabel?: string;
  /** Shown as a tappable book-link below the body (for use in profile screens) */
  bookTitle?: string;
  onPress?: () => void;
  onPressAvatar?: () => void;
  onPressName?: () => void;
  onDelete?: (id?: number) => Promise<void> | void;
};

function absAvatar(u?: string | null): string | undefined {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  if (/^https?:\/\//.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("/")) return "https://i1.nhentai.net" + s;
  // bare relative path like "avatars/12345.png" — goes on image CDN
  return "https://i1.nhentai.net/" + s;
}

const R = StyleSheet.create({
  wrap: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    position: "relative",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  avatarCol: {
    width: 40,
    alignItems: "center",
    paddingTop: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#0002",
  },
  contentCol: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
    flexWrap: "wrap",
  },
  name: {
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.1,
  },
  dot: {
    fontSize: 13,
    opacity: 0.35,
  },
  time: {
    fontSize: 13,
    fontWeight: "400",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  bookLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  bookLinkTxt: {
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  translateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
  },
  translateTxt: {
    fontSize: 13,
    fontWeight: "600",
  },
  backdrop: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  menu: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    overflow: "hidden",
    marginVertical: 1,
  },
  delBackdrop: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  delCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  delTitle: { fontWeight: "900", fontSize: 16, marginBottom: 10 },
  delPreview: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  delRow: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  delBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  delBtnTxt: { fontWeight: "800" },
});

function parseToMs(ts?: number | string): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts > 1e12 ? ts : ts * 1000;
  let v = Date.parse(ts);
  if (Number.isFinite(v)) return v;
  const m =
    /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      ts.trim()
    );
  if (m) {
    const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    );
    if (!Number.isNaN(+dt)) return +dt;
  }
  return 0;
}

function localeOf(lang: "en" | "ru" | "ja" | "zh") {
  return lang === "ru" ? ru : lang === "ja" ? ja : lang === "zh" ? zhCN : enUS;
}

function fmtTimeLocalized(
  ts?: number | string,
  lang: "en" | "ru" | "ja" | "zh" = "en"
): string {
  const ms = parseToMs(ts);
  if (!ms) return "";
  return formatDistanceToNowStrict(new Date(ms), {
    addSuffix: true,
    locale: localeOf(lang),
  });
}

function mapIso3ToMyMemory(iso3: string, text: string): string {
  const m: Record<string, string> = {
    eng: "en", rus: "ru", zho: "zh-CN", cmn: "zh-CN", jpn: "ja", kor: "ko",
    spa: "es", por: "pt", fra: "fr", deu: "de", ita: "it", ukr: "uk",
    bel: "be", pol: "pl", nld: "nl", swe: "sv", fin: "fi", dan: "da",
    nor: "no", ces: "cs", slk: "sk", slv: "sl", hrv: "hr", srp: "sr",
    bul: "bg", ron: "ro", hun: "hu", tur: "tr", vie: "vi", tha: "th",
    ara: "ar", heb: "he", hin: "hi", ind: "id", fil: "tl", tgl: "tl",
    cat: "ca", glg: "gl", epo: "eo",
  };
  if (m[iso3]) return m[iso3];
  return /^[\x00-\x7F]+$/.test(text ?? "") ? "en" : "en";
}

const MYMEMORY_ERROR_PHRASES = [
  "QUERY LENGTH LIMIT EXCEDEED",
  "MYMEMORY WARNING",
  "YOU USED ALL AVAILABLE FREE TRANSLATIONS",
  "PLEASE SELECT TWO DISTINCT LANGUAGES",
  "INVALID LANGUAGE PAIR",
];

async function translateViaMyMemory(text: string, to = "en"): Promise<string> {
  const iso3 = franc(text || "", { minLength: 3 });
  const src = mapIso3ToMyMemory(iso3, text);
  const chunk = (str: string, max = 450) => {
    const parts: string[] = [];
    let s = str;
    while (s.length > max) {
      let cut = s.lastIndexOf(" ", max);
      if (cut === -1) cut = max;
      parts.push(s.slice(0, cut));
      s = s.slice(cut).trimStart();
    }
    if (s) parts.push(s);
    return parts;
  };

  const fetchWithRetry = async (url: string, retries = 2): Promise<any> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url);
        const data = await resp.json();

        const status = data?.responseStatus ?? resp.status;
        const quotaDone = data?.quotaFinished === true;
        const tt: string = data?.responseData?.translatedText ?? "";

        if (quotaDone || status === 403 || status === 429) {
          throw new Error("quota");
        }
        if (
          !resp.ok ||
          MYMEMORY_ERROR_PHRASES.some((e) => tt.toUpperCase().includes(e))
        ) {
          throw new Error("api_error");
        }

        return data;
      } catch (err: any) {
        if (err?.message === "quota" || err?.message === "api_error") throw err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        } else {
          throw err;
        }
      }
    }
  };

  const out: string[] = [];
  for (const p of chunk(text)) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=${encodeURIComponent(src)}|${encodeURIComponent(to)}`;
    const data = await fetchWithRetry(url);
    const tt: string = data?.responseData?.translatedText ?? "";
    out.push(tt.length ? tt : p);
    await new Promise((r) => setTimeout(r, 400));
  }
  return out.join(" ");
}

export default function CommentCard({
  id,
  body,
  post_date,
  poster,
  avatar,
  avatar_url,
  highlight,
  bookTitle,
  onPress,
  onPressAvatar,
  onPressName,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();
  const { t, resolved } = useI18n();
  const lang = (resolved ?? "en") as "en" | "ru" | "ja" | "zh";

  const ui = useMemo(
    () => ({
      text: colors.txt,
      sub: colors.metaText,
      card: colors.surfaceElevated,
      borderDim: colors.iconOnSurface + "22",
      accent: colors.accent,
      menuBg: colors.menuBg ?? colors.surfaceElevated,
      menuTxt: colors.menuTxt ?? colors.txt,
      menuBorder: colors.iconOnSurface + "22",
      ripple: colors.accent + "12",
    }),
    [colors]
  );

  // Resolve avatar to absolute URL
  const avatarSrc = useMemo(() => {
    return (
      absAvatar(avatar) ||
      absAvatar(avatar_url) ||
      absAvatar(poster?.avatar as string | undefined) ||
      absAvatar(poster?.avatar_url as string | undefined) ||
      ""
    );
  }, [avatar, avatar_url, poster]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const menuBtnRef = useRef<View>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTranslated(null);
    setShowOriginal(false);
  }, [body]);

  const detectedIso3 = useMemo(() => franc(body || "", { minLength: 3 }), [body]);
  const targetLangMM = lang === "zh" ? "zh-CN" : lang;
  const sourceMM = mapIso3ToMyMemory(detectedIso3, body);

  // Only show translate if the comment language differs from the UI language
  const canTranslate = (body?.trim().length ?? 0) > 2 && sourceMM !== targetLangMM;
  const showTranslateFooter = canTranslate || !!translated;

  const displayBody = translated && !showOriginal ? translated : body;
  const timeLabel = fmtTimeLocalized(post_date, lang);

  const openMenu = () => {
    menuBtnRef.current?.measureInWindow?.((x, y, w, h) => {
      setMenuAnchor({ x, y, w, h });
      setMenuOpen(true);
    });
  };

  const profilePressRef = useRef(false);
  const handleAvatarPress = () => {
    if (profilePressRef.current) return;
    profilePressRef.current = true;
    (onPressAvatar ?? onPressName)?.();
    setTimeout(() => { profilePressRef.current = false; }, 500);
  };
  const handleNamePress = () => {
    if (profilePressRef.current) return;
    profilePressRef.current = true;
    (onPressName ?? onPressAvatar)?.();
    setTimeout(() => { profilePressRef.current = false; }, 500);
  };

  const doTranslate = async () => {
    try {
      setBusy(true);
      const tr = await translateViaMyMemory(body, targetLangMM);
      setTranslated(tr);
      setShowOriginal(false);
    } catch {
      Alert.alert(t("comments.error.title"), t("comments.error.translate"));
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  const doToggleOriginal = () => {
    setShowOriginal((v) => !v);
    setMenuOpen(false);
  };

  const doCopy = async () => {
    try {
      await Clipboard.setStringAsync(displayBody || "");
      if (Platform.OS === "android") {
        ToastAndroid.show(t("comments.copied"), ToastAndroid.SHORT);
      }
    } catch {
    } finally {
      setMenuOpen(false);
    }
  };

  const askDelete = () => {
    setMenuOpen(false);
    if (!id) return;
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!id) return;
    try {
      setDeleteBusy(true);
      if (onDelete) {
        await onDelete(id);
      } else {
        await deleteComment(id);
      }
      setDeleteOpen(false);
    } catch {
      Alert.alert(t("comments.error.title"), t("comments.error.delete"));
    } finally {
      setDeleteBusy(false);
    }
  };

  const estimatedMenuHeight = 48 * 3 + 12;
  const menuTop = Math.min(
    Math.max(8, menuAnchor.y + menuAnchor.h + 6),
    winH - estimatedMenuHeight - 8
  );
  const menuRight = Math.max(8, winW - (menuAnchor.x + menuAnchor.w));

  const MenuItem = ({
    icon,
    label,
    onPress,
    disabled,
  }: {
    icon: string;
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      android_ripple={{ color: ui.ripple, borderless: false }}
      style={[R.menuItem, { cursor: "pointer" } as any]}
      onPress={onPress}
      disabled={disabled}
    >
      {disabled ? (
        <ActivityIndicator size="small" color={ui.menuTxt} />
      ) : (
        <MaterialIcons name={icon as any} size={18} color={ui.menuTxt} />
      )}
      <Text style={{ color: ui.menuTxt, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );

  const translateLabel = busy
    ? "…"
    : translated
      ? showOriginal
        ? t("comments.menu.showTranslation")
        : t("comments.menu.showOriginal")
      : t("comments.menu.translate");

  const hasProfileAction = !!(onPressAvatar || onPressName);

  return (
    <Animated.View>
      <Pressable
        onLongPress={openMenu}
        android_ripple={{ color: ui.ripple, borderless: false, foreground: true }}
        style={[R.wrap, { cursor: "default" } as any]}
      >
        {/* Context menu */}
        <Modal
          statusBarTranslucent
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable
            style={[R.backdrop, { cursor: "default" } as any]}
            onPress={() => setMenuOpen(false)}
          />
          <View
            ref={menuBtnRef}
            style={[
              R.menu,
              {
                top: menuTop,
                right: menuRight,
                backgroundColor: ui.menuBg,
                borderColor: ui.menuBorder,
              },
            ]}
          >
            {canTranslate && !translated && (
              <MenuItem
                icon="translate"
                label={t("comments.menu.translate")}
                onPress={doTranslate}
                disabled={busy}
              />
            )}
            {translated && (
              <MenuItem
                icon={showOriginal ? "translate" : "description"}
                label={showOriginal ? t("comments.menu.showTranslation") : t("comments.menu.showOriginal")}
                onPress={doToggleOriginal}
              />
            )}
            <MenuItem
              icon="content-copy"
              label={t("comments.menu.copy")}
              onPress={doCopy}
            />
            {highlight && (
              <MenuItem
                icon="delete-outline"
                label={t("comments.menu.delete")}
                onPress={askDelete}
              />
            )}
          </View>
        </Modal>

        {/* Layout */}
        <View style={R.row}>
          {/* Avatar */}
          <View style={R.avatarCol}>
            <Pressable
              onPress={hasProfileAction ? handleAvatarPress : undefined}
              hitSlop={6}
              style={{ cursor: hasProfileAction ? "pointer" : "default" } as any}
            >
              {avatarSrc ? (
                <Image
                  source={{ uri: avatarSrc }}
                  style={R.avatar}
                  onError={() => {}}
                />
              ) : (
                <View style={[R.avatar, { backgroundColor: ui.borderDim }]} />
              )}
            </Pressable>
          </View>

          {/* Content */}
          <View style={R.contentCol}>
            {/* Header */}
            <View style={R.headerRow}>
              <Pressable
                onPress={hasProfileAction ? handleNamePress : undefined}
                hitSlop={4}
                style={{ cursor: hasProfileAction ? "pointer" : "default" } as any}
              >
                <Text style={[R.name, { color: ui.text }]} numberOfLines={1}>
                  {poster?.username || "user"}
                </Text>
              </Pressable>
              {!!timeLabel && (
                <>
                  <Text style={[R.dot, { color: ui.sub }]}>·</Text>
                  <Text style={[R.time, { color: ui.sub }]} numberOfLines={1}>
                    {timeLabel}
                  </Text>
                </>
              )}
            </View>

            <Text style={[R.body, { color: ui.text }]} selectable>
              {displayBody}
            </Text>

            {/* Footer: translate + optional book link */}
            {(showTranslateFooter || !!bookTitle) && (
              <View style={R.footerRow}>
                {showTranslateFooter && (
                  <Pressable
                    style={[R.translateBtn, { cursor: "pointer" } as any]}
                    onPress={translated ? doToggleOriginal : doTranslate}
                    disabled={busy}
                    hitSlop={8}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={ui.sub} />
                    ) : (
                      <MaterialIcons name="translate" size={13} color={ui.sub} />
                    )}
                    <Text style={[R.translateTxt, { color: ui.sub }]}>
                      {translateLabel}
                    </Text>
                  </Pressable>
                )}
                {!!bookTitle && !!onPress && (
                  <Pressable
                    style={[R.bookLink, { cursor: "pointer" } as any]}
                    onPress={onPress}
                    hitSlop={8}
                  >
                    <MaterialIcons name="auto-stories" size={13} color={ui.accent} />
                    <Text
                      style={[R.bookLinkTxt, { color: ui.accent }]}
                      numberOfLines={1}
                    >
                      {bookTitle}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </Pressable>

      {/* Delete confirmation */}
      <Modal
        statusBarTranslucent
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteOpen(false)}
      >
        <Pressable
          style={[R.delBackdrop, { cursor: "default" } as any]}
          onPress={() => setDeleteOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[R.delCard, { backgroundColor: ui.card, borderColor: ui.borderDim }]}
          >
            <Text style={[R.delTitle, { color: ui.text }]}>
              {t("comments.delete.title")}
            </Text>
            <View style={[R.delPreview, { backgroundColor: ui.card, borderColor: ui.borderDim }]}>
              <View style={[R.row, { marginBottom: 8 }]}>
                {avatarSrc ? (
                  <Image source={{ uri: avatarSrc }} style={R.avatar} />
                ) : (
                  <View style={[R.avatar, { backgroundColor: ui.borderDim }]} />
                )}
                <View style={{ flex: 1, justifyContent: "center", marginLeft: 10 }}>
                  <Text style={[R.name, { color: ui.text }]} numberOfLines={1}>
                    {poster?.username || "user"}
                  </Text>
                  {!!timeLabel && (
                    <Text style={[R.time, { color: ui.sub }]}>{timeLabel}</Text>
                  )}
                </View>
              </View>
              <Text style={[R.body, { color: ui.text }]}>{displayBody}</Text>
            </View>
            <View style={R.delRow}>
              <Pressable
                onPress={() => setDeleteOpen(false)}
                style={[R.delBtn, { backgroundColor: ui.borderDim, cursor: "pointer" } as any]}
                android_ripple={{ color: ui.ripple, borderless: false }}
              >
                <Text style={[R.delBtnTxt, { color: ui.text }]}>
                  {t("comments.delete.cancel")}
                </Text>
              </Pressable>
              <Pressable
                disabled={deleteBusy}
                onPress={confirmDelete}
                style={[R.delBtn, { backgroundColor: ui.accent, opacity: deleteBusy ? 0.8 : 1, cursor: "pointer" } as any]}
                android_ripple={{ color: "#ffffff22", borderless: false }}
              >
                {deleteBusy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[R.delBtnTxt, { color: "#fff" }]}>
                    {t("comments.delete.confirm")}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}
