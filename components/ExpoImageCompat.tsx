import { Image as ExpoImage, ImageProps } from "expo-image";
import { Platform } from "react-native";
import React from "react";

// Проверка, что это Electron
const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;

/**
 * Обертка над ExpoImage для совместимости с Electron.
 * Автоматически устанавливает responsivePolicy="initial" для Electron,
 * чтобы избежать ошибок о missing width properties при использовании "static".
 */
export default function ExpoImageCompat(props: ImageProps) {
  // Для Electron: если responsivePolicy не указан или равен "static", используем "initial"
  // Это избегает ошибки "Missing width properties" для static responsivePolicy
  let finalResponsivePolicy = props.responsivePolicy;
  
  if (isElectron) {
    // Если responsivePolicy не задан или "static", заменяем на "initial"
    if (!finalResponsivePolicy || finalResponsivePolicy === "static") {
      finalResponsivePolicy = "initial";
    }
  }
  
  return <ExpoImage {...props} responsivePolicy={finalResponsivePolicy} />;
}