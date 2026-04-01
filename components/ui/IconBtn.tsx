import React from "react";
import { View } from "react-native";
import { CardPressable } from "./CardPressable";
export type IconBtnProps = {
  onPress?: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  ripple: string;
  overlayColor?: string;
  size?: number;
  radius?: number;
  hitSlop?: number;
  accessibilityLabel?: string;
  shape?: "circle" | "rounded" | "square";
};
export const IconBtn = React.memo(function IconBtn({
  onPress,
  onLongPress,
  children,
  ripple,
  overlayColor,
  size = 36,
  radius = 10,
  hitSlop = 6,
  accessibilityLabel,
  shape = "rounded",
}: IconBtnProps) {
  const r = shape === "circle" ? size / 2 : shape === "square" ? 0 : radius;
  return (
    <CardPressable
      onPress={onPress}
      onLongPress={onLongPress}
      ripple={ripple}
      overlayColor={overlayColor}
      radius={r}
      hitSlop={hitSlop}
      style={{ width: size, height: size }}
      accessibilityLabel={accessibilityLabel}
      pressedScale={0.96}
    >
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </CardPressable>
  );
});
