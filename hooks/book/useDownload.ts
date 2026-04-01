import type { Book } from "@/api/nhappApi/types";
import { getGallery, initCdn } from "@/api/v2";
import { galleryToBook } from "@/api/v2/compat";
import { sanitize } from "@/utils/book/sanitize";
import { useThrottle } from "@/utils/book/useThrottle";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, ToastAndroid } from "react-native";
import { electronFileSystem } from "@/utils/electronFileSystem";
import {
  clearDownloadProgress,
  markDownloadFinished,
  setDownloadProgress,
} from "@/lib/downloadProgressStore";

export const useDownload = (
  book: Book | null,
  local: boolean,
  setLocal: (v: boolean) => void,
  setBook: (updater: any) => void
) => {
  const router = useRouter();
  const [dl, setDL] = useState(false);
  const [pr, setPr] = useState(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const setPrThrottled = useThrottle((v: number) => {
    if (aliveRef.current) setPr(v);
    setDownloadProgress({
      active: true,
      bookId: book?.id ?? null,
      title: book?.title?.pretty ?? null,
      cover: book?.cover ?? null,
      progress: v,
    });
  }, 120);

  const currentDL = useRef<FileSystem.DownloadResumable | null>(null);
  const cancelReq = useRef(false);

  const cancel = useCallback(async () => {
    if (!dl) return;
    cancelReq.current = true;
    try {
      await currentDL.current?.pauseAsync().catch(() => {});
    } finally {
    }
  }, [dl]);

  const handleDownloadOrDelete = useCallback(async () => {
    if (!book || dl) return;

    const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;
    let fs: any;
    let getDocumentDir: () => Promise<string>;
    let pathJoin: (...paths: string[]) => Promise<string> | string;
    if (isElectron) {
      fs = electronFileSystem;
      getDocumentDir = async () => {
        const baseDir = await electronFileSystem.getDocumentDirectory();
        const electron = (window as any).electron;
        const sep = await electron.pathSep();
        const baseDirTrimmed = baseDir.endsWith(sep) ? baseDir.slice(0, -1) : baseDir;
        return await electron.pathJoin(baseDirTrimmed, "NHAppAndroid") + sep;
      };
      pathJoin = async (...paths: string[]) => {
        const electron = (window as any).electron;
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
    } else {
      fs = FileSystem;
      getDocumentDir = async () => `${FileSystem.documentDirectory}NHAppAndroid/`;
      pathJoin = (...paths: string[]) => {
        const cleanedPaths = paths.map((p, i) => {
          if (i === paths.length - 1) return p;
          return p.endsWith("/") ? p.slice(0, -1) : p;
        });
        return cleanedPaths.join("/");
      };
    }

    const lang = book.languages?.[0]?.name ?? "Unknown";
    const title = sanitize(book.title.pretty);
    const nhDir = await getDocumentDir();
    const nhDirTrimmed = isElectron
      ? (nhDir.endsWith(await (window as any).electron.pathSep()) ? nhDir.slice(0, -1) : nhDir)
      : (nhDir.endsWith("/") ? nhDir.slice(0, -1) : nhDir);
    const dir = isElectron 
      ? await pathJoin(nhDirTrimmed, `${book.id}_${title}`, sanitize(lang)) + await (window as any).electron.pathSep()
      : `${nhDirTrimmed}/${book.id}_${title}/${sanitize(lang)}/`;

    if (aliveRef.current) {
      setDL(true);
      setPr(0);
    }
    setDownloadProgress({
      active: true,
      bookId: book.id,
      title: book.title.pretty,
      cover: book.cover ?? null,
      progress: 0,
    });
    cancelReq.current = false;

    try {
      if (local) {
        const titles = await fs.readDirectoryAsync(nhDir);

        for (const t of titles) {
          const titleDir = isElectron ? await pathJoin(nhDir, t) : pathJoin(nhDir, t);
          const langs = await fs.readDirectoryAsync(titleDir);
          for (const l of langs) {
            const langDir = isElectron ? await pathJoin(titleDir, l) : pathJoin(titleDir, l);
            const metaUri = isElectron ? await pathJoin(langDir, "metadata.json") : pathJoin(langDir, "metadata.json");
            const info = await fs.getInfoAsync(metaUri);
            if (!info.exists) continue;
            try {
              const raw = await fs.readAsStringAsync(metaUri);
              const meta = JSON.parse(raw);
              if (meta.id !== book.id) continue;
              await fs.deleteAsync(titleDir, { idempotent: true });
              if (Platform.OS === "android")
                ToastAndroid.show("Deleted", ToastAndroid.SHORT);
              if (aliveRef.current) setLocal(false);
              // After deleting local copy, stay on the screen and switch to online version.
              try {
                await initCdn();
                const gallery = await getGallery(book.id, { include: ["comments", "related", "favorite"] });
                if (aliveRef.current) setBook(galleryToBook(gallery));
              } catch {
                // If online fetch fails, keep current UI (user may be offline).
              }
              return;
            } catch {}
          }
        }
        if (Platform.OS === "android")
          ToastAndroid.show("Book not found locally", ToastAndroid.SHORT);
        return;
      }

      await fs.makeDirectoryAsync(dir, { intermediates: true });
      const total = book.pages.length;
      const pagesCopy = [...book.pages];

      for (let i = 0; i < total; i++) {
        if (cancelReq.current) throw new Error("__CANCELLED__");

        const p = pagesCopy[i];
        const num = (i + 1).toString().padStart(3, "0");
        const ext = p.url.split(".").pop()!.split("?")[0];
        const uri = isElectron 
          ? await pathJoin(dir, `Image${num}.${ext}`)
          : `${dir}Image${num}.${ext}`;

        const exists = (await fs.getInfoAsync(uri)).exists;
        if (!exists) {
          if (isElectron) {
            const electron = (window as any).electron;
            const result = await electron.downloadFile(p.url, uri);
            if (!result.success) {
              throw new Error(result.error || "Failed to download file");
            }
          } else {
            const dlObj = FileSystem.createDownloadResumable(
              p.url,
              uri,
              {},
              ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
                if (totalBytesExpectedToWrite > 0) {
                }
              }
            );
            currentDL.current = dlObj;
            try {
              await dlObj.downloadAsync();
            } catch (e: any) {
              const info = await fs.getInfoAsync(uri);
              if (info.exists) {
                try {
                  await fs.deleteAsync(uri, { idempotent: true });
                } catch {}
              }
              if (cancelReq.current) throw new Error("__CANCELLED__");
              throw e;
            } finally {
              currentDL.current = null;
            }
          }
        }

        const fileUri = isElectron ? `file://${uri}` : uri;
        pagesCopy[i] = { ...p, url: fileUri, urlThumb: fileUri };
        if ((i & 3) === 3) setPrThrottled((i + 1) / total);
        if (cancelReq.current) throw new Error("__CANCELLED__");
      }

      const metaUri = isElectron 
        ? await pathJoin(dir, "metadata.json")
        : `${dir}metadata.json`;
      await fs.writeAsStringAsync(
        metaUri,
        JSON.stringify({ ...book, pages: pagesCopy }),
        { encoding: "utf8" }
      );

      if (aliveRef.current) {
        setBook((prev: any) => (prev ? { ...prev, pages: pagesCopy } : prev));
        setPr(1);
      }
      setDownloadProgress({
        active: true,
        bookId: book.id,
        title: book.title.pretty,
        cover: book.cover ?? null,
        progress: 1,
      });
      if (Platform.OS === "android")
        ToastAndroid.show("Saved", ToastAndroid.SHORT);
      if (aliveRef.current) setLocal(true);
      markDownloadFinished(book.id);
    } catch (e: any) {
      if (e?.message === "__CANCELLED__") {
        if (Platform.OS === "android")
          ToastAndroid.show("Canceled", ToastAndroid.SHORT);
      } else {
        console.error(e);
        if (Platform.OS === "android")
          ToastAndroid.show("Error", ToastAndroid.LONG);
      }
    } finally {
      if (aliveRef.current) setDL(false);
      cancelReq.current = false;
      currentDL.current = null;
      clearDownloadProgress();
      if (aliveRef.current) setTimeout(() => setPr(0), 150);
    }
  }, [book, dl, local, router, setLocal, setBook, setPrThrottled]);

  return { dl, pr, handleDownloadOrDelete, cancel };
};
