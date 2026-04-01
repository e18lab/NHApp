import { CaptchaEmbed } from "@/components/auth/CaptchaEmbed";
import { IconBtn } from "@/components/ui/IconBtn";
import {
  login,
  register,
  requestPasswordReset,
} from "@/api/v2/auth";
import { ApiError } from "@/api/v2/client";
import {
  getCaptchaInfo,
  getPowChallenge,
  solvePoW,
} from "@/api/v2/config";
import type { ThemeColors } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
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

export type LoginModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  colors: ThemeColors;
  t: (k: string, p?: Record<string, string | number>) => string;
  fetchMeAndMaybeClose: (why: string) => Promise<void>;
};

type AuthMode = "login" | "register" | "reset";

export function LoginModal({
  visible,
  onRequestClose,
  colors,
  t,
  fetchMeAndMaybeClose,
}: LoginModalProps) {
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [password2, setPassword2] = React.useState("");
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [captchaInfo, setCaptchaInfo] = React.useState<{
    site_key: string;
    provider: string;
  } | null>(null);
  const [captchaKey, setCaptchaKey] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [powBusy, setPowBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resetSent, setResetSent] = React.useState(false);

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    setResetSent(false);
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
    (async () => {
      try {
        const c = await getCaptchaInfo();
        if (!cancelled && c.site_key) {
          setCaptchaInfo({
            site_key: c.site_key,
            provider: c.provider || "turnstile",
          });
        } else if (!cancelled) setCaptchaInfo(null);
      } catch {
        if (!cancelled) setCaptchaInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, mode]);

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setPassword2("");
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
    setError(null);
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    resetForm();
    setResetSent(false);
  };

  const runAuth = async () => {
    setError(null);
    const siteKey = captchaInfo?.site_key?.trim() ?? "";
    if (!siteKey) {
      setError(t("login.form.captchaUnavailable"));
      return;
    }
    if (!captchaToken) {
      setError(t("login.form.captchaRequired"));
      return;
    }
    if (mode === "login") {
      const u = username.trim();
      const p = password;
      if (!u || !p) {
        setError(t("login.form.fillAll"));
        return;
      }
      setBusy(true);
      setPowBusy(true);
      try {
        const pow = await getPowChallenge("login");
        const nonce = await solvePoW(pow.challenge, pow.difficulty);
        setPowBusy(false);
        await login({
          username: u,
          password: p,
          pow_challenge: pow.challenge,
          pow_nonce: nonce,
          captcha_response: captchaToken,
        });
        await fetchMeAndMaybeClose("v2-login");
        resetForm();
        onRequestClose();
      } catch (e) {
        setPowBusy(false);
        const msg =
          e instanceof ApiError
            ? String(e.message)
            : e instanceof Error
              ? e.message
              : t("login.form.failed");
        setError(msg);
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
      } finally {
        setBusy(false);
        setPowBusy(false);
      }
      return;
    }

    if (mode === "register") {
      const u = username.trim();
      const em = email.trim();
      const p = password;
      if (!u || !em || !p) {
        setError(t("login.form.fillAll"));
        return;
      }
      if (p !== password2) {
        setError(t("login.form.passwordMismatch"));
        return;
      }
      setBusy(true);
      setPowBusy(true);
      try {
        const pow = await getPowChallenge("register");
        const nonce = await solvePoW(pow.challenge, pow.difficulty);
        setPowBusy(false);
        await register({
          username: u,
          email: em,
          password: p,
          pow_challenge: pow.challenge,
          pow_nonce: nonce,
          captcha_response: captchaToken,
        });
        await fetchMeAndMaybeClose("v2-register");
        resetForm();
        onRequestClose();
      } catch (e) {
        setPowBusy(false);
        const msg =
          e instanceof ApiError
            ? String(e.message)
            : e instanceof Error
              ? e.message
              : t("login.form.failed");
        setError(msg);
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
      } finally {
        setBusy(false);
        setPowBusy(false);
      }
      return;
    }

    const em = email.trim();
    if (!em) {
      setError(t("login.form.emailRequired"));
      return;
    }
    setBusy(true);
    setPowBusy(true);
    try {
      const pow = await getPowChallenge("reset");
      const nonce = await solvePoW(pow.challenge, pow.difficulty);
      setPowBusy(false);
      await requestPasswordReset({
        email: em,
        pow_challenge: pow.challenge,
        pow_nonce: nonce,
        captcha_response: captchaToken,
      });
      setResetSent(true);
      resetForm();
    } catch (e) {
      setPowBusy(false);
      const msg =
        e instanceof ApiError
          ? String(e.message)
          : e instanceof Error
            ? e.message
            : t("login.form.failed");
      setError(msg);
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    } finally {
      setBusy(false);
      setPowBusy(false);
    }
  };

  const cardBg = colors.page || "#1e1e1e";
  const titleC = colors.title || "#fff";
  const subC = colors.sub || "#888";
  const accent = colors.accent || "#e64";

  return (
    <Modal
      statusBarTranslucent
      visible={visible}
      animationType="slide"
      onRequestClose={onRequestClose}
      transparent
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.card, { backgroundColor: cardBg, maxHeight: "92%" }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: titleC }]}>
              {mode === "login"
                ? t("menu.login")
                : mode === "register"
                  ? t("login.form.registerTitle")
                  : t("login.form.resetTitle")}
            </Text>
            <IconBtn
              ripple={"#fff2"}
              overlayColor={"rgba(255,255,255,0.12)"}
              onPress={onRequestClose}
              size={36}
            >
              <Feather name="x" size={20} color={titleC} />
            </IconBtn>
          </View>

          <View style={styles.tabs}>
            {(["login", "register", "reset"] as AuthMode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                style={[
                  styles.tab,
                  mode === m && { borderBottomColor: accent, borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={{
                    color: mode === m ? accent : subC,
                    fontWeight: mode === m ? "800" : "500",
                    fontSize: 13,
                  }}
                >
                  {m === "login"
                    ? t("menu.login")
                    : m === "register"
                      ? t("login.form.registerTab")
                      : t("login.form.resetTab")}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {resetSent ? (
              <Text style={[styles.hint, { color: subC }]}>
                {t("login.form.resetSent")}
              </Text>
            ) : null}

            {mode !== "reset" ? (
              <Text style={[styles.label, { color: subC }]}>
                {mode === "login"
                  ? t("login.form.identifier")
                  : t("login.form.username")}
              </Text>
            ) : null}
            {mode !== "reset" ? (
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                placeholder={
                  mode === "login"
                    ? t("login.form.identifierPh")
                    : t("login.form.usernamePh")
                }
                placeholderTextColor={subC + "99"}
                style={[
                  styles.input,
                  { color: titleC, borderColor: subC + "44", backgroundColor: colors.bg || "#111" },
                ]}
              />
            ) : null}

            {mode === "register" || mode === "reset" ? (
              <>
                <Text style={[styles.label, { color: subC }]}>
                  {t("login.form.email")}
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!busy}
                  placeholder="email@…"
                  placeholderTextColor={subC + "99"}
                  style={[
                    styles.input,
                    { color: titleC, borderColor: subC + "44", backgroundColor: colors.bg || "#111" },
                  ]}
                />
              </>
            ) : null}

            {mode !== "reset" ? (
              <>
                <Text style={[styles.label, { color: subC }]}>
                  {t("login.form.password")}
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  placeholder="••••••••"
                  placeholderTextColor={subC + "99"}
                  style={[
                    styles.input,
                    { color: titleC, borderColor: subC + "44", backgroundColor: colors.bg || "#111" },
                  ]}
                />
              </>
            ) : null}

            {mode === "register" ? (
              <>
                <Text style={[styles.label, { color: subC }]}>
                  {t("login.form.passwordAgain")}
                </Text>
                <TextInput
                  value={password2}
                  onChangeText={setPassword2}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  placeholder="••••••••"
                  placeholderTextColor={subC + "99"}
                  style={[
                    styles.input,
                    { color: titleC, borderColor: subC + "44", backgroundColor: colors.bg || "#111" },
                  ]}
                />
              </>
            ) : null}

            {captchaInfo?.site_key ? (
              <View style={styles.captchaBlock}>
                <Text style={[styles.label, { color: subC }]}>
                  {t("login.form.captcha")}
                </Text>
                <CaptchaEmbed
                  siteKey={captchaInfo.site_key}
                  provider={captchaInfo.provider}
                  resetKey={captchaKey}
                  onToken={(tok) => setCaptchaToken(tok)}
                  onClear={() => setCaptchaToken(null)}
                  accent={accent}
                  subColor={subC}
                />
              </View>
            ) : (
              <Text style={[styles.hint, { color: subC }]}>
                {t("login.form.captchaLoadHint")}
              </Text>
            )}

            {error ? (
              <View style={[styles.errBox, { backgroundColor: "#ff444422" }]}>
                <Text style={{ color: "#f88", fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={runAuth}
              disabled={busy || powBusy}
              style={({ pressed }) => ({
                backgroundColor: pressed ? accent + "cc" : accent,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 8,
                opacity: busy || powBusy ? 0.72 : 1,
              })}
            >
              <Text style={{ color: cardBg, fontWeight: "800", fontSize: 15 }}>
                {busy || powBusy
                  ? t("login.form.loginInProgress")
                  : mode === "reset"
                    ? t("login.form.submitReset")
                    : mode === "register"
                      ? t("login.form.submitRegister")
                      : t("login.form.submitLogin")}
              </Text>
            </Pressable>

            <Text style={[styles.footer, { color: subC }]}>
              nhentai.net · API v2
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontWeight: "900", fontSize: 18, flex: 1 },
  tabs: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ffffff18",
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  scrollContent: { paddingBottom: 12 },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
  },
  captchaBlock: { marginTop: 8 },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  errBox: { borderRadius: 10, padding: 12, marginTop: 12 },
  powRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  footer: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 16,
    opacity: 0.7,
  },
});
