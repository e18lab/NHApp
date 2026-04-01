import {
  getAuthStorageReady,
  loadAccessToken,
  loadRefreshToken,
} from "@/api/v2/client";
import { logout as v2Logout } from "@/api/v2/auth";
import { getMe } from "@/api/v2/user";
import { syncOnlineMeFromAuth } from "@/hooks/useOnlineMe";
import type { Me } from "@/api/v2/types";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import React from "react";
import { WebViewMessageEvent, WebViewNavigation } from "react-native-webview";

export type TokensState = { access_token?: string; refresh_token?: string };

export function useAuthBridge(t: (k: string, p?: any) => string) {
  const [tokens, setTokens] = React.useState<TokensState>({});
  const [me, setMe] = React.useState<Me | null>(null);
  const [status, setStatus] = React.useState<string>("");
  const [wvBusy, setWvBusy] = React.useState(false);

  const isExpoGo = Constants.appOwnership === "expo";

  React.useEffect(() => {
    (async () => {
      await getAuthStorageReady();
      const [access, refresh] = await Promise.all([
        loadAccessToken(),
        loadRefreshToken(),
      ]);
      setTokens({
        access_token: access ?? undefined,
        refresh_token: refresh ?? undefined,
      });
      if (access) {
        try {
          const m = await getMe();
          if (m) {
            setMe(m);
            syncOnlineMeFromAuth(m);
          }
        } catch {}
      }
    })();
  }, []);

  const fetchMeAndMaybeClose = React.useCallback(
    async (why: string) => {
      try {
        await getAuthStorageReady();
        const [access, refresh] = await Promise.all([
          loadAccessToken(),
          loadRefreshToken(),
        ]);
        setTokens({
          access_token: access ?? undefined,
          refresh_token: refresh ?? undefined,
        });
        const m = await getMe();
        if (m) {
          setMe(m);
          syncOnlineMeFromAuth(m);
          setStatus(t("login.status.signedAs", { user: m.username, why }));
        } else {
          syncOnlineMeFromAuth(null);
          setStatus(t("login.status.notSigned", { why }));
        }
      } catch {
        setStatus(t("login.status.notSigned", { why }));
      }
    },
    [t]
  );

  const doLogout = React.useCallback(async () => {
    await v2Logout();
    setTokens({});
    setMe(null);
    syncOnlineMeFromAuth(null);
    setStatus(t("login.status.loggedOut"));
  }, [t]);

  // WebView nav handler — kept for backward compat with LoginModal.
  const handleNavChange = React.useCallback(
    (_navState: WebViewNavigation) => {
      setStatus(t("login.status.navigating"));
    },
    [t]
  );

  // Legacy WebView message handler — no-op with JWT auth.
  const onWvMessage = React.useCallback(
    async (_ev: WebViewMessageEvent) => {},
    []
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
    wvBusy,
    setWvBusy,
    isExpoGo,
    fetchMeAndMaybeClose,
    doLogout,
    onWvMessage,
    handleNavChange,
    copy,
    // Legacy stubs so destructuring callers don't crash
    csrfInput: tokens.access_token ?? "",
    setCsrfInput: (_v: string) => {},
    sessInput: tokens.refresh_token ?? "",
    setSessInput: (_v: string) => {},
    canUseNativeJar: false,
    refreshTokensFromJar: async (_reason: string) => {},
    applyManual: async (_csrf: string, _sess: string) => {},
  };
}
