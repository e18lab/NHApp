import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

type Status = "idle" | "verifying" | "success" | "error";

export type ElectronCaptchaButtonProps = {
  onToken: (token: string) => void;
  onClear?: () => void;
  resetKey?: number | string;
  accent?: string;
  subColor?: string;
};

type ElWin = Window & {
  electron?: {
    getCaptchaToken?: (o?: { timeout?: number; autoShow?: number }) => Promise<string | null>;
  };
};

// ─── Cloudflare cloud SVG ─────────────────────────────────────────────────────

function CFCloud({ size = 32 }: { size?: number }) {
  const html = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"
    width="${size}" height="${size * 0.6}" style="display:block">
    <path fill="#F6821F" d="
      M82 40 C82 40 83 33 77 30 C77 22 70 17 62 19 C58 12 50 8 41 10
      C29 12 22 22 23 33 C18 33 13 38 14 44 C15 49 20 52 25 52
      L78 52 C84 52 88 48 88 43 C88 38 85 36 82 40 Z
    "/>
  </svg>`;

  return (
    <View
      // @ts-ignore — dangerouslySetInnerHTML в React Native Web
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ width: size, height: size * 0.6 }}
    />
  );
}

// ─── Spinner — правильная дуга ────────────────────────────────────────────────

function Spinner({ color = "#F6821F", size = 20 }: { color?: string; size?: number }) {
  const rot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rot, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: false, // RN Web не поддерживает native driver для rotate
      })
    );
    anim.start();
    return () => anim.stop();
  }, [rot]);

  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2.5,
        borderColor: "transparent",
        borderTopColor: color,
        transform: [{ rotate }],
      }}
    />
  );
}

// ─── Левая иконка (checkbox → spinner → ✓ → ✕) ───────────────────────────────

function LeftIcon({ status, accent }: { status: Status; accent: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === "success" || status === "error") {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 120, useNativeDriver: false }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: false, bounciness: 8 }),
      ]).start();
    }
  }, [status, scale]);

  if (status === "verifying") {
    return <Spinner color={accent} size={22} />;
  }

  if (status === "success") {
    return (
      <Animated.View style={[styles.iconCircle, styles.iconSuccess, { transform: [{ scale }] }]}>
        <Text style={styles.iconText}>✓</Text>
      </Animated.View>
    );
  }

  if (status === "error") {
    return (
      <Animated.View style={[styles.iconCircle, styles.iconError, { transform: [{ scale }] }]}>
        <Text style={[styles.iconText, { color: "#f87171" }]}>!</Text>
      </Animated.View>
    );
  }

  // idle — квадратный чекбокс
  return <View style={styles.checkbox} />;
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export function ElectronCaptchaButton({
  onToken,
  onClear,
  resetKey = 0,
  accent = "#F6821F",
}: ElectronCaptchaButtonProps) {
  const [status, setStatus] = useState<Status>("idle");

  // Фоновая подсветка при нажатии
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setStatus("idle");
    onClear?.();
  }, [resetKey]);

  const handlePress = async () => {
    if (status === "verifying" || status === "success") return;
    setStatus("verifying");
    onClear?.();

    try {
      const api = (window as ElWin).electron?.getCaptchaToken;
      if (!api) throw new Error("no api");

      // autoShow:0 → всплывашка появляется сразу, без ожидания авто-решения
      const token = await api({ timeout: 180_000, autoShow: 0 });

      if (token && token.length > 20) {
        setStatus("success");
        onToken(token);
      } else {
        setStatus("error");
        onClear?.();
      }
    } catch {
      setStatus("error");
      onClear?.();
    }
  };

  const onPressIn = () => {
    Animated.timing(pressAnim, { toValue: 1, duration: 100, useNativeDriver: false }).start();
  };
  const onPressOut = () => {
    Animated.timing(pressAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  const bgColor = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0)", "rgba(255,255,255,0.04)"],
  });

  const borderColor =
    status === "success" ? "#166534" :
    status === "error"   ? "#7f1d1d" :
    status === "verifying" ? accent :
    "#3a3a3a";

  const labelText =
    status === "idle"      ? "Verify you are human" :
    status === "verifying" ? "Verifying…"            :
    status === "success"   ? "You are verified"      :
                             "Failed — tap to retry";

  const labelColor =
    status === "success" ? "#4ade80" :
    status === "error"   ? "#f87171" :
    "#d4d4d4";

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
    >
      <Animated.View style={[styles.container, { borderColor, backgroundColor: bgColor }]}>
        {/* Left */}
        <View style={styles.left}>
          <LeftIcon status={status} accent={accent} />
        </View>

        {/* Label */}
        <View style={styles.labelWrap}>
          <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
            {labelText}
          </Text>
        </View>

        {/* Cloudflare brand */}
        <View style={styles.brand}>
          <CFCloud size={38} />
          <Text style={styles.brandName}>Cloudflare</Text>
          <Text style={styles.brandLinks}>Privacy · Terms</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Стили ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 68,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#3a3a3a",
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    overflow: "hidden",
  },

  left: {
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    flexShrink: 0,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#555",
    backgroundColor: "transparent",
  },

  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  iconSuccess: {
    backgroundColor: "#166534",
    borderWidth: 1.5,
    borderColor: "#4ade80",
  },
  iconError: {
    backgroundColor: "#7f1d1d",
    borderWidth: 1.5,
    borderColor: "#f87171",
  },
  iconText: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },

  labelWrap: {
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#d4d4d4",
  },

  brand: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    gap: 2,
    flexShrink: 0,
  },
  brandName: {
    color: "#666",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  brandLinks: {
    color: "#444",
    fontSize: 8,
  },
});
