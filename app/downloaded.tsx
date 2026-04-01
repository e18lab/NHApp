import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Platform, Text } from "react-native";
import { getDownloadProgressSnapshot, subscribeDownloadProgress } from "@/lib/downloadProgressStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Book } from "@/api/nhappApi/types";
import BookList from "@/components/BookList";
import ListSortBar, { isListSortValue, ListSortValue } from "@/components/ListSortBar";
import { useGridConfig } from "@/hooks/useGridConfig";
import { useI18n } from "@/lib/i18n/I18nContext";
import { electronFileSystem } from "@/utils/electronFileSystem";

export default function DownloadedScreen() {
  const [downloadedBooks, setDownloadedBooks] = useState<Book[]>([]);
  const [sort, setSort] = useState<ListSortValue>("added_desc");
  const [pending, setPending] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const gridConfig = useGridConfig();
  const { t } = useI18n();

  const dlSnap = React.useSyncExternalStore(
    subscribeDownloadProgress,
    getDownloadProgressSnapshot,
    getDownloadProgressSnapshot
  );

  React.useEffect(() => {
    AsyncStorage.getItem("ui.sort.downloaded")
      .then((v) => {
        if (isListSortValue(v)) setSort(v);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    AsyncStorage.setItem("ui.sort.downloaded", sort).catch(() => {});
  }, [sort]);

  const fetchDownloadedBooks = useCallback(async () => {
    setPending(true);
    try {
      const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;
      let nhDir: string;
      let fs: any;
      let pathJoin: (...paths: string[]) => Promise<string>;
      if (isElectron) {
        try {
          const baseDir = await electronFileSystem.getDocumentDirectory();
          const electron = (window as any).electron;
          const baseDirTrimmed = baseDir.endsWith(await electron.pathSep()) 
            ? baseDir.slice(0, -1) 
            : baseDir;
          nhDir = await electron.pathJoin(baseDirTrimmed, "NHAppAndroid") + await electron.pathSep();
          fs = electronFileSystem;
          pathJoin = async (...paths: string[]) => {
            const sep = await electron.pathSep();
            const cleanedPaths: string[] = [];
            for (let i = 0; i < paths.length; i++) {
              const p = paths[i];
              if (i === paths.length - 1) {
                cleanedPaths.push(p);
              } else {
                cleanedPaths.push(p.endsWith(sep) ? p.slice(0, -1) : p);
              }
            }
            return await electron.pathJoin(...cleanedPaths);
          };
        } catch (err) {
          console.error("[fetchDownloadedBooks] Failed to get Electron document directory:", err);
          setDownloadedBooks([]);
          return;
        }
      } else {
        nhDir = `${FileSystem.documentDirectory}NHAppAndroid/`;
        fs = FileSystem;
        pathJoin = async (...paths: string[]) => {
          const cleanedPaths = paths.map((p, i) => {
            if (i === paths.length - 1) return p;
            return p.endsWith("/") ? p.slice(0, -1) : p;
          });
          return cleanedPaths.join("/");
        };
      }

      const info = await fs.getInfoAsync(nhDir);
      if (!info.exists) {
        setDownloadedBooks([]);
        return;
      }

      const titles = await fs.readDirectoryAsync(nhDir);
      const books: Array<Book & { __downloadedAt?: number }> = [];

      for (const title of titles) {
        try {
          const titleDir = await pathJoin(nhDir, title);
          const idMatch = title.match(/^(\d+)_/);
          const titleId = idMatch ? Number(idMatch[1]) : null;
          const titleInfo = await fs.getInfoAsync(titleDir);
          if (!titleInfo.exists || !titleInfo.isDirectory) continue;
          const langs = await fs.readDirectoryAsync(titleDir);

          for (const lang of langs) {
            try {
              const langDir = await pathJoin(titleDir, lang);
              const langInfo = await fs.getInfoAsync(langDir);
              if (!langInfo.exists || !langInfo.isDirectory) continue;
              const metaUri = await pathJoin(langDir, "metadata.json");
              const metaInfo = await fs.getInfoAsync(metaUri);
              if (!metaInfo.exists) continue;
              const raw = await fs.readAsStringAsync(metaUri);
              const book: Book = JSON.parse(raw);
              if (titleId && book.id !== titleId) continue;

              // Fast path: only resolve cover (don't build pages[] — expensive during active download).
              const files = await fs.readDirectoryAsync(langDir);
              const imageFiles = files.filter((f: string) => f.startsWith("Image"));
              if (imageFiles.length === 0) continue;
              let first = imageFiles[0];
              for (const f of imageFiles) {
                // Prefer Image001.* if present, otherwise minimal numeric suffix.
                if (/^Image0*1\./i.test(f)) { first = f; break; }
                const a = parseInt(first.match(/\d+/)?.[0] || "0", 10);
                const b = parseInt(f.match(/\d+/)?.[0] || "0", 10);
                if (b > 0 && (a === 0 || b < a)) first = f;
              }
              const imgPath = await pathJoin(langDir, first);
              const url = (() => {
                if (!isElectron) return imgPath;
                const normalizedPath = String(imgPath).replace(/\\/g, "/");
                return normalizedPath.match(/^[A-Za-z]:/)
                  ? `local:///${normalizedPath}`
                  : normalizedPath.startsWith("/")
                    ? `local://${normalizedPath}`
                    : `local:///${normalizedPath}`;
              })();
              const downloadedAt =
                (metaInfo as any)?.modificationTime ??
                (metaInfo as any)?.mtime ??
                (titleInfo as any)?.modificationTime ??
                Date.now();

              books.push({
                ...book,
                cover: url || book.cover,
                thumbnail: url || book.thumbnail,
                pages: [], // not needed for list
                __downloadedAt: typeof downloadedAt === "number" ? downloadedAt : Date.now(),
              } as any);
            } catch (langErr) {
              console.warn(`[fetchDownloadedBooks] Error processing lang ${lang} in ${title}:`, langErr);
              continue;
            }
          }
        } catch (titleErr) {
          console.warn(`[fetchDownloadedBooks] Error processing title ${title}:`, titleErr);
          continue;
        }
      }

      // Keep default order as "added_desc" baseline (most recent first)
      books.sort((a, b) => (b.__downloadedAt ?? 0) - (a.__downloadedAt ?? 0));
      const unique = Array.from(
        books
          .reduce(
            (map, b) => (map.has(b.id) ? map : map.set(b.id, b)),
            new Map<number, Book>()
          )
          .values()
      );
      setDownloadedBooks(unique);
    } catch (e) {
      console.error("Error reading downloads:", e);
      setDownloadedBooks([]);
    } finally {
      setPending(false);
    }
  }, []);

  const sortedBooks = React.useMemo(() => {
    const base = [...downloadedBooks] as any[];
    const getYear = (b: any) => {
      const d = b?.uploaded ? new Date(b.uploaded) : null;
      const y = d && Number.isFinite(d.getTime()) ? d.getFullYear() : 0;
      return y || 0;
    };
    const getTitle = (b: any) => String(b?.title?.pretty ?? "").toLowerCase();
    const getAdded = (b: any) => Number(b?.__downloadedAt ?? 0);

    switch (sort) {
      case "added_asc":
        base.sort((a, b) => getAdded(a) - getAdded(b));
        break;
      case "added_desc":
        base.sort((a, b) => getAdded(b) - getAdded(a));
        break;
      case "year_asc":
        base.sort((a, b) => getYear(a) - getYear(b));
        break;
      case "year_desc":
        base.sort((a, b) => getYear(b) - getYear(a));
        break;
      case "alpha_asc":
        base.sort((a, b) => getTitle(a).localeCompare(getTitle(b)));
        break;
      case "alpha_desc":
        base.sort((a, b) => getTitle(b).localeCompare(getTitle(a)));
        break;
    }
    return base as Book[];
  }, [downloadedBooks, sort]);

  useFocusEffect(
    useCallback(() => {
      fetchDownloadedBooks();
    }, [fetchDownloadedBooks])
  );

  // When a download finishes, refresh list automatically so the new book appears.
  React.useEffect(() => {
    if (!dlSnap.lastFinishedAt) return;
    void fetchDownloadedBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlSnap.lastFinishedAt]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDownloadedBooks();
    setRefreshing(false);
  }, [fetchDownloadedBooks]);

  return (
    <>
      <BookList
        data={[
          ...(dlSnap.active && dlSnap.bookId
            ? ([
                {
                  __downloading: true,
                  __downloadProgress: dlSnap.progress,
                  id: -dlSnap.bookId,
                  title: { pretty: dlSnap.title || "Downloading", english: "", japanese: "" },
                  cover: dlSnap.cover || "",
                  thumbnail: dlSnap.cover || "",
                  uploaded: "",
                  media: 0,
                  favorites: 0,
                  pagesCount: 0,
                  scanlator: "",
                  tags: [],
                  pages: [],
                  artists: [],
                  characters: [],
                  parodies: [],
                  groups: [],
                  categories: [],
                  languages: [],
                  tagIds: [],
                } as any,
              ] as Book[])
            : []),
          ...sortedBooks,
        ]}
        loading={pending}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <ListSortBar
            count={sortedBooks.length + (dlSnap.active && dlSnap.bookId ? 1 : 0)}
            sort={sort}
            onChangeSort={setSort}
          />
        }
        onPress={(id) => {
          // Don't open the placeholder "downloading" card.
          if (typeof id === "number" && id < 0) return;
          router.push({
            pathname: "/book/[id]",
            params: {
              id: String(id),
              title: downloadedBooks.find((b) => b.id === id)?.title.pretty,
            },
          });
        }}
        ListEmptyComponent={
          !pending && downloadedBooks.length === 0 ? (
            <Text style={{ textAlign: "center", marginTop: 40, color: "#888" }}>
              {t("downloaded.noHaveADownloadBook")}
            </Text>
          ) : null
        }
        gridConfig={{ default: gridConfig }}
      />
    </>
  );
}
