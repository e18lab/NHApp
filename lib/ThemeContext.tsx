import { getBaseHue, hsbToHex, setBaseHue } from "@/constants/Colors";
import { requestStoragePush, subscribeToStorageApplied } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
const STORAGE_KEY = "themeHue";
export interface ThemeColors {
  bg: string;
  page: string;
  shadow: string;
  accent: string;
  txt: string;
  sub: string;
  title: string;
  metaText: string;
  tagBg: string;
  tagText: string;
  newBadgeBg: string;
  incBg: string;
  incTxt: string;
  excBg: string;
  excTxt: string;
  searchBg: string;
  searchTxt: string;
  menuBg: string;
  menuTxt: string;
  related: string;
  surfaceElevated: string;
  iconOnSurface: string;
}
interface ThemeContextValue {
  hue: number;
  setHue: (deg: number) => void;
  colors: ThemeColors;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [hue, _setHue] = useState(getBaseHue());
  useEffect(() => {
    const load = () =>
      AsyncStorage.getItem(STORAGE_KEY).then((v) => {
        const deg = Number(v);
        if (!Number.isNaN(deg)) {
          setBaseHue(deg);
          _setHue(deg);
        }
      });
    load();
    const unsub = subscribeToStorageApplied(load);
    return unsub;
  }, []);
  const setHue = (deg: number) => {
    setBaseHue(deg);
    _setHue(deg);
    AsyncStorage.setItem(STORAGE_KEY, String(deg)).catch(console.warn);
    requestStoragePush();
  };
  const colors = useMemo<ThemeColors>(
    () => ({
      bg: hsbToHex({ saturation: 6, brightness: 36 }),
      page: hsbToHex({ saturation: 6, brightness: 28 }),
      shadow: "#000",
      accent: hsbToHex({ saturation: 78, brightness: 210 }),
      txt: hsbToHex({ saturation: 6, brightness: 235 }),
      sub: hsbToHex({ saturation: 0, brightness: 150 }),
      title: hsbToHex({ saturation: 16, brightness: 225 }),
      metaText: hsbToHex({ saturation: 8, brightness: 200 }),
      tagBg: hsbToHex({ saturation: 10, brightness: 48 }),
      tagText: hsbToHex({ saturation: 8, brightness: 225 }),
      newBadgeBg: "#ff4757",
      incBg: hsbToHex({ saturation: 52, brightness: 54 }),
      incTxt: hsbToHex({ saturation: 20, brightness: 225 }),
      excBg: hsbToHex({ saturation: 0, brightness: 42 }),
      excTxt: hsbToHex({ saturation: 0, brightness: 210 }),
      searchBg: hsbToHex({ saturation: 6, brightness: 34 }),
      searchTxt: hsbToHex({ saturation: 6, brightness: 235 }),
      menuBg: hsbToHex({ saturation: 6, brightness: 32 }),
      menuTxt: hsbToHex({ saturation: 6, brightness: 235 }),
      related: hsbToHex({ saturation: 6, brightness: 28 }),
      surfaceElevated: hsbToHex({ saturation: 6, brightness: 34 }),
      iconOnSurface: hsbToHex({ saturation: 8, brightness: 210 }),
    }),
    [hue]
  );
  return (
    <ThemeContext.Provider value={{ hue, setHue, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
