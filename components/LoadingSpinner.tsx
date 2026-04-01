import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

interface LoadingSpinnerProps {
  size?: "small" | "large";
  color?: string;
  fullScreen?: boolean;
  message?: string;
}

export default function LoadingSpinner({
  size = "large",
  color,
  fullScreen = false,
  message,
}: LoadingSpinnerProps) {
  const { colors } = useTheme();
  const spinnerColor = color || colors.accent;

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size={size} color={spinnerColor} />
        {message && (
          <View style={styles.messageContainer}>
            <View style={[styles.message, { color: colors.sub }]}>{message}</View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={spinnerColor} />
      {message && (
        <View style={[styles.message, { color: colors.sub }]}>{message}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  messageContainer: {
    marginTop: 16,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
});
