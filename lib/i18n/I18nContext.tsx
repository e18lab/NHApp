import { requestStoragePush, subscribeToStorageApplied } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Locale } from "date-fns";
import { enUS, ja, ru, zhCN } from "date-fns/locale";
import * as Localization from "expo-localization";
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
const dictionaries: Record<string, any> = {
  en: require("@/assets/i18n/en.json"),
  ru: require("@/assets/i18n/ru.json"),
  ja: require("@/assets/i18n/ja.json"),
  zh: require("@/assets/i18n/zh.json"),
};
export type AppLocale = "system" | "en" | "ru" | "zh" | "ja";
const LANG_KEY = "app_language";
function normalizeDeviceLocale(): "en" | "ru" | "zh" | "ja" {
  const tag = (
    Localization.getLocales?.()[0]?.languageCode || "en"
  ).toLowerCase();
  if (tag.startsWith("ru") || tag === "uk" || tag === "be") return "ru";
  if (tag.startsWith("zh")) return "zh";
  if (tag.startsWith("ja")) return "ja";
  return "en";
}
type I18nValue = {
  locale: AppLocale;
  resolved: "en" | "ru" | "zh" | "ja";
  resolvedDateFns: Locale;
  setLocale: (l: AppLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  available: { code: AppLocale; label: string }[];
};
const I18nCtx = createContext<I18nValue | null>(null);
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [locale, setLocale] = useState<AppLocale>("system");
  const resolved = useMemo(
    () => (locale === "system" ? normalizeDeviceLocale() : locale),
    [locale]
  );
  const localeMap: Record<"en" | "ru" | "ja" | "zh", Locale> = {
    en: enUS,
    ru: ru,
    ja: ja,
    zh: zhCN,
  };
  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (
          saved === "en" ||
          saved === "ru" ||
          saved === "zh" ||
          saved === "ja" ||
          saved === "system"
        ) {
          setLocale(saved);
        }
      } catch {}
    };
    load();
    const unsub = subscribeToStorageApplied(load);
    return unsub;
  }, []);
  const dict = dictionaries[resolved] || dictionaries.en;
  const fallback = dictionaries.en;
  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>) => {
      const direct = (o: any, k: string) =>
        o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
      const raw =
        direct(dict, key) ??
        get(dict, key) ??
        direct(fallback, key) ??
        get(fallback, key) ??
        key;
      if (!params) return String(raw);
      return String(raw).replace(/\{(\w+)\}/g, (_, name) =>
        String(params[name] ?? "")
      );
    },
    [dict, fallback]
  );
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      resolved,
      resolvedDateFns: localeMap[resolved],
      setLocale: (l) => {
        setLocale(l);
        AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
        requestStoragePush();
      },
      t,
      available: [
        { code: "system", label: t("settings.language.system") },
        { code: "en", label: t("settings.language.english") },
        { code: "ru", label: t("settings.language.russian") },
        { code: "zh", label: t("settings.language.chinese") },
        { code: "ja", label: t("settings.language.japanese") },
      ],
    }),
    [locale, resolved, t]
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
};
export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
function get(obj: any, path: string): any {
  return path
    .split(".")
    .reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}
