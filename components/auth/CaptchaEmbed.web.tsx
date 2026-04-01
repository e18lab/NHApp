/**
 * Web: Turnstile/hCaptcha загружается скриптом в документ приложения.
 * Electron: используем ElectronWebviewTurnstile — inline <webview> с nhentai.net origin
 *           (то же что baseUrl на мобильном WebView, только через session.protocol.handle).
 */
import { ElectronCaptchaButton } from "@/components/auth/ElectronCaptchaButton";
import { ElectronWebviewTurnstile } from "@/components/auth/ElectronWebviewTurnstile";
import React, { useEffect, useId, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const HCAPTCHA_SRC  = "https://js.hcaptcha.com/1/api.js";
const ID_TURNSTILE  = "nh-script-turnstile-v0";
const ID_HCAPTCHA   = "nh-script-hcaptcha-v1";

function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as Window & { electron?: { isElectron?: boolean } }).electron?.isElectron === true
  );
}

function loadScript(src: string, id: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === "1") return Promise.resolve();
  if (existing) return new Promise((res, rej) => {
    existing.addEventListener("load", () => res(), { once: true });
    existing.addEventListener("error", () => rej(new Error("script")), { once: true });
  });
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.id = id; s.src = src; s.async = true;
    s.onload = () => { s.dataset.loaded = "1"; res(); };
    s.onerror = () => rej(new Error("script"));
    document.head.appendChild(s);
  });
}

async function waitFor(check: () => boolean, maxMs = 8000) {
  const t = Date.now();
  while (Date.now() - t < maxMs) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error("timeout");
}

declare global {
  interface Window {
    turnstile?: {
      render: (c: HTMLElement | string, o: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
    hcaptcha?: {
      render: (c: HTMLElement, o: Record<string, unknown>) => number;
      remove: (id: number) => void;
    };
  }
}

export type CaptchaEmbedProps = {
  siteKey: string;
  provider: string;
  onToken: (token: string) => void;
  onClear?: () => void;
  resetKey?: number | string;
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
  const isHcaptcha = (provider || "").toLowerCase().includes("hcaptcha");

  const rid = useId().replace(/:/g, "");
  const containerId = `nh-captcha-host-${rid}`;
  const widgetId = useRef<string | null>(null);
  const hcapId   = useRef<number | null>(null);
  const onTokenRef = useRef(onToken);
  const onClearRef = useRef(onClear);
  onTokenRef.current = onToken;
  onClearRef.current = onClear;

  // Electron → inline webview, минуя этот useEffect
  const useWebview = Platform.OS === "web" && isElectron();

  useEffect(() => {
    if (useWebview || Platform.OS !== "web" || !siteKey) return;
    let cancelled = false;

    const cleanup = () => {
      const el = document.getElementById(containerId);
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
        widgetId.current = null;
      }
      if (hcapId.current != null && window.hcaptcha) {
        try { window.hcaptcha.remove(hcapId.current); } catch { /* ignore */ }
        hcapId.current = null;
      }
      if (el) el.innerHTML = "";
    };

    const run = async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const el = document.getElementById(containerId);
      if (!el || cancelled) return;
      try {
        if (isHcaptcha) {
          await loadScript(HCAPTCHA_SRC, ID_HCAPTCHA);
          await waitFor(() => !!window.hcaptcha?.render);
          if (cancelled) return;
          const id = window.hcaptcha!.render(el, {
            sitekey: siteKey, theme: "dark",
            callback: (t: string) => onTokenRef.current(t),
            "expired-callback": () => onClearRef.current?.(),
            "error-callback": () => onClearRef.current?.(),
          });
          hcapId.current = typeof id === "number" ? id : null;
        } else {
          await loadScript(TURNSTILE_SRC, ID_TURNSTILE);
          await waitFor(() => !!window.turnstile?.render);
          if (cancelled) return;
          const id = window.turnstile!.render(el, {
            sitekey: siteKey, theme: "dark",
            callback: (t: string) => onTokenRef.current(t),
            "expired-callback": () => onClearRef.current?.(),
            "error-callback": () => onClearRef.current?.(),
          });
          widgetId.current = id;
        }
      } catch { onClearRef.current?.(); }
    };

    void run();
    return () => { cancelled = true; cleanup(); };
  }, [useWebview, siteKey, provider, resetKey, containerId, isHcaptcha]);

  if (!siteKey) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTxt}>Captcha</Text>
      </View>
    );
  }

  if (useWebview) {
    return (
      <ElectronCaptchaButton
        onToken={onToken}
        onClear={onClear}
        resetKey={resetKey}
      />
    );
  }

  return (
    <View style={styles.wrap} key={`captcha-wrap-${resetKey}`}>
      <View nativeID={containerId} style={styles.host} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", minHeight: 72 },
  host: { width: "100%", minHeight: 70 },
  fallback: { height: 72, justifyContent: "center", alignItems: "center", opacity: 0.5 },
  fallbackTxt: { fontSize: 12 },
});
