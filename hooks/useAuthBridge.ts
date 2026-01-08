import {
    hasNativeCookieJar,
    loadTokens,
    logout,
    setManualTokens,
    syncNativeCookiesFromJar,
} from "@/api/auth";
import { getMe, type Me } from "@/api/nhentaiOnline";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import React from "react";
import { WebViewMessageEvent, WebViewNavigation } from "react-native-webview";

export type TokensState = { csrftoken?: string; sessionid?: string };

export function useAuthBridge(t: (k: string, p?: any) => string) {
  const [tokens, setTokens] = React.useState<TokensState>({});
  const [me, setMe] = React.useState<Me | null>(null);
  const [status, setStatus] = React.useState<string>("");

  const [csrfInput, setCsrfInput] = React.useState("");
  const [sessInput, setSessInput] = React.useState("");

  const [wvBusy, setWvBusy] = React.useState(false);

  const canUseNativeJar = hasNativeCookieJar();
  const isExpoGo = Constants.appOwnership === "expo";

  React.useEffect(() => {
    (async () => {
      const tks = await loadTokens();
      setTokens(tks);
      setCsrfInput(tks.csrftoken ?? "");
      setSessInput(tks.sessionid ?? "");
      try {
        const m = await getMe();
        if (m) setMe(m);
      } catch {}
    })();
  }, []);

  const fetchMeAndMaybeClose = React.useCallback(
    async (why: string) => {
      try {
        console.log(`[useAuthBridge] fetchMeAndMaybeClose called: ${why}`);
        
        // Проверяем токены перед запросом
        const tokens = await loadTokens();
        console.log(`[useAuthBridge] Current tokens:`, { 
          csrf: !!tokens.csrftoken, 
          session: !!tokens.sessionid 
        });
        
        const m = await getMe();
        console.log(`[useAuthBridge] getMe result:`, m ? { 
          id: m.id, 
          username: m.username,
          slug: m.slug 
        } : null);
        
        if (m) {
          setMe(m);
          setStatus(t("login.status.signedAs", { user: m.username, why }));
          console.log(`[useAuthBridge] User set successfully: ${m.username}`);
          console.log(`[useAuthBridge] State updated, me should be visible now`);
        } else {
          console.warn(`[useAuthBridge] getMe returned null/undefined`);
          console.warn(`[useAuthBridge] This might mean cookies are not working or user is not logged in`);
          setStatus(t("login.status.notSigned", { why }));
        }
      } catch (err) {
        console.error(`[useAuthBridge] getMe error:`, err);
        setStatus(t("login.status.notSigned", { why }));
      }
    },
    [t]
  );

  const refreshTokensFromJar = React.useCallback(
    async (reason: string) => {
      if (!canUseNativeJar) return;
      try {
        const synced = await syncNativeCookiesFromJar();
        setTokens(synced);
        if (synced.csrftoken) setCsrfInput(synced.csrftoken);
        if (synced.sessionid) setSessInput(synced.sessionid);
        setStatus(t("login.status.cookiesSynced", { reason }));
        await fetchMeAndMaybeClose("cookies");
      } catch (e) {
        setStatus(t("login.status.cookiesFailed", { reason }));
        console.log("[auth] sync error:", e);
      }
    },
    [canUseNativeJar, fetchMeAndMaybeClose, t]
  );

  const applyManual = React.useCallback(
    async (nextCsrf: string, nextSess: string) => {
      await setManualTokens(
        nextCsrf?.trim() || undefined,
        nextSess?.trim() || undefined
      );
      const curr = await loadTokens();
      setTokens(curr);
      setStatus(t("login.status.tokensSaved"));
      await fetchMeAndMaybeClose("manual");
    },
    [fetchMeAndMaybeClose, t]
  );

  const doLogout = React.useCallback(async () => {
    await logout();
    const curr = await loadTokens();
    setTokens(curr);
    setMe(null);
    setCsrfInput("");
    setSessInput("");
    setStatus(t("login.status.loggedOut"));
  }, [setTokens, setMe, t]);

  const onWvMessage = React.useCallback(
    async (ev: WebViewMessageEvent) => {
      try {
        const data = JSON.parse((ev as any)?.nativeEvent?.data);
        if (data?.type === "cookies") {
          const cookies = data.cookies || {};
          const csrf: string | undefined =
            typeof cookies.csrftoken === "string"
              ? cookies.csrftoken
              : undefined;
          if (csrf) {
            await setManualTokens(csrf, undefined);
            const now = await loadTokens();
            setTokens(now);
            setCsrfInput(now.csrftoken ?? "");
          }
          if (canUseNativeJar) {
            await refreshTokensFromJar("wv-msg");
          } else {
            await fetchMeAndMaybeClose("webview");
          }
        }
      } catch {}
    },
    [canUseNativeJar, refreshTokensFromJar, fetchMeAndMaybeClose]
  );

  const handleNavChange = React.useCallback(
    (_navState: WebViewNavigation) => {
      setStatus(t("login.status.navigating"));
      if (canUseNativeJar) refreshTokensFromJar("nav");
    },
    [canUseNativeJar, refreshTokensFromJar, t]
  );

  const copy = React.useCallback(async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch {}
  }, []);

  return {
    tokens,
    me,
    status,
    csrfInput,
    setCsrfInput,
    sessInput,
    setSessInput,
    wvBusy,
    setWvBusy,
    canUseNativeJar,
    isExpoGo,
    fetchMeAndMaybeClose,
    refreshTokensFromJar,
    applyManual,
    doLogout,
    onWvMessage,
    handleNavChange,
    copy,
  };
}
