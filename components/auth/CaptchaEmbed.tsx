/**
 * CAPTCHA widget (Turnstile / hCaptcha) — native: WebView (Android / iOS).
 * Web/Electron: см. CaptchaEmbed.web.tsx
 */
import { buildCaptchaHtml } from "@/components/auth/captchaHtml";
import { NHENTAI_ORIGIN } from "@/components/auth/nhentaiCaptchaOrigin";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  WebView,
  WebViewMessageEvent,
} from "react-native-webview";

export type CaptchaEmbedProps = {
  siteKey: string;
  provider: string;
  onToken: (token: string) => void;
  onClear?: () => void;
  /** Remount widget when this changes (e.g. after failed login). */
  resetKey?: number | string;
  /** Не используется на native; для единого интерфейса с web-версией. */
  accent?: string;
  subColor?: string;
};

export function CaptchaEmbed({
  siteKey,
  provider,
  onToken,
  onClear,
  resetKey = 0,
}: CaptchaEmbedProps) {
  const html = useMemo(
    () => buildCaptchaHtml(siteKey, provider),
    [siteKey, provider, resetKey]
  );

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const raw = e.nativeEvent.data;
      const d = JSON.parse(raw) as { type?: string; token?: string };
      if (d?.type === "nh-captcha") {
        if (d.token) onToken(d.token);
        else onClear?.();
      }
    } catch {
      /* ignore */
    }
  };

  if (!siteKey) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTxt}>Captcha</Text>
      </View>
    );
  }

  return (
    <WebView
      key={`captcha-${resetKey}`}
      originWhitelist={["*"]}
      source={{ html, baseUrl: `${NHENTAI_ORIGIN}/` }}
      onMessage={onMessage}
      style={styles.web}
      scrollEnabled={false}
      nestedScrollEnabled={false}
      javaScriptEnabled
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({
  web: { width: "100%", height: 120, backgroundColor: "transparent" },
  fallback: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.5,
  },
  fallbackTxt: { fontSize: 12 },
});
