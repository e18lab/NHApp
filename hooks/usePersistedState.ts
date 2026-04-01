import { requestStoragePush, subscribeToStorageApplied } from "@/api/nhappApi/cloudStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type UsePersistedStateOptions = { syncToCloud?: boolean };

export function usePersistedState<T>(
  key: string,
  initial: T,
  options?: UsePersistedStateOptions
) {
  const [value, setValue] = useState<T>(initial);
  const syncToCloud = options?.syncToCloud ?? false;

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {}
  }, [key]);

  useEffect(() => {
    load();
    const unsub = subscribeToStorageApplied(load);
    return unsub;
  }, [load]);

  const update = useCallback(
    async (next: T) => {
      setValue(next);
      try {
        await AsyncStorage.setItem(key, JSON.stringify(next));
        if (syncToCloud) requestStoragePush();
      } catch {}
    },
    [key, syncToCloud]
  );

  return [value, update] as const;
}
