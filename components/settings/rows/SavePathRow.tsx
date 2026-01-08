import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";

const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;

export function SavePathRow() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [savePath, setSavePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isElectron) return;

    const loadPath = async () => {
      try {
        const saved = await AsyncStorage.getItem("electron:savePath");
        if (saved) {
          setSavePath(saved);
        } else {
          // Получаем дефолтный путь
          const electron = (window as any).electron;
          const result = await electron.getPicturesPath();
          if (result.success) {
            const defaultPath = await electron.pathJoin(result.path, "NHAppSaves");
            setSavePath(defaultPath);
          }
        }
      } catch (err) {
        console.error("[SavePathRow] Failed to load path:", err);
      }
    };

    loadPath();
  }, []);

  const handleSelectPath = async () => {
    if (!isElectron || loading) return;

    setLoading(true);
    try {
      const electron = (window as any).electron;
      
      // Показываем диалог выбора папки
      const result = await electron.showOpenDialog({
        title: "Выберите папку для сохранения",
        defaultPath: savePath || undefined,
      });

      if (result.success && !result.canceled && result.filePaths && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        
        // Сохраняем путь
        await AsyncStorage.setItem("electron:savePath", selectedPath);
        setSavePath(selectedPath);
      }
    } catch (err) {
      console.error("[SavePathRow] Failed to select path:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isElectron) {
    return null;
  }

  return (
    <View>
      <Text
        style={{
          fontSize: 17,
          fontWeight: "800",
          color: colors.txt,
          marginBottom: 8,
          lineHeight: 24,
          letterSpacing: 0.3,
        }}
      >
        {t("settings.storage.savePath") || "Путь сохранения"}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: colors.sub,
          marginBottom: 14,
          lineHeight: 18,
          opacity: 0.75,
        }}
      >
        {t("settings.storage.savePathDesc") || "Папка для сохранения скачанных книг (только для Electron)"}
      </Text>
      
      <Pressable
        onPress={handleSelectPath}
        disabled={loading}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.page + "30" : colors.tagBg,
          borderRadius: 14,
          padding: 16,
          borderWidth: 1.5,
          borderColor: colors.page + "60",
          borderStyle: "dashed",
        })}
        android_ripple={{ color: colors.accent + "25", borderless: false }}
      >
        <Text
          style={{
            fontSize: 13,
            color: colors.txt,
            marginBottom: 8,
            fontWeight: "600",
            letterSpacing: 0.2,
          }}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {savePath || "Загрузка..."}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.accent,
            fontWeight: "600",
          }}
        >
          {loading ? "Загрузка..." : "Нажмите для изменения"}
        </Text>
      </Pressable>
    </View>
  );
}
