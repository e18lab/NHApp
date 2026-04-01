import type { MenuRoute } from "@/types/routes";
export type MenuItem = {
  labelKey: string;
  icon: string;
  route: MenuRoute;
  /** Не вести по маршруту — только заглушка (замок / «Скоро»). */
  locked?: boolean;
};
export const LIBRARY_MENU: MenuItem[] = [
  { labelKey: "menu.downloaded", icon: "download", route: "/downloaded" },
  { labelKey: "menu.favorites", icon: "bookmark", route: "/favorites" },
  {
    labelKey: "menu.favoritesOnline",
    icon: "heart",
    route: "/favoritesOnline",
  },
  { labelKey: "menu.history", icon: "clock", route: "/history" },
  { labelKey: "menu.characters", icon: "package", route: "/characters" },
  {
    labelKey: "menu.recommendations",
    icon: "star",
    route: "/recommendations",
  },
  { labelKey: "menu.settings", icon: "settings", route: "/settings" },
];
