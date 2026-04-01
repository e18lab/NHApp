import {
  registerAutoImportTask,
  unregisterAutoImportTask,
} from "@/background/autoImport.task";
import { autoImportSyncOnce, startForegroundPolling } from "@/lib/autoImport";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { AppState, AppStateStatus } from "react-native";
type Ctx = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  isRunning: boolean;
};
const AutoImportContext = React.createContext<Ctx | undefined>(undefined);
export const useAutoImport = () => {
  const ctx = React.useContext(AutoImportContext);
  if (!ctx) {
    throw new Error("useAutoImport must be used within AutoImportProvider");
  }
  return ctx;
};
const K_AUTO_IMPORT_ENABLED = "@autoImport.enabled";
export default function AutoImportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabled, setEnabledState] = React.useState<boolean>(false);
  const [loaded, setLoaded] = React.useState<boolean>(false);
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const appState = React.useRef<AppStateStatus | null>(
    AppState.currentState as AppStateStatus | null
  );
  const stopPollingRef = React.useRef<null | (() => void)>(null);
  React.useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(K_AUTO_IMPORT_ENABLED);
        setEnabledState(v === "1");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);
  const setEnabled = React.useCallback(async (next: boolean) => {
    setEnabledState(next);
    await AsyncStorage.setItem(K_AUTO_IMPORT_ENABLED, next ? "1" : "0");
      (await import("@/api/nhappApi/cloudStorage")).requestStoragePush();
    if (next) {
      registerAutoImportTask(15).catch(() => {});
      if (appState.current === "active" && !stopPollingRef.current) {
        stopPollingRef.current = startForegroundPolling(1000);
        setIsRunning(true);
      }
      autoImportSyncOnce().catch(() => {});
    } else {
      if (stopPollingRef.current) {
        stopPollingRef.current();
        stopPollingRef.current = null;
      }
      setIsRunning(false);
      unregisterAutoImportTask().catch(() => {});
    }
  }, []);
  React.useEffect(() => {
    if (!loaded) return;
    if (enabled) {
      registerAutoImportTask(15).catch(() => {});
      if (appState.current === "active" && !stopPollingRef.current) {
        stopPollingRef.current = startForegroundPolling(1000);
        setIsRunning(true);
      }
      autoImportSyncOnce().catch(() => {});
    }
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if (!enabled) return;
      if (next === "active" && !stopPollingRef.current) {
        stopPollingRef.current = startForegroundPolling(1000);
        setIsRunning(true);
      } else if (prev === "active" && next !== "active") {
        if (stopPollingRef.current) {
          stopPollingRef.current();
          stopPollingRef.current = null;
        }
        setIsRunning(false);
      }
    });
    return () => {
      sub.remove();
      if (stopPollingRef.current) {
        stopPollingRef.current();
        stopPollingRef.current = null;
      }
      setIsRunning(false);
    };
  }, [enabled, loaded]);
  const ctx = React.useMemo<Ctx>(
    () => ({ enabled, setEnabled, isRunning }),
    [enabled, setEnabled, isRunning]
  );
  return (
    <AutoImportContext.Provider value={ctx}>
      {children}
    </AutoImportContext.Provider>
  );
}
