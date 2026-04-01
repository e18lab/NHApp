/**
 * Уникальный идентификатор устройства для сессий и облачной синхронизации.
 * Имя устройства: модель телефона (Android/iOS) или ОС ПК (Windows 10, macOS и т.д.).
 */
import * as Application from "expo-application";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getElectronOsName, isElectron } from "@/electron/bridge";

const DEVICE_ID_KEY = "@cloud.deviceId";

function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Возвращает устойчивый device id (и создаёт при первом вызове на веб/iOS). */
export async function getDeviceId(): Promise<string> {
  if (Platform.OS === "android") {
    try {
      const id = await Application.getAndroidId?.();
      if (id && typeof id === "string") return id;
    } catch (_) {}
  }
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    const newId = generateUuid();
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  } catch (_) {
    return generateUuid();
  }
}

/** Человекочитаемое имя: модель телефона (Samsung Galaxy, Pixel) или ОС ПК (Windows 10, macOS). */
export async function getDeviceName(): Promise<string> {
  if (Platform.OS === "android") {
    try {
      const Device = await import("expo-device").then((m) => m.default);
      const model = Device?.modelName;
      const manufacturer = (Device as any)?.manufacturer;
      if (model && typeof model === "string") {
        const part = manufacturer && typeof manufacturer === "string"
          ? `${manufacturer} ${model}`.trim()
          : model;
        if (part) return part;
      }
    } catch (_) {}
    return "Android";
  }
  if (Platform.OS === "ios") {
    try {
      const Device = await import("expo-device").then((m) => m.default);
      const model = Device?.modelName;
      if (model && typeof model === "string") return model;
    } catch (_) {}
    return "iOS";
  }
  if (Platform.OS === "web") {
    if (isElectron()) {
      const osName = await getElectronOsName();
      if (osName) return osName;
      return "ПК";
    }
    return "Веб";
  }
  return "Устройство";
}
