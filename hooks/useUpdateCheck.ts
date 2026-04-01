import { getElectronVersion, isElectron } from "@/electron/bridge";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, ToastAndroid } from "react-native";

const GITHUB_REPO = "e18lab/NHAppAndroid";

function normalizeVersion(v: string): string {
  return (v || "").replace(/^v/i, "").trim();
}

/** true if a is strictly greater than b (e.g. 1.2.2 > 1.2.1) */
function isVersionNewer(a: string, b: string): boolean {
  const parts = (s: string) => (s || "").split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return true;
    if (va < vb) return false;
  }
  return false;
}

type UpdateInfo = {
  versionName: string;
  notes: string;
  apkUrl: string;
};

export function useUpdateCheck() {
  const [update,   setUpdate]   = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const checkUpdate = useCallback(async () => {
    try {
      let current: string;
      if (Platform.OS === "web" && isElectron()) {
        const electronVer = await getElectronVersion();
        current = electronVer ?? Constants.expoConfig?.version ?? "";
      } else {
        current = Constants.expoConfig?.version ?? Application.nativeBuildVersion ?? "";
      }
      current = normalizeVersion(current);

      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
      );
      if (!res.ok) {
        console.warn("[update-check] GitHub API:", res.status);
        setUpdate(null);
        return;
      }
      const j   = await res.json();
      const tag = (j.tag_name as string) || "";
      const tagNorm = normalizeVersion(tag);

      if (tag && isVersionNewer(tagNorm, current) && j.assets?.length) {
        setUpdate({
          versionName: tag.startsWith("v") ? tag : `v${tag}`,
          notes: j.body ?? "",
          apkUrl: j.assets[0].browser_download_url,
        });
      } else {
        setUpdate(null);
      }
    } catch (e) {
      console.warn("[update-check]", e);
    }
  }, []);
  useEffect(() => { checkUpdate(); }, [checkUpdate]);
  const launchInstaller = async (file: string) => {
    const uri = await FileSystem.getContentUriAsync(file);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data : uri,
      type : "application/vnd.android.package-archive",
      flags: 1 | 0x10000000,
    });
  };
  const downloadAndInstall = useCallback(async () => {
    if (!update || progress !== null) return;
    if (Platform.OS === "android" && (Platform.Version as number) >= 26) {
      ToastAndroid.show("Скачивание через браузер…", ToastAndroid.SHORT);
      Linking.openURL(update.apkUrl);
      return;
    }
    try {
      const dest = `${FileSystem.documentDirectory}NHApp_update.apk`;
      setProgress(0);
      await FileSystem.createDownloadResumable(
        update.apkUrl,
        dest,
        { headers: { Accept: "application/octet-stream" } },
        ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
          setProgress(totalBytesWritten / totalBytesExpectedToWrite)
      ).downloadAsync();
      setProgress(null);
      ToastAndroid.show("APK загружен, открываю установщик…", ToastAndroid.SHORT);
      await launchInstaller(dest);
    } catch (e) {
      console.error("[update-dl]", e);
      ToastAndroid.show("Ошибка загрузки", ToastAndroid.LONG);
      setProgress(null);
    }
  }, [update, progress]);
  return { update, progress, downloadAndInstall, checkUpdate };
}
