/**
 * Load a book that was previously downloaded and saved locally.
 *
 * Works on both Expo (mobile) and Electron (desktop) by abstracting
 * over the different file-system APIs.
 */

import { electronFileSystem } from "@/utils/electronFileSystem";
import * as FileSystem from "expo-file-system/legacy";
import { Image, Platform } from "react-native";
import type { Book, BookPage } from "./types";

export const loadBookFromLocal = async (id: number): Promise<Book | null> => {
  const isElectron =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    !!(window as any).electron?.isElectron;

  let nhDir: string;
  let fs: any;
  let pathJoinSync: (...paths: string[]) => string;
  let pathJoinAsync: ((...paths: string[]) => Promise<string>) | null = null;

  if (isElectron) {
    try {
      const baseDir = await electronFileSystem.getDocumentDirectory();
      const electron = (window as any).electron;
      const baseDirTrimmed = baseDir.endsWith(await electron.pathSep())
        ? baseDir.slice(0, -1)
        : baseDir;
      nhDir =
        (await electron.pathJoin(baseDirTrimmed, "NHAppAndroid")) +
        (await electron.pathSep());
      fs = electronFileSystem;
      pathJoinAsync = async (...paths: string[]) => {
        const sep = await electron.pathSep();
        const cleanedPaths: string[] = [];
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i];
          cleanedPaths.push(
            i === paths.length - 1 ? p : p.endsWith(sep) ? p.slice(0, -1) : p
          );
        }
        return await electron.pathJoin(...cleanedPaths);
      };
      pathJoinSync = () => {
        throw new Error("pathJoinSync not available in Electron");
      };
    } catch (err) {
      console.error("[loadBookFromLocal] Failed to get Electron document directory:", err);
      return null;
    }
  } else {
    nhDir = `${FileSystem.documentDirectory}NHAppAndroid/`;
    fs = FileSystem;
    pathJoinSync = (...paths: string[]) => {
      const cleaned = paths.map((p, i) =>
        i === paths.length - 1 ? p : p.endsWith("/") ? p.slice(0, -1) : p
      );
      return cleaned.join("/");
    };
  }

  const pathJoin = async (...paths: string[]): Promise<string> =>
    pathJoinAsync ? pathJoinAsync(...paths) : Promise.resolve(pathJoinSync(...paths));

  try {
    const info = await fs.getInfoAsync(nhDir);
    if (!info.exists) return null;
  } catch {
    return null;
  }

  let titles: string[];
  try {
    titles = await fs.readDirectoryAsync(nhDir);
  } catch {
    return null;
  }

  for (const title of titles) {
    const titleDir = await pathJoin(nhDir, title);
    const idMatch = title.match(/^(\d+)_/);
    const titleId = idMatch ? Number(idMatch[1]) : null;

    let langs: string[];
    try {
      langs = await fs.readDirectoryAsync(titleDir);
    } catch {
      continue;
    }

    for (const lang of langs) {
      const langDir = await pathJoin(titleDir, lang);
      const metaUri = await pathJoin(langDir, "metadata.json");

      try {
        const metaInfo = await fs.getInfoAsync(metaUri);
        if (!metaInfo.exists) continue;
      } catch {
        continue;
      }

      try {
        const raw = await fs.readAsStringAsync(metaUri);
        const book: Book = JSON.parse(raw);

        if (book.id !== id) continue;
        if (titleId && titleId !== book.id) continue;

        let images: string[];
        try {
          images = (await fs.readDirectoryAsync(langDir))
            .filter((f: string) => f.startsWith("Image"))
            .sort((a: string, b: string) => {
              const numA = parseInt(a.match(/\d+/)?.[0] || "0");
              const numB = parseInt(b.match(/\d+/)?.[0] || "0");
              return numA - numB;
            });
        } catch {
          continue;
        }

        const pages: BookPage[] = await Promise.all(
          images.map(async (img, idx): Promise<BookPage> => {
            const imgPath = await pathJoin(langDir, img);
            const uri = isElectron
              ? `local:///${imgPath.replace(/\\/g, "/")}`
              : imgPath;
            return new Promise<BookPage>((res) => {
              Image.getSize(
                uri,
                (w, h) => res({ url: uri, urlThumb: uri, width: w, height: h, page: idx + 1 }),
                () => res({ url: uri, urlThumb: uri, width: 800, height: 1200, page: idx + 1 })
              );
            });
          })
        );

        book.pages = pages;
        book.cover = pages[0].url;
        return book;
      } catch (e) {
        console.warn("[loadBookFromLocal] Failed to load metadata:", e);
        continue;
      }
    }
  }

  return null;
};
