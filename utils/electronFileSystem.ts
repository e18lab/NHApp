// Утилита для работы с файловой системой в Electron
// Замена expo-file-system для web платформы

import { Platform } from "react-native";

const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;

export interface FileInfo {
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  modificationTime?: number;
}

export const electronFileSystem = {
  // Получить базовую директорию для сохранения (из настроек или дефолт)
  async getDocumentDirectory(): Promise<string> {
    if (!isElectron) {
      throw new Error("electronFileSystem only works in Electron");
    }

    const electron = (window as any).electron;
    
    // Получаем путь из настроек
    try {
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      const savedPath = await AsyncStorage.getItem("electron:savePath");
      if (savedPath) {
        // Нормализуем путь и добавляем разделитель если нужно
        const normalized = await electron.pathNormalize(savedPath);
        const sep = await electron.pathSep();
        return normalized.endsWith(sep) ? normalized : normalized + sep;
      }
    } catch (e) {
      console.warn("[electronFileSystem] Failed to get saved path:", e);
    }

    // Дефолтный путь: Pictures/NHAppSaves
    const result = await electron.getPicturesPath();
    if (result.success) {
      const defaultPath = await electron.pathJoin(result.path, "NHAppSaves");
      const sep = await electron.pathSep();
      return defaultPath + sep;
    }

    throw new Error("Failed to get pictures path");
  },

  async getInfoAsync(uri: string): Promise<FileInfo> {
    if (!isElectron) {
      throw new Error("electronFileSystem only works in Electron");
    }

    const electron = (window as any).electron;
    const result = await electron.getInfo(uri);
    
    if (!result.success) {
      return { exists: false };
    }

    return {
      exists: result.exists,
      isDirectory: result.isDirectory,
      size: result.size,
      modificationTime: result.modificationTime,
    };
  },

  async readDirectoryAsync(dirPath: string): Promise<string[]> {
    if (!isElectron) {
      throw new Error("electronFileSystem only works in Electron");
    }

    const electron = (window as any).electron;
    const result = await electron.readDirectory(dirPath);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to read directory");
    }

    return result.entries || [];
  },

  async readAsStringAsync(uri: string, options?: { encoding?: string }): Promise<string> {
    if (!isElectron) {
      throw new Error("electronFileSystem only works in Electron");
    }

    const electron = (window as any).electron;
    const result = await electron.readFile(uri);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to read file");
    }

    return result.content || "";
  },

  async writeAsStringAsync(
    uri: string,
    contents: string,
    options?: { encoding?: string }
  ): Promise<void> {
    if (!isElectron) {
      throw new Error("electronFileSystem only works in Electron");
    }

    const electron = (window as any).electron;
    const result = await electron.writeFile(uri, contents);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to write file");
    }
  },

  async makeDirectoryAsync(dirPath: string, options?: { intermediates?: boolean }): Promise<void> {
    if (!isElectron) {
      throw new Error("electronFileSystem only works in Electron");
    }

    const electron = (window as any).electron;
    const result = await electron.makeDirectory(dirPath, options);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to create directory");
    }
  },

  async deleteAsync(filePath: string, options?: { idempotent?: boolean }): Promise<void> {
    if (!isElectron) {
      throw new Error("electronFileSystem only works in Electron");
    }

    const electron = (window as any).electron;
    const result = await electron.deleteAsync(filePath, options);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to delete");
    }
  },
};
