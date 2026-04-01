import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
type SizingMode = "wrap" | "fixed";
type PlatformGuard = "all" | "android-only" | "ios-only";
type DeviceGuard = "any" | "phone-only" | "tablet-only";
type NhModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  hint?: string | React.ReactNode | Array<string | React.ReactNode>;
  headerRight?: React.ReactNode;
  heightPercent?: number;
  dimBackground?: boolean;
  backdropColor?: string;
  sheetStyle?: ViewStyle;
  children: React.ReactNode;
  sizing?: SizingMode;
  platformGuard?: PlatformGuard;
  deviceGuard?: DeviceGuard;
  debug?: boolean;
  debugLabel?: string;
  debugOverlay?: boolean;
};
function useIsTablet() {
  const scr = Dimensions.get("screen");
  const shortest = Math.min(scr.width, scr.height);
  return scr.width >= 900 || shortest >= 600;
}
function useDimModalBridge(active: boolean) {
  const prev = React.useRef(false);
  React.useEffect(() => {
    const key = "__dimModalCount";
    const inc = () => {
      const curr = (globalThis as any)[key] ?? 0;
      (globalThis as any)[key] = curr + 1;
      (globalThis as any).__setHasDimModal?.(true);
    };
    const dec = () => {
      const curr = (globalThis as any)[key] ?? 0;
      const next = Math.max(0, curr - 1);
      (globalThis as any)[key] = next;
      (globalThis as any).__setHasDimModal?.(next > 0);
    };
    if (active && !prev.current) {
      prev.current = true;
      inc();
    }
    if (!active && prev.current) {
      prev.current = false;
      dec();
    }
    return () => {
      if (prev.current) {
        prev.current = false;
        dec();
      }
    };
  }, [active]);
}
export default function NhModal({
  visible,
  onClose,
  title,
  hint,
  headerRight,
  heightPercent = 0.85,
  dimBackground = true,
  backdropColor = "rgba(0,0,0,0.45)",
  sheetStyle,
  children,
  sizing = "wrap",
  platformGuard = "all",
  deviceGuard = "any",
  debug = false,
  debugLabel = "NhModal",
  debugOverlay = false,
}: NhModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const isTablet = useIsTablet();
  const SCREEN_H = Dimensions.get("window").height;
  const capRatio = Math.min(1, Math.max(0.5, heightPercent));
  const CAP_H = Math.round(SCREEN_H * capRatio);
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [headerH, setHeaderH] = useState(0);
  const [hintsH, setHintsH] = useState(0);
  const [contentViewportH, setContentViewportH] = useState(0);
  const layoutPassRef = useRef(0);
  const hintsArr = useMemo(
    () => (hint == null ? [] : Array.isArray(hint) ? hint : [hint]),
    [hint]
  );
  useDimModalBridge(visible && dimBackground);
  const effectiveSizing: SizingMode = useMemo(() => {
    let mode: SizingMode = sizing;
    if (platformGuard === "android-only" && Platform.OS !== "android")
      mode = "wrap";
    if (platformGuard === "ios-only" && Platform.OS !== "ios") mode = "wrap";
    if (deviceGuard === "phone-only" && isTablet) mode = "wrap";
    if (deviceGuard === "tablet-only" && !isTablet) mode = "wrap";
    return mode;
  }, [sizing, platformGuard, deviceGuard, isTablet]);
  const contentMaxH = Math.max(1, CAP_H - insets.bottom - headerH - hintsH);
  const dbg = (...args: any[]) => {
    if (debug) console.log(`[${debugLabel}]`, ...args);
  };
  const runOpen = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };
  const runClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setMounted(false);
        onClose?.();
      }
    });
  };
  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN_H);
      fade.setValue(0);
    } else if (mounted) {
      runClose();
    }
  }, [visible]);
  if (!mounted) return null;
  const onSheetLayout = (e: LayoutChangeEvent) => {
    layoutPassRef.current += 1;
    dbg("onSheetLayout", {
      h: Math.round(e.nativeEvent.layout.height),
      pass: layoutPassRef.current,
    });
  };
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={runClose}
      onShow={() => requestAnimationFrame(runOpen)}
      hardwareAccelerated
    >
      {dimBackground && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { opacity: fade }]}
        >
          <BlurView
            intensity={0}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              "rgba(0,0,0,0)",
              backdropColor ?? "rgba(0,0,0,0.6)",
            ]}
            locations={[0, 0.35, 1]}
            start={{ x: 0.5, y: 0.2 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      <Pressable style={StyleSheet.absoluteFill} onPress={runClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          collapsable={false}
          onLayout={onSheetLayout}
          style={[
            styles.sheet,
            effectiveSizing === "fixed"
              ? { height: CAP_H }
              : { maxHeight: CAP_H },
            {
              transform: [{ translateY }],
              backgroundColor: colors.page,
              borderColor: colors.page,
              paddingBottom: insets.bottom,
            },
            sheetStyle,
          ]}
        >
          {(title || hintsArr.length > 0) && (
            <>
              <View
                onLayout={(e) =>
                  setHeaderH(Math.round(e.nativeEvent.layout.height))
                }
                style={[
                  styles.header,
                  { backgroundColor: colors.tagBg, borderColor: colors.page },
                ]}
              >
                <Text style={[styles.title, { color: colors.txt }]}>
                  {typeof title === "string" ? title : title}
                </Text>
                {!!headerRight && (
                  <View style={{ marginRight: 36 }}>{headerRight}</View>
                )}
                <Pressable
                  onPress={runClose}
                  hitSlop={10}
                  style={styles.closeIcon}
                >
                  <Feather name="x" size={18} color={colors.txt} />
                </Pressable>
              </View>
              {hintsArr.length > 0 && (
                <View
                  onLayout={(e) =>
                    setHintsH(Math.round(e.nativeEvent.layout.height))
                  }
                  style={[styles.hintsWrap, { backgroundColor: colors.tagBg }]}
                >
                  {hintsArr.map((h, idx) => (
                    <View key={idx} style={styles.hintRow}>
                      <Feather name="info" size={14} color={colors.metaText} />
                      {typeof h === "string" ? (
                        <Text style={{ color: colors.metaText, fontSize: 12 }}>
                          {h}
                        </Text>
                      ) : (
                        h
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
          <View
            onLayout={(e) =>
              setContentViewportH(Math.round(e.nativeEvent.layout.height))
            }
            style={[
              styles.contentBox,
              effectiveSizing === "wrap" && { maxHeight: contentMaxH },
              effectiveSizing === "fixed" && { height: contentMaxH },
            ]}
          >
            {children}
          </View>
          {debugOverlay && (
            <View style={styles.debugBadge}>
              <Text style={styles.debugText}>
                {`cap:${CAP_H} head:${headerH} hint:${hintsH} max:${contentMaxH} pass:${layoutPassRef.current}`}
              </Text>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -6 },
      },
      android: { elevation: 12 },
    }),
  },
  header: {
    height: 52,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800" },
  closeIcon: { position: "absolute", right: 8, top: 8, padding: 6 },
  hintsWrap: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  contentBox: {
    minHeight: 1,
    flexShrink: 1,
    alignSelf: "stretch",
    overflow: "hidden",
  },
  debugBadge: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 6,
    borderRadius: 8,
  },
  debugText: { color: "#fff", fontSize: 10, lineHeight: 12 },
});
