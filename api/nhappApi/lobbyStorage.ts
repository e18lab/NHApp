/**
 * Лобби устройств: WebSocket-подключение к комнате пользователя на API.
 * Мгновенная синхронизация: при push шлём storage в лобби, другие устройства получают и применяют без опроса.
 */
import { API_BASE_URL } from "@/config/api";
import { applyStorageToLocal, notifyStorageApplied } from "./cloudStorage";

let ws: WebSocket | null = null;
let currentUserId: number | null = null;
let onOpenCallback: (() => void | Promise<void>) | null = null;

let lobbyPeersCount = 0;
export type LobbyPeerDevice = { device_id: string; device_name: string | null };
let lobbyPeersDevices: LobbyPeerDevice[] = [];
const peersCountListeners = new Set<(n: number) => void>();
const peersDevicesListeners = new Set<(devices: LobbyPeerDevice[]) => void>();

/** Время последнего приёма storage из лобби — чтобы не слать push обратно после apply. */
let lastReceivedFromLobbyAt = 0;
/** Время последней отправки (для UI: стрелка вверх = отправитель). */
let lastSentAt = 0;
/** Время последнего приёма (для UI: стрелка вниз = получатель). */
let lastReceivedAt = 0;
const roleListeners = new Set<() => void>();

function setPeersCount(count: number): void {
  if (lobbyPeersCount === count) return;
  lobbyPeersCount = count;
  peersCountListeners.forEach((cb) => cb(count));
}

function notifyRoleChange(): void {
  roleListeners.forEach((cb) => cb());
}

function getLobbyWsUrl(userId: number, deviceId: string): string {
  const base = API_BASE_URL || "";
  const wsScheme = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const params = new URLSearchParams({ userId: String(userId), deviceId });
  return `${wsScheme}://${host}/lobby?${params.toString()}`;
}

function onMessage(event: { data?: string | Blob }) {
  try {
    const raw = typeof event.data === "string" ? event.data : null;
    if (!raw) return;
    const msg = JSON.parse(raw) as {
      type?: string;
      storage?: Record<string, unknown>;
      count?: number;
      devices?: LobbyPeerDevice[];
    };
    if (msg.type === "storage" && msg.storage && typeof msg.storage === "object") {
      lastReceivedFromLobbyAt = Date.now();
      lastReceivedAt = Date.now();
      notifyRoleChange();
      applyStorageToLocal(msg.storage);
      notifyStorageApplied();
    }
    if (msg.type === "peers") {
      if (typeof msg.count === "number") setPeersCount(msg.count);
      if (Array.isArray(msg.devices)) {
        lobbyPeersDevices = msg.devices;
        peersDevicesListeners.forEach((cb) => cb(lobbyPeersDevices));
      }
    }
  } catch (e) {
    console.warn("[lobby] message parse error:", e);
  }
}

/** Подключиться к лобби пользователя (комната user:userId). deviceId обязателен для входа. */
export function connectLobby(userId: number, deviceId: string): void {
  if (currentUserId === userId && ws?.readyState === WebSocket.OPEN) return;
  disconnectLobby();
  currentUserId = userId;
  if (!deviceId) {
    console.warn("[lobby] connectLobby called without deviceId");
    return;
  }
  try {
    const url = getLobbyWsUrl(userId, deviceId);
    ws = new WebSocket(url);
    ws.onmessage = onMessage;
    ws.onopen = () => {
      onOpenCallback?.();
    };
    ws.onclose = () => {
      ws = null;
    };
    ws.onerror = () => {};
  } catch (e) {
    console.warn("[lobby] connect error:", e);
    ws = null;
  }
}

/** Вызвать callback при открытии соединения с лобби (для touchOnline и т.д.). */
export function setLobbyOnOpen(cb: (() => void | Promise<void>) | null): void {
  onOpenCallback = cb;
}

/** Отключиться от лобби. */
export function disconnectLobby(): void {
  if (ws) {
    try {
      ws.close();
    } catch {}
    ws = null;
  }
  currentUserId = null;
  setPeersCount(0);
  lobbyPeersDevices = [];
  peersDevicesListeners.forEach((cb) => cb([]));
}

/** Список подключённых устройств в лобби (device_id, device_name). */
export function getLobbyPeersDevices(): LobbyPeerDevice[] {
  return lobbyPeersDevices;
}

/** Подписаться на изменение списка устройств в лобби. */
export function subscribeToLobbyPeersDevices(
  cb: (devices: LobbyPeerDevice[]) => void
): () => void {
  peersDevicesListeners.add(cb);
  cb(lobbyPeersDevices);
  return () => peersDevicesListeners.delete(cb);
}

/** Текущее число устройств в лобби (подключено к комнате). */
export function getLobbyPeersCount(): number {
  return lobbyPeersCount;
}

/** Подписаться на изменение числа устройств в лобби. */
export function subscribeToLobbyPeersCount(cb: (count: number) => void): () => void {
  peersCountListeners.add(cb);
  cb(lobbyPeersCount);
  return () => {
    peersCountListeners.delete(cb);
  };
}

/** Отправить storage в лобби (только когда пользователь что-то изменил — инициатор push). */
export function sendStorageToLobby(storage: Record<string, string>): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify({ type: "storage", storage }));
    lastSentAt = Date.now();
    notifyRoleChange();
  } catch (e) {
    console.warn("[lobby] send error:", e);
  }
}

/** Не пушить в лобби, если только что получили данные (избегаем цикла получатель → apply → push обратно). */
export function getLastReceivedFromLobbyAt(): number {
  return lastReceivedFromLobbyAt;
}

/** Для UI: стрелка вверх = отправитель, стрелка вниз = получатель (показывать 5 сек). */
export function getLobbyRole(): "sender" | "receiver" | null {
  const now = Date.now();
  const windowMs = 5_000;
  if (now - lastSentAt <= windowMs && lastSentAt >= lastReceivedAt) return "sender";
  if (now - lastReceivedAt <= windowMs && lastReceivedAt >= lastSentAt) return "receiver";
  return null;
}

export function subscribeToLobbyRole(cb: () => void): () => void {
  roleListeners.add(cb);
  return () => roleListeners.delete(cb);
}

export function isLobbyConnected(): boolean {
  return ws != null && ws.readyState === WebSocket.OPEN;
}
