import type { ApiUser } from "@/api/nhentai";
import { deleteCommentById } from "@/api/online/comments";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { MaterialIcons } from "@expo/vector-icons";
import {
  formatDistanceToNowStrict
} from "date-fns";
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
  onPress?: () => void;
  onPressAvatar?: () => void;
  onPressName?: () => void;
  onDelete?: (id?: number) => Promise<void> | void;
};

const R = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  header: { flexDirection: "row", alignItems: "center" },
  nameTime: { flex: 1, marginLeft: 10, gap: 2 },
  name: { fontWeight: "800", fontSize: 14 },
  time: { fontSize: 12 },
  badge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  body: { fontSize: 14, lineHeight: 20 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#0002" },

  backdrop: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  menu: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    overflow: "hidden",
    marginVertical: 2,
  },
  optsBtn: { padding: 6, marginLeft: 8, borderRadius: 12 },

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
  const d = new Date(ms);
  const loc = localeOf(lang);

  return formatDistanceToNowStrict(d, { addSuffix: true, locale: loc });

}

function mapIso3ToMyMemory(iso3: string, text: string): string {
  const m: Record<string, string> = {
    eng: "en",
    rus: "ru",
    zho: "zh-CN",
    cmn: "zh-CN",
    jpn: "ja",
    kor: "ko",
    spa: "es",
    por: "pt",
    fra: "fr",
    deu: "de",
    ita: "it",
    ukr: "uk",
    bel: "be",
    pol: "pl",
    nld: "nl",
    swe: "sv",
    fin: "fi",
    dan: "da",
    nor: "no",
    ces: "cs",
    slk: "sk",
    slv: "sl",
    hrv: "hr",
    srp: "sr",
    bul: "bg",
    ron: "ro",
    hun: "hu",
    tur: "tr",
    vie: "vi",
    tha: "th",
    ara: "ar",
    heb: "he",
    hin: "hi",
    ind: "id",
    fil: "tl",
    tgl: "tl",
    cat: "ca",
    glg: "gl",
    epo: "eo",
  };
  if (m[iso3]) return m[iso3];
  const ascii = text && /^[\x00-\x7F]+$/.test(text);
  return ascii ? "en" : "en";
}
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

  const out: string[] = [];
  for (const p of chunk(text)) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      p
    )}&langpair=${encodeURIComponent(src)}|${encodeURIComponent(to)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const tt = data?.responseData?.translatedText;
    out.push(typeof tt === "string" && tt.length ? tt : p);
    await new Promise((r) => setTimeout(r, 250));
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
  mineLabel,
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
      backdrop: "#0008",
    }),
    [colors]
  );

  const avatarSrc =
    avatar ||
    avatar_url ||
    (poster?.avatar as string | undefined) ||
    (poster?.avatar_url as string | undefined) ||
    "";

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const btnRef = useRef<View>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTranslated(null);
    setShowOriginal(false);
  }, [body]);

  const detectedIso3 = useMemo(
    () => franc(body || "", { minLength: 3 }),
    [body]
  );

  const targetLangMM = lang === "zh" ? "zh-CN" : lang;
  const sourceMM = mapIso3ToMyMemory(detectedIso3, body);
  const canTranslateBase =
    (body?.trim().length ?? 0) > 2 && sourceMM !== targetLangMM;

  const displayBody = translated && !showOriginal ? translated : body;

  const openMenu = () => {
    btnRef.current?.measureInWindow?.((x, y, w, h) => {
      setMenuAnchor({ x, y, w, h });
      setMenuOpen(true);
    });
  };

  const handleCardPress = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    onPress?.();
  };

  // Обработчик для навигации в профиль (используется и для аватара, и для имени)
  // Используем useRef чтобы предотвратить двойной вызов
  const profilePressRef = useRef(false);
  const handleProfilePress = (e?: any) => {
    e?.stopPropagation?.();
    
    // Предотвращаем двойной вызов
    if (profilePressRef.current) return;
    profilePressRef.current = true;
    
    // Предпочитаем onPressName, потом onPressAvatar, потом onPress
    if (onPressName) {
      onPressName();
    } else if (onPressAvatar) {
      onPressAvatar();
    } else {
      onPress?.();
    }
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => {
      profilePressRef.current = false;
    }, 500);
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
      await Clipboard.setStringAsync(body || "");
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
        await deleteCommentById(id);
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
      style={R.menuItem}
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

  const timeLabel = fmtTimeLocalized(post_date, lang);

  return (
    <Animated.View>
      <Pressable
        onPress={handleCardPress}
        onLongPress={openMenu}
        android_ripple={{
          color: ui.ripple,
          borderless: false,
          foreground: true,
        }}
        style={[
          R.wrap,
          {
            backgroundColor: ui.card,
            borderColor: highlight ? ui.accent : ui.borderDim,
            borderRadius: 14,
            overflow: "hidden",
          },
        ]}
      >
        <Modal
        statusBarTranslucent
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable style={R.backdrop} onPress={() => setMenuOpen(false)} />
          <View
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
            {canTranslateBase && !translated && (
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
                label={
                  showOriginal
                    ? t("comments.menu.showTranslation")
                    : t("comments.menu.showOriginal")
                }
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

        <View style={R.header}>
          <Pressable
            onPress={handleProfilePress}
            hitSlop={4}
          >
            {avatarSrc ? (
              <Image source={{ uri: avatarSrc }} style={R.avatar} />
            ) : (
              <View style={[R.avatar, { backgroundColor: ui.borderDim }]} />
            )}
          </Pressable>

          <Pressable
            style={{ flex: 1, marginLeft: 10 }}
            onPress={handleProfilePress}
            hitSlop={4}
          >
            <View style={R.nameTime}>
              <Text style={[R.name, { color: ui.text }]} numberOfLines={1}>
                {poster?.username || "user"}
              </Text>
              <Text style={[R.time, { color: ui.sub }]}>{timeLabel}</Text>
            </View>
          </Pressable>

          {translated && !showOriginal && (
            <View
              style={[
                R.badge,
                { borderColor: ui.ripple, backgroundColor: ui.ripple + "12" },
              ]}
            >
              <Text
                style={{ color: ui.accent, fontWeight: "800", fontSize: 12 }}
              >
                {t("comments.badge.translated")}
              </Text>
            </View>
          )}

          {highlight && (
            <View
              style={[
                R.badge,
                { borderColor: ui.accent, backgroundColor: ui.accent + "12" },
              ]}
            >
              <Text
                style={{ color: ui.accent, fontWeight: "800", fontSize: 12 }}
              >
                {mineLabel || t("comments.mine")}
              </Text>
            </View>
          )}

          <Pressable
            ref={btnRef}
            onPress={openMenu}
            hitSlop={8}
            style={[R.optsBtn, { backgroundColor: "transparent" }]}
            android_ripple={{ color: ui.ripple, borderless: true }}
          >
            <MaterialIcons name="more-vert" size={20} color={ui.sub} />
          </Pressable>
        </View>

        <Text style={[R.body, { color: ui.text }]} selectable>
          {displayBody}
        </Text>
      </Pressable>

      <Modal
      statusBarTranslucent
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteOpen(false)}
      >
        <Pressable style={R.delBackdrop} onPress={() => setDeleteOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              R.delCard,
              { backgroundColor: ui.card, borderColor: ui.borderDim },
            ]}
          >
            <Text style={[R.delTitle, { color: ui.text }]}>
              {t("comments.delete.title")}
            </Text>

            <View
              style={[
                R.delPreview,
                { backgroundColor: ui.card, borderColor: ui.borderDim },
              ]}
            >
              <View style={R.header}>
                {avatarSrc ? (
                  <Image source={{ uri: avatarSrc }} style={R.avatar} />
                ) : (
                  <View style={[R.avatar, { backgroundColor: ui.borderDim }]} />
                )}
                <View style={R.nameTime}>
                  <Text style={[R.name, { color: ui.text }]} numberOfLines={1}>
                    {poster?.username || "user"}
                  </Text>
                  <Text style={[R.time, { color: ui.sub }]}>{timeLabel}</Text>
                </View>
              </View>
              <Text style={[R.body, { color: ui.text, marginTop: 8 }]}>
                {displayBody}
              </Text>
            </View>

            <View style={R.delRow}>
              <Pressable
                onPress={() => setDeleteOpen(false)}
                style={[R.delBtn, { backgroundColor: ui.borderDim }]}
                android_ripple={{ color: ui.ripple, borderless: false }}
              >
                <Text style={[R.delBtnTxt, { color: ui.text }]}>
                  {t("comments.delete.cancel")}
                </Text>
              </Pressable>

              <Pressable
                disabled={deleteBusy}
                onPress={confirmDelete}
                style={[
                  R.delBtn,
                  { backgroundColor: ui.accent, opacity: deleteBusy ? 0.8 : 1 },
                ]}
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
