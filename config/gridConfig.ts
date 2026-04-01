import { requestStoragePush } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
export type GridProfile = "phonePortrait" | "phoneLandscape" | "tabletPortrait" | "tabletLandscape";
export type GridConfig = {
  numColumns: number;
  paddingHorizontal: number;
  columnGap: number;
  minColumnWidth?: number;
};
export type GridConfigMap = Record<GridProfile, GridConfig>;
const STORAGE_KEY = "grid_config_map_v2";
export const defaultGridConfigMap: GridConfigMap = {
  phonePortrait:   { numColumns: 2, paddingHorizontal: 10, columnGap: 5,  minColumnWidth: 80 },
  phoneLandscape:  { numColumns: 4, paddingHorizontal: 10, columnGap: 5,  minColumnWidth: 80 },
  tabletPortrait:  { numColumns: 3, paddingHorizontal: 10, columnGap: 5,  minColumnWidth: 80 },
  tabletLandscape: { numColumns: 5, paddingHorizontal: 10, columnGap: 5,  minColumnWidth: 80 },
};
let currentMap: GridConfigMap = { ...defaultGridConfigMap };
type Listener = (map: GridConfigMap) => void;
const listeners = new Set<Listener>();
function notify() { for (const l of listeners) l(currentMap); }
export function getCurrentGridConfigMapSync(): GridConfigMap { return currentMap; }
export async function getGridConfigMap(): Promise<GridConfigMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GridConfigMap>;
      currentMap = { ...defaultGridConfigMap, ...parsed };
    }
  } catch {}
  return currentMap;
}
export async function setGridConfigMap(partial: Partial<GridConfigMap>): Promise<void> {
  currentMap = { ...currentMap, ...partial };
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentMap)); requestStoragePush(); } catch {}
  notify();
}
export async function resetGridConfigMap(): Promise<void> {
  currentMap = { ...defaultGridConfigMap };
  try { await AsyncStorage.removeItem(STORAGE_KEY); requestStoragePush(); } catch {}
  notify();
}
export function subscribeGridConfig(cb: Listener): () => void {
  listeners.add(cb);
  cb(currentMap);
  return () => listeners.delete(cb);
}
