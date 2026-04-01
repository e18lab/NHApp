import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
export function IconBtn({
  onPress,
  name,
  color,
}: {
  onPress: () => void;
  name: keyof typeof Feather.glyphMap;
  color: string;
}) {
  return (
    <View style={{ borderRadius: 10, overflow: "hidden" }}>
      <Pressable
        onPress={onPress}
        style={styles.iconBtn}
        android_ripple={{ color: "#ffffff22", borderless: false }}
      >
        <Feather name={name} size={18} color={color} />
      </Pressable>
    </View>
  );
}
export function ToggleBtn({
  active,
  onToggle,
  name,
  activeColor,
  color,
}: {
  active: boolean;
  onToggle: () => void;
  name: keyof typeof Feather.glyphMap;
  activeColor: string;
  color: string;
}) {
  return (
    <View style={{ borderRadius: 10, overflow: "hidden" }}>
      <Pressable
        onPress={onToggle}
        style={[
          styles.iconBtn,
          active && { backgroundColor: activeColor + "12" },
        ]}
        android_ripple={{ color: activeColor + "22", borderless: false }}
      >
        <Feather name={name} size={18} color={active ? activeColor : color} />
      </Pressable>
    </View>
  );
}
export function RowBtn({
  onPress,
  icon,
  label,
  color,
}: {
  onPress: () => void;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
}) {
  return (
    <View style={{ borderRadius: 10, overflow: "hidden" }}>
      <Pressable
        onPress={onPress}
        style={styles.rowBtn}
        android_ripple={{ color: "#ffffff22", borderless: false }}
      >
        <Feather name={icon} size={18} color={color} />
        <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      </Pressable>
    </View>
  );
}
export function RowToggle({
  active,
  onToggle,
  icon,
  label,
  color,
  activeColor,
}: {
  active: boolean;
  onToggle: () => void;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  activeColor: string;
}) {
  return (
    <View style={{ borderRadius: 10, overflow: "hidden" }}>
      <Pressable
        onPress={onToggle}
        style={[
          styles.rowBtn,
          active && { backgroundColor: activeColor + "12" },
        ]}
        android_ripple={{ color: activeColor + "22", borderless: false }}
      >
        <Feather name={icon} size={18} color={active ? activeColor : color} />
        <Text
          style={[
            styles.rowLabel,
            { color: active ? activeColor : color, fontWeight: "800" },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  iconBtn: {
    padding: 8,
    borderRadius: 10,
    overflow: "hidden",
  },
  rowBtn: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    overflow: "hidden",
  },
  rowLabel: { fontSize: 10, fontWeight: "600" },
});
