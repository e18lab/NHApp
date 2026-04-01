/**
 * Синхронизация через лобби: источник правды — лобби на беке. Данные приходят при подключении и по WebSocket.
 * Клиент только шлёт изменения в лобби; лобби рассылает остальным и раз в 10 с пишет в БД.
 */
import {
  touchOnline,
  collectLocalStorageForSync,
  setStoragePushCallback,
} from "@/api/nhappApi/cloudStorage";
import {
  connectLobby,
  disconnectLobby,
  sendStorageToLobby,
  setLobbyOnOpen,
  getLastReceivedFromLobbyAt,
} from "@/api/nhappApi/lobbyStorage";
import { getDeviceId } from "@/utils/deviceId";
import { useOnlineMe } from "@/hooks/useOnlineMe";
import { useCallback, useEffect, useRef } from "react";

const PUSH_DEBOUNCE_MS = 1_500;
/** Не пушить, если только что получили storage из лобби (избегаем цикла). */
const SKIP_PUSH_AFTER_RECEIVE_MS = 4_000;

/** Запускает синхронизацию через лобби при авторизованном пользователе. */
export function useCloudStorageSync(): void {
  const me = useOnlineMe();

  const push = useCallback(async () => {
    if (!me?.id) return;
    if (Date.now() - getLastReceivedFromLobbyAt() < SKIP_PUSH_AFTER_RECEIVE_MS) return;
    try {
      const storage = await collectLocalStorageForSync();
      sendStorageToLobby(storage);
    } catch (e) {
      console.warn("[cloudStorage] push to lobby failed:", e);
    }
  }, [me?.id]);

  const pushRef = useRef(push);
  pushRef.current = push;

  useEffect(() => {
    if (!me?.id) {
      setLobbyOnOpen(null);
      disconnectLobby();
      setStoragePushCallback(null);
      return;
    }

    setLobbyOnOpen(async () => {
      try {
        const deviceId = await getDeviceId();
        await touchOnline(me.id!, deviceId);
      } catch (_) {}
    });

    getDeviceId()
      .then(async (deviceId) => {
        try {
          await touchOnline(me.id!, deviceId);
        } catch (_) {}
        connectLobby(me.id!, deviceId);
      })
      .catch(() => {});

    let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    setStoragePushCallback(() => {
      if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
      pushDebounceTimer = setTimeout(() => {
        pushDebounceTimer = null;
        pushRef.current();
      }, PUSH_DEBOUNCE_MS);
    });

    return () => {
      setLobbyOnOpen(null);
      disconnectLobby();
      setStoragePushCallback(null);
      if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
    };
  }, [me?.id, me?.username, push]);
}
