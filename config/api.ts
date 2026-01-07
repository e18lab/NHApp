import { NativeModules, Platform } from "react-native";

function getDevHostFromScriptURL(): string | null {
  const url: unknown = (NativeModules as any)?.SourceCode?.scriptURL;
  if (typeof url !== "string" || url.length === 0) return null;
  const m = url.match(/^https?:\/\/([^/:]+)(?::\d+)?\//i);
  return m?.[1] ?? null;
}

function replaceHost(raw: string, host: string): string {
  return raw.replace(/^https?:\/\/([^/:]+)(?::(\d+))?/i, (full, _h, port) => {
    const scheme = full.startsWith("https://") ? "https" : "http";
    return `${scheme}://${host}${port ? `:${port}` : ""}`;
  });
}

function normalizeDevBaseUrl(raw: string): string {
  const isLocalhost =
    raw.startsWith("http://localhost") ||
    raw.startsWith("https://localhost") ||
    raw.startsWith("http://127.0.0.1") ||
    raw.startsWith("https://127.0.0.1");

  if (!isLocalhost) return raw;

  if (Platform.OS === "android") {
    const metroHost = getDevHostFromScriptURL();
    if (metroHost) return replaceHost(raw, metroHost);

    return raw
      .replace("http://localhost", "http://10.0.2.2")
      .replace("http://127.0.0.1", "http://10.0.2.2");
  }

  return raw;
}

const RAW_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

export const API_BASE_URL: string = RAW_BASE
  ? __DEV__
    ? normalizeDevBaseUrl(RAW_BASE)
    : RAW_BASE
  : __DEV__
  ? "http://10.0.2.2:3000" 
  : "";

export const API_TIMEOUT_MS = 10000;
