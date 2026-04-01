/**
 * Точка входа до expo-router: гарантируем runtime kind для react-native-worklets /
 * reanimated в WebView (Electron и обычный web). Иначе SHOULD_BE_USE_WEB остаётся false
 * и makeShareable ломается → ReadScreen падает с «makeShareable is not a function».
 */
if (typeof globalThis !== "undefined" && globalThis.__RUNTIME_KIND === undefined) {
  globalThis.__RUNTIME_KIND = 1; // RuntimeKind.ReactNative (react-native-worklets)
}

require("expo-router/entry");
