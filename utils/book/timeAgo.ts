import type { Locale as DFLocale } from "date-fns";
export type UiLocale = "en" | "ru" | "zh" | "ja";
type UnitKey = "year" | "month" | "day" | "hour" | "minute" | "second";
const translations: Record<
  UiLocale,
  {
    units: Record<UnitKey, string[]>; 
    justNow: string;
    ago: string;
  }
> = {
  en: {
    units: {
      year: ["year", "years"],
      month: ["month", "months"],
      day: ["day", "days"],
      hour: ["hour", "hours"],
      minute: ["minute", "minutes"],
      second: ["second", "seconds"],
    },
    justNow: "just now",
    ago: "ago",
  },
  ru: {
    units: {
      year: ["год", "года", "лет"],
      month: ["месяц", "месяца", "месяцев"],
      day: ["день", "дня", "дней"],
      hour: ["час", "часа", "часов"],
      minute: ["минута", "минуты", "минут"],
      second: ["секунда", "секунды", "секунд"],
    },
    justNow: "только что",
    ago: "назад",
  },
  zh: {
    units: {
      year: ["年", "年"],
      month: ["个月", "个月"],
      day: ["天", "天"],
      hour: ["小时", "小时"],
      minute: ["分钟", "分钟"],
      second: ["秒", "秒"],
    },
    justNow: "刚刚",
    ago: "前",
  },
  ja: {
    units: {
      year: ["年", "年"],
      month: ["ヶ月", "ヶ月"],
      day: ["日", "日"],
      hour: ["時間", "時間"],
      minute: ["分", "分"],
      second: ["秒", "秒"],
    },
    justNow: "たった今",
    ago: "前",
  },
};
function pluralRu(n: number, forms: [string, string, string]) {
  return forms[
    n % 10 === 1 && n % 100 !== 11
      ? 0
      : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
      ? 1
      : 2
  ];
}
function normalizeLocale(loc?: UiLocale | DFLocale): UiLocale {
  if (!loc) return "en";
  if (typeof loc === "string") {
    if (loc === "zh") return "zh";
    return (["en", "ru", "zh", "ja"].includes(loc) ? loc : "en") as UiLocale;
  }
  const code = (loc as any)?.code as string | undefined;
  if (code) {
    const lower = code.toLowerCase();
    if (lower.startsWith("ru")) return "ru";
    if (lower.startsWith("ja")) return "ja";
    if (lower.startsWith("zh")) return "zh";
    return "en";
  }
  return "en";
}
function toDate(input: string | number | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === "string") {
    const t = Date.parse(input);
    return Number.isFinite(t) ? new Date(t) : new Date();
  }
  return new Date(input < 1e12 ? input * 1000 : input);
}
export function timeAgo(
  d: string | number | Date,
  locale?: UiLocale | DFLocale
): string {
  const date = toDate(d);
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const l = normalizeLocale(locale);
  const tr = translations[l];
  const table: [UnitKey, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, secs] of table) {
    if (s >= secs) {
      const v = Math.floor(s / secs);
      if (l === "ru") {
        return `${v} ${pluralRu(v, tr.units[unit] as [string, string, string])} ${tr.ago}`;
      }
      if (l === "zh" || l === "ja") {
        return `${v}${tr.units[unit][0]}${tr.ago}`;
      }
      return `${v} ${tr.units[unit][v === 1 ? 0 : 1]} ${tr.ago}`;
    }
  }
  return tr.justNow;
}
