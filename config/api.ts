/** Значение из .env (как задано) */
export const API_BASE_URL_RAW =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

const RAW_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
/** URL для запросов — всегда как в .env (localhost, без подмены на 10.0.2.2). Для эмулятора: adb reverse tcp:3002 tcp:3002 */
export const API_BASE_URL: string = RAW_BASE
  ? RAW_BASE
  : __DEV__
  ? "http://localhost:3000"
  : "";
export const API_TIMEOUT_MS = 10000;
