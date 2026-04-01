import { useTheme } from "@/lib/ThemeContext";
import {
  getDownloadProgressSnapshot,
  subscribeDownloadProgress,
} from "@/lib/downloadProgressStore";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n || 0));
}

export default function DownloadProgressBanner({
  topInset = 0,
  pressable = true,
}: {
  topInset?: number;
  pressable?: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  const snap = useSyncExternalStore(
    subscribeDownloadProgress,
    getDownloadProgressSnapshot,
    getDownloadProgressSnapshot
  );

  const pct = useMemo(() => Math.round(clamp01(snap.progress) * 100), [snap.progress]);

  if (!snap.active) return null;

  const content = (
    <>
      <View style={s.row}>
        <Feather name="download" size={16} color={colors.bg} />
        <Text style={[s.title, { color: colors.bg }]} numberOfLines={1}>
          {snap.title || "Downloading"}
        </Text>
        <Text style={[s.pct, { color: colors.bg }]}>{pct}%</Text>
      </View>

      <View style={[s.barTrack, { backgroundColor: colors.bg + "55" }]}>
        <View style={[s.barFill, { backgroundColor: colors.bg, width: `${pct}%` as any }]} />
      </View>
    </>
  );

  if (!pressable) {
    return (
      <View
        style={[
          s.root,
          {
            backgroundColor: colors.accent,
            paddingTop: 10,
            paddingBottom: 10,
          },
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => router.push("/downloaded")}
      style={[
        s.root,
        {
          backgroundColor: colors.accent,
          paddingTop: 10,
          paddingBottom: 10,
        },
      ]}
      android_ripple={{ color: "#ffffff22", borderless: false }}
    >
      {content}
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontSize: 13, fontWeight: "700" },
  pct: { fontSize: 12, fontWeight: "700" },
  barTrack: { height: 4, marginTop: 8 },
  barFill: { height: "100%" },
});

