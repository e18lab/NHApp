import type { ApiComment } from "@/api/online/comments";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import CloudflareGate from "./CloudflareGate";

type Props = {
  galleryId: number;
  placeholder?: string;
  onSubmitted?: (c: ApiComment) => void;
};

const NH_HOST = "https://nhentai.net";
function absUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  const s = String(u);
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("/avatars/") || s.startsWith("avatars/")) {
    const path = s.startsWith("/") ? s.slice(1) : s;
    return "https://i.nhentai.net/" + path;
  }
  if (s.startsWith("/")) return NH_HOST + s;
  return NH_HOST + "/" + s;
}

const S = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    fontSize: 14,
    paddingVertical: 10,
  },
  sendBtn: { borderRadius: 999, padding: 10, overflow: "hidden" },
  hint: { fontSize: 12, marginTop: 6 },
});

function pickCommentFromResponse(
  json: any,
  galleryId: number,
  fallbackText: string
): ApiComment {
  const c =
    json?.comment ?? json?.data?.comment ?? json?.data ?? json ?? ({} as any);

  const now = Date.now();

  const posterRaw = c.poster ?? c.user ?? c.author ?? {};

  const avatarCandidate =
    posterRaw.avatar_url ??
    posterRaw.avatar ??
    c.avatar_url ??
    c.avatar ??
    null;

  const avatar_url = absUrl(avatarCandidate);

  const normalized: ApiComment = {
    id: c.id ?? undefined,
    gallery_id: c.gallery_id ?? galleryId,
    body: typeof c.body === "string" && c.body.length ? c.body : fallbackText,
    post_date: c.post_date ?? now,
    poster: {
      ...(posterRaw || {}),
      username: posterRaw?.username ?? c.username ?? posterRaw?.name,
      id: posterRaw?.id ?? c.user_id ?? c.poster_id,
      ...(avatar_url ? { avatar_url } : {}),
    } as any,
  };

  return normalized;
}

export default function CommentComposer({
  galleryId,
  placeholder,
  onSubmitted,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const ui = useMemo(
    () => ({
      text: colors.txt,
      sub: colors.metaText,
      card: colors.surfaceElevated,
      border: colors.iconOnSurface + "22",
      accent: colors.accent,
      ripple: colors.accent + "12",
      backdrop: "#00000088",
    }),
    [colors]
  );

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const [gateVisible, setGateVisible] = useState(false);
  const pendingTextRef = useRef("");

  const left = Math.max(0, 10 - value.trim().length);
  const canSend = !busy && value.trim().length >= 10;

  const doSend = () => {
    if (!value.trim() || busy) return;
    pendingTextRef.current = value;
    setBusy(true);
    setGateVisible(true);
  };

  const handleGateClose = () => {
    setGateVisible(false);
    setBusy(false);
  };

  return (
    <View>
      <View
        style={[S.wrap, { backgroundColor: ui.card, borderColor: ui.border }]}
      >
        <TextInput
          style={[S.input, { color: ui.text }]}
          placeholder={t("commentComposer.placeholder")}
          placeholderTextColor={ui.sub}
          value={value}
          onChangeText={setValue}
          multiline
          editable={!busy}
        />
        <Pressable
          onPress={doSend}
          disabled={!canSend}
          android_ripple={{
            color: ui.ripple,
            borderless: true,
            foreground: true,
          }}
          style={[
            S.sendBtn,
            { backgroundColor: "transparent", opacity: canSend ? 1 : 0.6 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={ui.accent} />
          ) : (
            <MaterialIcons
              name="send"
              size={22}
              color={canSend ? ui.accent : ui.sub}
            />
          )}
        </Pressable>
      </View>

      {/* Показываем подсказку только для Android (не для Electron) */}
      {Platform.OS === "android" && (
        <Text style={[S.hint, { color: ui.sub }]}>
          {value.trim().length < 10
            ? t("commentComposer.hint.needMore", { n: left })
            : t("commentComposer.hint.captcha")}
        </Text>
      )}

      <CloudflareGate
        visible={gateVisible}
        galleryId={galleryId}
        prefillText={pendingTextRef.current || value}
        onlyCommentFormCss={false}
        forceCss={{
          "html, body": [
            "margin:0",
            "padding:0",
            "overflow:hidden",
            "height:100vh",
            "width:100vw",
          ],
          "#comment-post-container, #comment_form, .row": [
            "margin:0",
            "padding:0",
            "height:100vh",
            "width:100vw",
            "background:#16181a",
          ],
        }}
        forceHide={[
          "#bigcontainer",
          "#thumbnail-container",
          "#related-container",
          "#comment-container",
          "#messages",
          "textarea",
          "nav",
          "h3",
          ".advt",
          ".btn-primary",
          ".ts-im-container",
        ]}
        onClose={handleGateClose}
        onPosted={async (json) => {
          setGateVisible(false);
          setBusy(false);

          const normalized = pickCommentFromResponse(
            json,
            galleryId,
            pendingTextRef.current || value
          );

          console.log('[CommentComposer] Normalized comment:', normalized);
          console.log('[CommentComposer] Avatar URL:', normalized?.poster?.avatar_url);

          // Всегда проверяем и устанавливаем poster.id и avatar_url из nh.me если они отсутствуют
          if (!normalized?.poster?.id || !normalized?.poster?.avatar_url) {
            try {
              const meStr = await AsyncStorage.getItem("nh.me");
              if (meStr) {
                const me = JSON.parse(meStr || "{}");
                const av = absUrl(me?.avatar_url);
                normalized.poster = {
                  ...(normalized.poster || {}),
                  id: normalized.poster?.id ?? me?.id,
                  username: normalized.poster?.username ?? me?.username,
                  ...(av && !normalized.poster?.avatar_url ? { avatar_url: av } : {}),
                } as any;
              }
            } catch {}
          }

          setValue("");

          try {
            onSubmitted?.(normalized);
          } catch {}
        }}
        colors={{
          text: ui.text,
          sub: ui.sub,
          card: ui.card,
          border: ui.border,
          accent: ui.accent,
          backdrop: ui.backdrop,
        }}
      />
    </View>
  );
}
