import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "error" | "success" | "info";

export type ToastOptions = {
  type?: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
};

type ToastState = (ToastOptions & { id: number; type: ToastType; durationMs: number }) | null;

type ToastContextValue = {
  showToast: (opts: ToastOptions) => void;
  hideToast: () => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [toast, setToast] = React.useState<ToastState>(null);
  const anim = React.useRef(new Animated.Value(0)).current;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [anim]);

  const showToast = React.useCallback(
    (opts: ToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const next: ToastState = {
        id: Date.now(),
        type: opts.type ?? "info",
        title: opts.title,
        message: opts.message,
        durationMs: opts.durationMs ?? 3200,
      };
      setToast(next);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      timerRef.current = setTimeout(() => {
        hideToast();
      }, next.durationMs);
    },
    [anim, hideToast]
  );

  React.useEffect(() => () => hideToast(), [hideToast]);

  const value = React.useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);

  const bottomOffset = Math.max(insets.bottom, 10) + 100;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const opacity = anim;

  const ui = React.useMemo(() => {
    const baseCard = (colors as any).surfaceElevated ?? "#111827";
    const text = (colors as any).title ?? "#e5e7eb";
    const sub = (colors as any).metaText ?? "#cbd5e1";
    const accent = colors.accent ?? "#3b82f6";
    const danger = "#ef4444";
    return {
      card: baseCard + "F2",
      text,
      sub,
      border: "#ffffff14",
      accentBorder: accent + "44",
      dangerBorder: danger + "55",
    };
  }, [colors]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.wrap,
              { bottom: bottomOffset, opacity, transform: [{ translateY }] },
            ]}
          >
            <Pressable
              onPress={hideToast}
              style={[
                styles.toast,
                {
                  backgroundColor: ui.card,
                  borderColor:
                    toast.type === "error"
                      ? ui.dangerBorder
                      : toast.type === "success"
                      ? ui.accentBorder
                      : ui.border,
                },
              ]}
            >
              <Text style={[styles.title, { color: ui.text }]}>{toast.title}</Text>
              {toast.message ? (
                <Text style={[styles.msg, { color: ui.sub }]}>{toast.message}</Text>
              ) : null}
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 12,
    zIndex: 9999,
  },
  toast: {
    alignSelf: "center",
    width: "auto",
    maxWidth: "92%",
    maxWidth: 560,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  title: { fontWeight: "800", fontSize: 13, flexShrink: 1 },
  msg: { marginTop: 4, fontSize: 12, lineHeight: 16, flexShrink: 1 },
});

