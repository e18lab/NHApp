import { requestStoragePush, subscribeToStorageApplied } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList } from "react-native";
const COLS_KEY = "galleryColumns";
export const useColumns = (wide: boolean) => {
  const [cols, setCols] = useState(1);
  const listRef = useRef<FlatList>(null);
  const scrollY = useRef(0);
  const load = useCallback(() => {
    AsyncStorage.getItem(COLS_KEY).then((s) => {
      const saved = Math.min(Math.max(parseInt(s ?? "0") || 0, 1), 4);
      if (saved) setCols(saved);
      else setCols(wide ? 3 : 1);
    });
  }, [wide]);
  useEffect(() => {
    load();
    const unsub = subscribeToStorageApplied(load);
    return unsub;
  }, [load]);
  const cycleCols = useCallback(() => {
    const keep = scrollY.current;
    setCols((c) => {
      const max = wide ? 4 : 3;
      const n = c >= max ? 1 : c + 1;
      AsyncStorage.setItem(COLS_KEY, String(n));
      requestStoragePush();
      return n;
    });
    setTimeout(
      () => listRef.current?.scrollToOffset({ offset: keep, animated: false }),
      0
    );
  }, [wide]);
  const setScrollY = (y: number) => (scrollY.current = y);
  return { cols, setCols, cycleCols, listRef, setScrollY };
};
