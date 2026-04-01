import { requestStoragePush } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager } from "react-native";
export type ReadHistoryEntry = [number, number, number, number];
export type HistoryMap = Record<number, { current: number; total: number; ts: number }>;
const FAV_KEY = "bookFavorites";
const READ_HISTORY_KEY = "readHistory";
export function useFavHistory() {
  const loaded = useRef(false);
  const [favoritesSet, setFavoritesSet] = useState<Set<number>>(new Set());
  const [historyMap, setHistoryMap] = useState<HistoryMap>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        if (cancelled) return;
        const [favRaw, histRaw] = await Promise.all([
          AsyncStorage.getItem(FAV_KEY),
          AsyncStorage.getItem(READ_HISTORY_KEY),
        ]);
        if (cancelled) return;
        const favArr: number[] = favRaw ? JSON.parse(favRaw) : [];
        setFavoritesSet(new Set(favArr));
        if (histRaw) {
          try {
            const parsed = JSON.parse(histRaw) as ReadHistoryEntry[];
            const map: HistoryMap = {};
            for (const e of parsed) {
              const id = Number(e?.[0]);
              const current = Math.max(0, Math.floor(Number(e?.[1]) || 0));
              const total = Math.max(1, Math.floor(Number(e?.[2]) || 1));
              const ts = Math.floor(Number(e?.[3]) || 0);
              if (id) map[id] = { current: Math.min(current, total - 1), total, ts };
            }
            setHistoryMap(map);
          } catch {
            setHistoryMap({});
          }
        } else {
          setHistoryMap({});
        }
      } finally {
        if (!cancelled) {
          loaded.current = true;
          setReady(true);
        }
      }
    });
    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, []);
  const toggleFavorite = useCallback(async (id: number, next?: boolean) => {
    let shouldAdd: boolean = false;
    setFavoritesSet(prev => {
      const has = prev.has(id);
      shouldAdd = typeof next === "boolean" ? next : !has;
      const copy = new Set(prev);
      if (shouldAdd) copy.add(id);
      else copy.delete(id);
      return copy;
    });

    try {
      const raw = await AsyncStorage.getItem(FAV_KEY);
      const arr: number[] = raw ? JSON.parse(raw) : [];
      const s = new Set(arr);
      if (shouldAdd) s.add(id);
      else s.delete(id);
      await AsyncStorage.setItem(FAV_KEY, JSON.stringify(Array.from(s)));
      requestStoragePush();
    } catch (e) {
      console.error('[useFavHistory] Failed to save favorite:', e);
    }
  }, []);
  const value = useMemo(
    () => ({ favoritesSet, historyMap, ready, toggleFavorite }),
    [favoritesSet, historyMap, ready, toggleFavorite]
  );
  return value;
}
