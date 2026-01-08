import { LOGIN_URL, saveTokens, syncElectronCookies } from "@/api/auth";
import { IconBtn } from "@/components/ui/IconBtn";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from "react-native";

// Динамический импорт WebView только для нативных платформ
let WebView: any = null;
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").WebView;
  } catch (e) {
    console.warn("WebView not available");
  }
}

// Проверка Electron
const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;

const injected = `
(function () {
  function getCookieMap() {
    var out = {};
    try {
      (document.cookie || "").split(";").forEach(function (p) {
        var kv = p.split("=");
        if (!kv[0]) return;
        var k = kv[0].trim();
        var v = (kv[1] || "").trim();
        if (k === "csrftoken" || k === "sessionid") out[k] = v;
      });
    } catch (e) {}
    return out;
  }
  var last = "";
  function tick() {
    try {
      var raw = document.cookie || "";
      if (raw !== last) {
        last = raw;
        var m = getCookieMap();
        if (m.csrftoken || m.sessionid) {
          window.ReactNativeWebView &&
            window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: "cookies", cookies: m, href: location.href })
            );
        }
      }
    } catch (e) {}
    setTimeout(tick, 700);
  }
  tick();
})();
true;
`;

export type LoginModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  colors: any;
  t: (k: string, p?: any) => string;

  canUseNativeJar: boolean;
  isExpoGo: boolean;
  wvBusy: boolean;
  setWvBusy: (b: boolean) => void;

  csrfInput: string;
  setCsrfInput: (s: string) => void;
  sessInput: string;
  setSessInput: (s: string) => void;

  applyManual: (csrf: string, sess: string) => Promise<void>;
  refreshTokensFromJar: (reason: string) => Promise<void>;
  fetchMeAndMaybeClose: (why: string) => Promise<void>;
  handleNavChange: any;
  onWvMessage: any;
};

export function LoginModal(props: LoginModalProps) {
  const {
    visible,
    onRequestClose,
    colors,
    t,
    canUseNativeJar,
    isExpoGo,
    wvBusy,
    setWvBusy,
    csrfInput,
    setCsrfInput,
    sessInput,
    setSessInput,
    applyManual,
    refreshTokensFromJar,
    fetchMeAndMaybeClose,
    handleNavChange,
    onWvMessage,
  } = props;

  const [electronLoading, setElectronLoading] = React.useState(false);
  const [electronError, setElectronError] = React.useState<string | null>(null);

  const showManualInputs = !canUseNativeJar || isExpoGo;

  // Electron login handler
  const handleElectronLogin = React.useCallback(async () => {
    if (electronLoading) return;
    
    setElectronLoading(true);
    setElectronError(null);
    
    try {
      const electron = (window as any).electron;
      console.log("[Electron Login] Starting login...");
      
      const result = await electron.login();
      console.log("[Electron Login] Result:", result);
      
      if (result.success && result.tokens) {
        const { csrftoken, sessionid } = result.tokens;
        console.log("[Electron Login] Tokens received:", { csrf: !!csrftoken, session: !!sessionid });
        
        if (sessionid) {
          // Save tokens to AsyncStorage
          console.log("[Electron Login] Saving tokens...");
          await saveTokens({ csrftoken, sessionid });
          
          // ВАЖНО: Синхронизируем cookies из Electron session в AsyncStorage
          // Это нужно потому что nhFetch использует cookies из AsyncStorage
          console.log("[Electron Login] Syncing cookies from Electron session...");
          const syncedTokens = await syncElectronCookies();
          console.log("[Electron Login] Synced tokens:", { 
            csrf: !!syncedTokens.csrftoken, 
            session: !!syncedTokens.sessionid 
          });
          
          // Fetch user profile and close modal
          console.log("[Electron Login] Fetching user profile...");
          await fetchMeAndMaybeClose("electron-login");
          
          // Close modal
          console.log("[Electron Login] Closing modal...");
          onRequestClose();
        } else {
          setElectronError("Авторизация отменена");
        }
      } else if (result.tokens === null) {
        // User closed window without logging in
        setElectronError("Окно закрыто без авторизации");
      } else {
        setElectronError(result.error || "Ошибка авторизации");
      }
    } catch (err: any) {
      console.error("[Electron Login] Error:", err);
      setElectronError(err?.message || "Неизвестная ошибка");
    } finally {
      setElectronLoading(false);
    }
  }, [electronLoading, fetchMeAndMaybeClose, onRequestClose]);

  // Electron-specific UI
  if (isElectron) {
    return (
      <Modal
        statusBarTranslucent
        visible={visible}
        animationType="slide"
        onRequestClose={onRequestClose}
        transparent
      >
        <View style={{ 
          flex: 1, 
          backgroundColor: "rgba(0,0,0,0.5)", 
          justifyContent: "center", 
          alignItems: "center",
          padding: 20,
        }}>
          <View style={{ 
            backgroundColor: colors.page, 
            borderRadius: 16, 
            padding: 24,
            width: "100%",
            maxWidth: 400,
          }}>
            {/* Header */}
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}>
              <Text style={{ color: colors.title, fontWeight: "900", fontSize: 18 }}>
                {t("menu.login")}
              </Text>
              <IconBtn
                ripple={"#fff2"}
                overlayColor={"rgba(255,255,255,0.12)"}
                onPress={onRequestClose}
                size={36}
              >
                <Feather name="x" size={20} color={colors.title} />
              </IconBtn>
            </View>

            {/* Description */}
            <Text style={{ 
              color: colors.sub, 
              fontSize: 14, 
              marginBottom: 24,
              lineHeight: 20,
            }}>
              Нажмите кнопку ниже, чтобы открыть окно авторизации. После входа в аккаунт окно закроется автоматически.
            </Text>

            {/* Error */}
            {electronError && (
              <View style={{
                backgroundColor: "#ff4444" + "22",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}>
                <Text style={{ color: "#ff6666", fontSize: 13 }}>
                  {electronError}
                </Text>
              </View>
            )}

            {/* Login Button */}
            <Pressable
              onPress={handleElectronLogin}
              disabled={electronLoading}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.accent + "CC" : colors.accent,
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                opacity: electronLoading ? 0.7 : 1,
              })}
            >
              {electronLoading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <>
                  <Feather name="log-in" size={20} color={colors.bg} />
                  <Text style={{ 
                    color: colors.bg, 
                    fontWeight: "700", 
                    fontSize: 15,
                  }}>
                    {t("menu.login")}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Footer */}
            <Text style={{ 
              color: colors.sub, 
              fontSize: 11, 
              textAlign: "center",
              marginTop: 16,
              opacity: 0.7,
            }}>
              nhentai.net
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Web without Electron - show message
  if (Platform.OS === "web" && !WebView) {
    return (
      <Modal
        statusBarTranslucent
        visible={visible}
        animationType="slide"
        onRequestClose={onRequestClose}
        transparent
      >
        <View style={{ 
          flex: 1, 
          backgroundColor: "rgba(0,0,0,0.5)", 
          justifyContent: "center", 
          alignItems: "center",
          padding: 20,
        }}>
          <View style={{ 
            backgroundColor: colors.page, 
            borderRadius: 16, 
            padding: 24,
            width: "100%",
            maxWidth: 400,
          }}>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}>
              <Text style={{ color: colors.title, fontWeight: "900", fontSize: 18 }}>
                {t("menu.login")}
              </Text>
              <IconBtn
                ripple={"#fff2"}
                overlayColor={"rgba(255,255,255,0.12)"}
                onPress={onRequestClose}
                size={36}
              >
                <Feather name="x" size={20} color={colors.title} />
              </IconBtn>
            </View>
            
            <Text style={{ color: colors.error || "#ff6666", fontSize: 14 }}>
              React Native WebView does not support this platform.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Native platforms - use WebView
  return (
    <Modal
      statusBarTranslucent
      visible={visible}
      animationType="slide"
      onRequestClose={onRequestClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.page, paddingTop: 10 }}>
        <View
          style={{
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{ color: colors.title, fontWeight: "900", fontSize: 16 }}
          >
            {t("menu.login")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {canUseNativeJar && (
              <IconBtn
                ripple={"#fff2"}
                overlayColor={"rgba(255,255,255,0.12)"}
                onPress={() => refreshTokensFromJar("manual")}
                size={36}
                accessibilityLabel={t("login.sync")}
              >
                <Feather name="download" size={18} color={colors.title} />
              </IconBtn>
            )}
            <IconBtn
              ripple={"#fff2"}
              overlayColor={"rgba(255,255,255,0.12)"}
              onPress={onRequestClose}
              size={36}
            >
              <Feather name="x" size={20} color={colors.title} />
            </IconBtn>
          </View>
        </View>

        <View style={{ height: 10 }} />

        {WebView && (
          <WebView
            originWhitelist={["*"]}
            source={{ uri: LOGIN_URL }}
            onLoadStart={() => setWvBusy(true)}
            onLoadEnd={async () => {
              setWvBusy(false);
              if (canUseNativeJar) await refreshTokensFromJar("loadEnd");
              await fetchMeAndMaybeClose("loadEnd");
            }}
            onLoadProgress={(e) => {
              if (canUseNativeJar && e?.nativeEvent?.progress >= 0.6) {
                refreshTokensFromJar("progress");
              }
            }}
            onNavigationStateChange={handleNavChange}
            onMessage={onWvMessage}
            injectedJavaScript={injected}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={{ padding: 8 }}>
                <ActivityIndicator />
              </View>
            )}
            allowsBackForwardNavigationGestures
            style={{ flex: 1 }}
          />
        )}

        <View style={{ padding: 8 }}>
          <Text
            style={{ color: colors.sub, fontSize: 12, textAlign: "center" }}
          >
            {wvBusy ? t("login.loading") : t("login.ready")}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
