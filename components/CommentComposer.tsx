import type { Comment as ApiComment } from "@/api/v2";
import { getCaptchaInfo, getPowChallenge, solvePoW } from "@/api/v2/config";
import { postComment } from "@/api/v2/comments";
import { CaptchaEmbed } from "@/components/auth/CaptchaEmbed";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  galleryId: number;
  placeholder?: string;
  onSubmitted?: (c: ApiComment) => void;
};

function absUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  const s = String(u);
  if (/^https?:\/\//.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("/avatars/") || s.startsWith("avatars/")) {
    const path = s.startsWith("/") ? s.slice(1) : s;
    return "https://i.nhentai.net/" + path;
  }
  if (s.startsWith("/")) return "https://nhentai.net" + s;
  return "https://nhentai.net/" + s;
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
  input: { flex: 1, minHeight: 44, maxHeight: 140, fontSize: 14, paddingVertical: 10 },
  sendBtn: { borderRadius: 999, padding: 10, overflow: "hidden" },
  hint: { fontSize: 12, marginTop: 6 },
  // Modal — mirrors LoginModal structure exactly
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 16,
  },
  cardTitle: { fontWeight: "900", fontSize: 17, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, marginBottom: 12 },
  captchaLabel: { fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 10 },
  captchaBlock: { marginTop: 4 },
  statusTxt: { fontSize: 12, textAlign: "center", marginTop: 8, marginBottom: 4 },
  errBox: { borderRadius: 10, padding: 12, marginTop: 8 },
  cancelBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  cancelTxt: { fontWeight: "700", fontSize: 14 },
});

export default function CommentComposer({ galleryId, placeholder, onSubmitted }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = useMemo(() => ({
    text: colors.txt,
    sub: colors.metaText,
    card: colors.surfaceElevated,
    border: colors.iconOnSurface + "22",
    accent: colors.accent,
    ripple: colors.accent + "12",
  }), [colors]);

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Captcha modal — unified for Android, iOS, Electron, web
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [captchaInfo, setCaptchaInfo] = useState<{ site_key: string; provider: string } | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [captchaLoadErr, setCaptchaLoadErr] = useState<string | null>(null);

  const pendingTextRef = useRef("");

  const left = Math.max(0, 10 - value.trim().length);
  const canSend = !busy && value.trim().length >= 10;

  // Fetch captcha info each time the modal opens — same as LoginModal
  useEffect(() => {
    if (!captchaVisible) return;
    let cancelled = false;
    setCaptchaInfo(null);
    setCaptchaLoadErr(null);
    (async () => {
      try {
        const c = await getCaptchaInfo();
        if (cancelled) return;
        if (c.site_key) {
          setCaptchaInfo({ site_key: c.site_key, provider: c.provider || "turnstile" });
        } else {
          setCaptchaLoadErr(t("commentComposer.error.captchaUnavailable") || "Captcha unavailable");
        }
      } catch (e: any) {
        if (cancelled) return;
        setCaptchaLoadErr(e?.message || "Failed to load captcha");
      }
    })();
    return () => { cancelled = true; };
  }, [captchaVisible, t]);

  const doSend = useCallback(async () => {
    if (!value.trim() || busy) return;
    pendingTextRef.current = value;
    setBusy(true);
    setError(null);
    setCaptchaKey((k) => k + 1);
    setStatusMsg("");
    setCaptchaVisible(true);
  }, [value, busy]);

  // Called when user solves the captcha
  const handleToken = useCallback(async (token: string) => {
    try {
      setStatusMsg(t("commentComposer.status.pow") || "Solving proof of work…");
      const ch = await getPowChallenge("comment");
      const nonce = await solvePoW(ch.challenge, ch.difficulty);

      setStatusMsg(t("commentComposer.status.posting") || "Posting comment…");
      const comment = await postComment(galleryId, {
        body: pendingTextRef.current,
        pow_challenge: ch.challenge,
        pow_nonce: nonce,
        captcha_response: token,
      });
      setCaptchaVisible(false);
      setBusy(false);
      setStatusMsg("");
      setValue("");

      let enriched: ApiComment = comment;
      if (!enriched?.poster?.avatar_url) {
        try {
          const meStr = await AsyncStorage.getItem("nh.me");
          if (meStr) {
            const me = JSON.parse(meStr);
            const av = absUrl(me?.avatar_url);
            enriched = {
              ...enriched,
              poster: {
                ...(enriched.poster || {}),
                id: enriched.poster?.id ?? me?.id,
                username: enriched.poster?.username ?? me?.username,
                ...(av && !enriched.poster?.avatar_url ? { avatar_url: av } : {}),
              } as any,
            };
          }
        } catch {}
      }
      onSubmitted?.(enriched);
    } catch (e: any) {
      setCaptchaVisible(false);
      setBusy(false);
      setStatusMsg("");
      setCaptchaKey((k) => k + 1);
      const msg = e?.body?.detail ?? e?.body?.message ?? e?.message ?? "Failed to post comment";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  }, [galleryId, onSubmitted, t]);

  const handleCaptchaClose = useCallback(() => {
    setCaptchaVisible(false);
    setBusy(false);
    setStatusMsg("");
  }, []);

  return (
    <View>
      <View style={[S.wrap, { backgroundColor: ui.card, borderColor: ui.border }]}>
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
          android_ripple={{ color: ui.ripple, borderless: true, foreground: true }}
          style={[S.sendBtn, { backgroundColor: "transparent", opacity: canSend ? 1 : 0.6 }]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={ui.accent} />
          ) : (
            <MaterialIcons name="send" size={22} color={canSend ? ui.accent : ui.sub} />
          )}
        </Pressable>
      </View>

      {Platform.OS === "android" && (
        <Text style={[S.hint, { color: ui.sub }]}>
          {value.trim().length < 10
            ? t("commentComposer.hint.needMore", { n: left })
            : t("commentComposer.hint.captcha")}
        </Text>
      )}

      {!!error && (
        <Text style={[S.hint, { color: "#ef4444" }]}>{error}</Text>
      )}

      {/* Captcha modal — CaptchaEmbed auto-detects: WebView on Android, ElectronCaptchaButton on PC */}
      <Modal
        visible={captchaVisible}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={handleCaptchaClose}
      >
        <KeyboardAvoidingView
          style={S.backdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[S.card, { backgroundColor: ui.card }]}>
            <Text style={[S.cardTitle, { color: ui.text }]}>
              {t("commentComposer.captcha.title")}
            </Text>
            <Text style={[S.cardSubtitle, { color: ui.sub }]}>
              {t("commentComposer.captcha.subtitle")}
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <Text style={[S.captchaLabel, { color: ui.sub }]}>
                {t("login.form.captcha")}
              </Text>

              {captchaLoadErr ? (
                <View style={[S.errBox, { backgroundColor: "#ff444422" }]}>
                  <Text style={{ color: "#f88", fontSize: 13 }}>{captchaLoadErr}</Text>
                </View>
              ) : captchaInfo?.site_key ? (
                <View style={S.captchaBlock}>
                  <CaptchaEmbed
                    key={captchaKey}
                    siteKey={captchaInfo.site_key}
                    provider={captchaInfo.provider}
                    resetKey={captchaKey}
                    onToken={handleToken}
                    onClear={() => {}}
                    accent={ui.accent}
                    subColor={ui.sub}
                  />
                </View>
              ) : (
                <View style={{ height: 68, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={ui.accent} />
                </View>
              )}

              {!!statusMsg && (
                <Text style={[S.statusTxt, { color: ui.sub }]}>{statusMsg}</Text>
              )}

              <Pressable
                onPress={handleCaptchaClose}
                style={[S.cancelBtn, { backgroundColor: ui.border }]}
              >
                <Text style={[S.cancelTxt, { color: ui.text }]}>
                  {t("common.cancel") || "Cancel"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
