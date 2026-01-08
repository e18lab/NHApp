import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Platform, Text } from "react-native";

import { Book, BookPage } from "@/api/nhentai";
import BookList from "@/components/BookList";
import { useGridConfig } from "@/hooks/useGridConfig";
import { useI18n } from "@/lib/i18n/I18nContext";
import { electronFileSystem } from "@/utils/electronFileSystem";

export default function DownloadedScreen() {
  const [downloadedBooks, setDownloadedBooks] = useState<Book[]>([]);
  const [pending, setPending] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const gridConfig = useGridConfig();
  const { t } = useI18n();

  const fetchDownloadedBooks = useCallback(async () => {
    setPending(true);
    try {
      // Для Electron используем electronFileSystem, для нативных платформ - expo-file-system
      const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;
      
      let nhDir: string;
      let fs: any;
      let pathJoin: (...paths: string[]) => string;
      
      if (isElectron) {
        try {
          const baseDir = await electronFileSystem.getDocumentDirectory();
          const electron = (window as any).electron;
          // Убираем завершающий разделитель перед pathJoin, чтобы избежать двойных слэшей
          const baseDirTrimmed = baseDir.endsWith(await electron.pathSep()) 
            ? baseDir.slice(0, -1) 
            : baseDir;
          nhDir = await electron.pathJoin(baseDirTrimmed, "NHAppAndroid") + await electron.pathSep();
          fs = electronFileSystem;
          pathJoin = async (...paths: string[]) => {
            // Убираем завершающие разделители из всех путей кроме последнего
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
        pathJoin = (...paths: string[]) => {
          // Убираем завершающие слэши из всех путей кроме последнего
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
      const books: Book[] = [];

      for (const title of titles) {
        try {
          const titleDir = isElectron ? await pathJoin(nhDir, title) : pathJoin(nhDir, title);
          const idMatch = title.match(/^(\d+)_/);
          const titleId = idMatch ? Number(idMatch[1]) : null;
          
          const titleInfo = await fs.getInfoAsync(titleDir);
          if (!titleInfo.exists || !titleInfo.isDirectory) continue;
          
          const langs = await fs.readDirectoryAsync(titleDir);

          for (const lang of langs) {
            try {
              const langDir = isElectron ? await pathJoin(titleDir, lang) : pathJoin(titleDir, lang);
              
              const langInfo = await fs.getInfoAsync(langDir);
              if (!langInfo.exists || !langInfo.isDirectory) continue;
              
              const metaUri = isElectron ? await pathJoin(langDir, "metadata.json") : pathJoin(langDir, "metadata.json");
              
              const metaInfo = await fs.getInfoAsync(metaUri);
              if (!metaInfo.exists) continue;
              
              const raw = await fs.readAsStringAsync(metaUri);
              const book: Book = JSON.parse(raw);
              if (titleId && book.id !== titleId) continue;

              const files = await fs.readDirectoryAsync(langDir);
              const imageFiles = files
                .filter((f) => f.startsWith("Image"))
                .sort(); // Сортируем для правильного порядка
              
              if (imageFiles.length === 0) continue;
              
              const pages = await Promise.all(
                imageFiles.map(
                  async (img, i): Promise<BookPage> => {
                    const imgPath = isElectron ? await pathJoin(langDir, img) : pathJoin(langDir, img);
                    // Для Android используем путь напрямую (expo-file-system работает с путями)
                    // Для Electron используем local:// протокол (обходит webSecurity)
                    // Для Windows путей используем формат local:///C:/... (три слэша для абсолютного пути)
                    // Нормализуем путь: заменяем обратные слэши на прямые
                    const url = isElectron 
                      ? `local:///${imgPath.replace(/\\/g, '/')}`
                      : imgPath;
                    return {
                      url,
                      urlThumb: url,
                      width: book.pages[i]?.width || 100,
                      height: book.pages[i]?.height || 100,
                      page: i + 1,
                    };
                  }
                )
              );
              
              books.push({
                ...book,
                cover: pages[0]?.url || book.cover,
                thumbnail: pages[0]?.urlThumb || book.thumbnail,
                pages,
              });
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

      books.sort((a, b) => b.id - a.id);
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

  useFocusEffect(
    useCallback(() => {
      fetchDownloadedBooks();
    }, [fetchDownloadedBooks])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDownloadedBooks();
    setRefreshing(false);
  }, [fetchDownloadedBooks]);

  return (
    <BookList
      data={downloadedBooks}
      loading={pending}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onPress={(id) =>
        router.push({
          pathname: "/book/[id]",
          params: {
            id: String(id),
            title: downloadedBooks.find((b) => b.id === id)?.title.pretty,
          },
        })
      }
      ListEmptyComponent={
        !pending && downloadedBooks.length === 0 ? (
          <Text style={{ textAlign: "center", marginTop: 40, color: "#888" }}>
            {t("downloaded.noHaveADownloadBook")}
          </Text>
        ) : null
      }
      gridConfig={{ default: gridConfig }}
    />
  );
}
