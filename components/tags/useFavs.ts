import { requestStoragePush } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { FAV_KEY, FAV_KEY_LEGACY, favKeyOf, normalizeFavMap } from "./helpers";
export function useFavs() {
  const [favs, setFavs] = useState<Record<string, true>>({});
  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([FAV_KEY, FAV_KEY_LEGACY]);
        const curr = pairs.find(([k]) => k === FAV_KEY)?.[1];
        const legacy = pairs.find(([k]) => k === FAV_KEY_LEGACY)?.[1];
        let map: Record<string, true> = {};
        if (curr) map = { ...map, ...normalizeFavMap(JSON.parse(curr)) };
        if (legacy) map = { ...map, ...normalizeFavMap(JSON.parse(legacy)) };
        setFavs(map);
        await AsyncStorage.setItem(FAV_KEY, JSON.stringify(map));
        requestStoragePush();
      } catch {}
    })();
  }, []);
  const writeFavs = useCallback((next: Record<string, true>) => {
    setFavs(next);
    AsyncStorage.setItem(FAV_KEY, JSON.stringify(next)).catch(() => {});
    requestStoragePush();
  }, []);
  const isFav = useCallback(
    (t: { type: string; name: string }) => !!favs[favKeyOf(t)],
    [favs]
  );
  const toggleFav = useCallback(
    (t: { type: string; name: string }) => {
      const k = favKeyOf(t);
      const next = { ...favs };
      if (next[k]) delete next[k];
      else next[k] = true as const;
      writeFavs(next);
    },
    [favs, writeFavs]
  );
  const favsHash = Object.keys(favs).sort().join(",");
  return { isFav, toggleFav, favsHash };
}
