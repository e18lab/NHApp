/**
 * Хук для данных графика хранилища: скачанные, хранилище приложения, свободно, другие приложения.
 * На Android/iOS — реальные данные (expo-file-system). На ПК/веб — заглушка или переданные segments.
 */
import type { GraphSegment } from "@/components/uikit/Graph";
import { Platform } from "react-native";
import { useCallback, useEffect, useState } from "react";

const DOWNLOADS_DIR_NAME = "NHAppAndroid";

/** Рекурсивный размер директории (expo-file-system). */
async function getDirectorySizeAsync(
  dirUri: string,
  FileSystem: typeof import("expo-file-system/legacy")
): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(dirUri, { size: true });
    if (!info.exists) return 0;
    if (!info.isDirectory) return info.size ?? 0;
    const names = await FileSystem.readDirectoryAsync(dirUri);
    const sep = dirUri.endsWith("/") ? "" : "/";
    let total = 0;
    for (const name of names) {
      const childUri = dirUri + sep + name;
      const childInfo = await FileSystem.getInfoAsync(childUri, { size: true });
      if (!childInfo.exists) continue;
      if (childInfo.isDirectory) {
        total += await getDirectorySizeAsync(childUri, FileSystem);
      } else {
        total += childInfo.size ?? 0;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export type GraphStorageData = {
  segments: GraphSegment[];
  loading: boolean;
  error: string | null;
  /** Путь к папке сохранений (ПК/Electron), где лежат скачанные */
  documentPath: string | null;
};

const DEFAULT_COLORS = {
  downloaded: "#3b82f6",
  appStorage: "#a855f7",
  free: "#6b7280",
  other: "#eab308",
};

/**
 * Возвращает сегменты для Graph: скачанные, хранилище приложения, свободно, другое.
 * На нативных платформах запрашивает реальные данные; на веб возвращает loading и пустые segments
 * (данные можно передать снаружи или добавить bridge для Electron).
 */
export function useGraphStorageData(options?: {
  /** Подписи (i18n). По умолчанию: Скачанные, Хранилище приложения, Свободно, Другие приложения */
  labels?: {
    downloaded?: string;
    appStorage?: string;
    free?: string;
    other?: string;
  };
  /** Цвета сегментов */
  colors?: Partial<typeof DEFAULT_COLORS>;
}): GraphStorageData {
  const [segments, setSegments] = useState<GraphSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentPath, setDocumentPath] = useState<string | null>(null);

  /** На ПК не показывать сегменты с нулевым размером */
  const filterZero = (list: GraphSegment[]) =>
    Platform.OS === "web" ? list.filter((s) => s.size > 0) : list;

  const labels = {
    downloaded: options?.labels?.downloaded ?? "Скачанные",
    appStorage: options?.labels?.appStorage ?? "Хранилище приложения",
    free: options?.labels?.free ?? "Свободно",
    other: options?.labels?.other ?? "Другие приложения",
  };
  const colors = { ...DEFAULT_COLORS, ...options?.colors };

  const load = useCallback(async () => {
    const isElectron = Platform.OS === "web" && typeof globalThis !== "undefined" && !!(globalThis as any).electron?.isElectron;

    if (isElectron) {
      setLoading(true);
      setError(null);
      try {
        const electron = (globalThis as any).electron;
        let basePath: string | undefined;
        try {
          const { electronFileSystem } = await import("@/utils/electronFileSystem");
          basePath = await electronFileSystem.getDocumentDirectory();
        } catch (_) {}
        const disk = await electron.getDiskSpace?.(basePath);
        if (disk?.success && disk.free != null && disk.total != null) {
          const free = Number(disk.free);
          const total = Number(disk.total);
          const downloaded = Number(disk.downloaded ?? 0);
          const documentDirSize = Number(disk.appStorage ?? 0);
          const appStorageOnly = Math.max(0, documentDirSize - downloaded);
          const other = Math.max(0, total - free - documentDirSize);
          setDocumentPath(basePath ?? null);
          setSegments(
            filterZero([
              { key: "downloaded", color: colors.downloaded, label: labels.downloaded, size: downloaded },
              { key: "appStorage", color: colors.appStorage, label: labels.appStorage, size: appStorageOnly },
              { key: "other", color: colors.other, label: labels.other, size: other },
              { key: "free", color: colors.free, label: labels.free, size: free },
            ])
          );
        } else {
          setDocumentPath(null);
          setSegments(
            filterZero([
              { key: "downloaded", color: colors.downloaded, label: labels.downloaded, size: 2.5 * 1e9 },
              { key: "appStorage", color: colors.appStorage, label: labels.appStorage, size: 0.3 * 1e9 },
              { key: "other", color: colors.other, label: labels.other, size: 80 * 1e9 },
              { key: "free", color: colors.free, label: labels.free, size: 120 * 1e9 },
            ])
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setDocumentPath(null);
        setSegments(
          filterZero([
            { key: "downloaded", color: colors.downloaded, label: labels.downloaded, size: 2.5 * 1e9 },
            { key: "appStorage", color: colors.appStorage, label: labels.appStorage, size: 0.3 * 1e9 },
            { key: "other", color: colors.other, label: labels.other, size: 80 * 1e9 },
            { key: "free", color: colors.free, label: labels.free, size: 120 * 1e9 },
          ])
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (Platform.OS !== "android" && Platform.OS !== "ios") {
      setDocumentPath(null);
      setLoading(false);
      setSegments(
        filterZero([
          { key: "downloaded", color: colors.downloaded, label: labels.downloaded, size: 2.5 * 1e9 },
          { key: "appStorage", color: colors.appStorage, label: labels.appStorage, size: 0.3 * 1e9 },
          { key: "other", color: colors.other, label: labels.other, size: 80 * 1e9 },
          { key: "free", color: colors.free, label: labels.free, size: 120 * 1e9 },
        ])
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const FileSystem = await import("expo-file-system/legacy");
      const docDir = FileSystem.documentDirectory;
      const cacheDir = FileSystem.cacheDirectory;
      const downloadsPath = docDir ? docDir + DOWNLOADS_DIR_NAME + "/" : null;

      const [free, total, docSize, cacheSize, downloadedSize] = await Promise.all([
        FileSystem.getFreeDiskStorageAsync?.().catch(() => 0) ?? Promise.resolve(0),
        FileSystem.getTotalDiskCapacityAsync?.().catch(() => 0) ?? Promise.resolve(0),
        docDir ? getDirectorySizeAsync(docDir, FileSystem) : Promise.resolve(0),
        cacheDir ? getDirectorySizeAsync(cacheDir, FileSystem) : Promise.resolve(0),
        downloadsPath
          ? getDirectorySizeAsync(downloadsPath, FileSystem)
          : Promise.resolve(0),
      ]);

      const freeNum = Number(free);
      const totalNum = Number(total);
      const appUsed = docSize + cacheSize;
      const other = Math.max(0, totalNum - freeNum - appUsed);

      setDocumentPath(null);
      // Свободно всегда справа (последний сегмент)
      setSegments([
        { key: "downloaded", color: colors.downloaded, label: labels.downloaded, size: downloadedSize },
        {
          key: "appStorage",
          color: colors.appStorage,
          label: labels.appStorage,
          size: Math.max(0, appUsed - downloadedSize),
        },
        { key: "other", color: colors.other, label: labels.other, size: other },
        { key: "free", color: colors.free, label: labels.free, size: freeNum },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSegments([]);
    } finally {
      setLoading(false);
    }
  }, [labels.downloaded, labels.appStorage, labels.free, labels.other, colors.downloaded, colors.appStorage, colors.free, colors.other]);

  useEffect(() => {
    load();
  }, [load]);

  return { segments, loading, error, documentPath };
}
