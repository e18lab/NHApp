/**
 * Electron: inline <webview> — аналог мобильного WebView с baseUrl nhentai.net.
 * HTML берётся из buildCaptchaHtml (site_key из GET /api/v2/captcha).
 * main.js обслуживает его через session.protocol.handle как https://nhentai.net/__captcha__
 * → Turnstile видит корректный origin и работает без всяких отдельных окон.
 */
import { buildCaptchaHtml } from "@/components/auth/captchaHtml";
import {
  NH_CAPTCHA_EMBED_URL,
  NH_CAPTCHA_PARTITION,
} from "@/components/auth/nhentaiCaptchaOrigin";
import React, { useEffect, useId, useRef } from "react";
import { StyleSheet, View } from "react-native";

const POLL_MS = 450;

const READ_TOKEN_JS = `(function(){
  var a=document.querySelector('textarea[name="cf-turnstile-response"]');
  if(a&&a.value)return a.value;
  var b=document.querySelector('input[name="cf-turnstile-response"]');
  return b&&b.value?b.value:'';
})()`;

export type ElectronWebviewTurnstileProps = {
  siteKey: string;
  provider: string;
  onToken: (token: string) => void;
  onClear?: () => void;
  resetKey?: number | string;
};

type WebviewEl = HTMLElement & {
  executeJavaScript: (code: string) => Promise<unknown>;
};

type ElWin = Window & {
  electron?: { setCaptchaHtml?: (html: string) => Promise<boolean> };
};

const NH_CAPTCHA_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/130.0.0.0 Safari/537.36";

export function ElectronWebviewTurnstile({
  siteKey,
  provider,
  onToken,
  onClear,
  resetKey = 0,
}: ElectronWebviewTurnstileProps) {
  const hostId = useId().replace(/:/g, "nh-wv-");
  const onTokenRef = useRef(onToken);
  const onClearRef = useRef(onClear);
  onTokenRef.current = onToken;
  onClearRef.current = onClear;
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined" || !siteKey) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let wv: WebviewEl | null = null;
    let mount: HTMLElement | null = null;
    let raf = 0;

    const stopPoll = () => {
      if (interval != null) { clearInterval(interval); interval = null; }
    };

    const startPoll = () => {
      stopPoll();
      interval = setInterval(() => {
        if (cancelled || !wv) return;
        wv.executeJavaScript(READ_TOKEN_JS)
          .then((raw) => {
            if (cancelled) return;
            const tok = typeof raw === "string" ? raw.trim() : "";
            if (tok.length > 20) {
              if (tok !== lastTokenRef.current) {
                lastTokenRef.current = tok;
                onTokenRef.current(tok);
              }
            } else if (lastTokenRef.current) {
              lastTokenRef.current = null;
              onClearRef.current?.();
            }
          })
          .catch(() => { /* гость ещё не готов */ });
      }, POLL_MS);
    };

    const run = async () => {
      const api = (window as ElWin).electron?.setCaptchaHtml;
      if (!api) { onClearRef.current?.(); return; }

      const html = buildCaptchaHtml(siteKey, provider);
      try { await api(html); } catch { onClearRef.current?.(); return; }
      if (cancelled) return;

      const waitMount = () => {
        if (cancelled) return;
        mount = document.getElementById(hostId);
        if (!mount) { raf = requestAnimationFrame(waitMount); return; }

        wv = document.createElement("webview") as WebviewEl;
        wv.setAttribute("src", NH_CAPTCHA_EMBED_URL);
        wv.setAttribute("partition", NH_CAPTCHA_PARTITION);
        wv.setAttribute("useragent", NH_CAPTCHA_UA);
        wv.style.cssText = "width:100%;height:120px;border:none;display:block;overflow:hidden;background:transparent;";

        wv.addEventListener("dom-ready", startPoll);
        wv.addEventListener("did-finish-load", startPoll);
        wv.addEventListener("did-fail-load", () => onClearRef.current?.());
        mount.appendChild(wv);
      };

      raf = requestAnimationFrame(waitMount);
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopPoll();
      if (wv) {
        try { if (mount?.contains(wv)) mount.removeChild(wv); } catch { /* ignore */ }
        wv = null;
      }
      lastTokenRef.current = null;
    };
  }, [hostId, siteKey, provider, resetKey]);

  return (
    <View style={styles.wrap}>
      <View nativeID={hostId} style={styles.host} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  host: { width: "100%", height: 120, overflow: "hidden", borderRadius: 8 },
});
