import { requestStoragePush, subscribeToStorageApplied } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FilterItem } from "./TagFilterContext";
export type TagKind = "tags" | "artists" | "characters" | "parodies" | "groups";
export type TagRef = { type: TagKind; name: string };
export interface RecentItem extends TagRef {
  ts: number;
}
export interface TagCollection {
  id: string;
  name: string;
  items: FilterItem[];
  createdAt: number;
  updatedAt: number;
}
const K_RECENTS = "tagRecents.v1";
const K_COLLECTIONS = "tagCollections.v1";
const RECENT_LIMIT = 30;
interface Ctx {
  recents: RecentItem[];
  collections: TagCollection[];
  touchRecent: (t: TagRef) => void;
  createCollection: (name: string, items?: FilterItem[]) => string;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addItemToCollection: (id: string, item: FilterItem) => void;
  removeItemFromCollection: (id: string, item: TagRef) => void;
  replaceCollectionItems: (id: string, items: FilterItem[]) => void;
}
const TagLibCtx = createContext<Ctx>({
  recents: [],
  collections: [],
  touchRecent: () => {},
  createCollection: () => "",
  renameCollection: () => {},
  deleteCollection: () => {},
  addItemToCollection: () => {},
  removeItemFromCollection: () => {},
  replaceCollectionItems: () => {},
});
export function useTagLibrary() {
  return useContext(TagLibCtx);
}
const keyOf = (t: TagRef) => `${t.type}:${t.name}`;
export function TagLibraryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [collections, setCollections] = useState<TagCollection[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const [jr, jc] = await Promise.all([
          AsyncStorage.getItem(K_RECENTS),
          AsyncStorage.getItem(K_COLLECTIONS),
        ]);
        if (jr) setRecents(JSON.parse(jr));
        if (jc) setCollections(JSON.parse(jc));
      } catch {}
    })();
  }, []);
  const recentsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (recentsTimer.current) clearTimeout(recentsTimer.current);
    recentsTimer.current = setTimeout(() => {
      AsyncStorage.setItem(K_RECENTS, JSON.stringify(recents)).catch(() => {});
    }, 150);
    return () => {
      if (recentsTimer.current) clearTimeout(recentsTimer.current);
    };
  }, [recents]);
  const colTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (colTimer.current) clearTimeout(colTimer.current);
    colTimer.current = setTimeout(() => {
      AsyncStorage.setItem(K_COLLECTIONS, JSON.stringify(collections)).catch(
        () => {}
      );
      requestStoragePush();
    }, 150);
    return () => {
      if (colTimer.current) clearTimeout(colTimer.current);
    };
  }, [collections]);
  const touchRecent = useCallback((t: TagRef) => {
    const ts = Date.now();
    setRecents((prev) => {
      const map = new Map(prev.map((x) => [keyOf(x), x]));
      map.set(keyOf(t), { ...t, ts });
      const arr = Array.from(map.values())
        .sort((a, b) => b.ts - a.ts)
        .slice(0, RECENT_LIMIT);
      return arr;
    });
  }, []);
  const createCollection = useCallback(
    (name: string, items: FilterItem[] = []) => {
      const id = `col_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const now = Date.now();
      setCollections((prev) => [
        ...prev,
        { id, name, items, createdAt: now, updatedAt: now },
      ]);
      return id;
    },
    []
  );
  const renameCollection = useCallback((id: string, name: string) => {
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name, updatedAt: Date.now() } : c))
    );
  }, []);
  const deleteCollection = useCallback((id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }, []);
  const addItemToCollection = useCallback((id: string, item: FilterItem) => {
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const exists = c.items.some(
          (x) => x.type === item.type && x.name === item.name
        );
        if (exists) {
          return {
            ...c,
            items: c.items.map((x) =>
              x.type === item.type && x.name === item.name
                ? { ...x, mode: item.mode }
                : x
            ),
            updatedAt: Date.now(),
          };
        }
        return { ...c, items: [...c.items, item], updatedAt: Date.now() };
      })
    );
  }, []);
  const removeItemFromCollection = useCallback((id: string, item: TagRef) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.id !== id
          ? c
          : {
              ...c,
              items: c.items.filter(
                (x) => !(x.type === item.type && x.name === item.name)
              ),
              updatedAt: Date.now(),
            }
      )
    );
  }, []);
  const replaceCollectionItems = useCallback(
    (id: string, items: FilterItem[]) => {
      setCollections((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, items: items.slice(0), updatedAt: Date.now() }
            : c
        )
      );
    },
    []
  );
  const value = useMemo(
    () => ({
      recents,
      collections,
      touchRecent,
      createCollection,
      renameCollection,
      deleteCollection,
      addItemToCollection,
      removeItemFromCollection,
      replaceCollectionItems,
    }),
    [
      recents,
      collections,
      touchRecent,
      createCollection,
      renameCollection,
      deleteCollection,
      addItemToCollection,
      removeItemFromCollection,
      replaceCollectionItems,
    ]
  );
  return <TagLibCtx.Provider value={value}>{children}</TagLibCtx.Provider>;
}
