import { useTheme } from "@/lib/ThemeContext";
import { Stack } from "expo-router";
import React from "react";

export default function BookLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { flex: 1, backgroundColor: colors.bg },
        animation: "simple_push",
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="comments" />
    </Stack>
  );
}
