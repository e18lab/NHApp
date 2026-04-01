import React, { useRef } from "react";
import {
  Animated,
  Insets,
  Pressable,
  StyleProp,
  StyleSheet,
  Vibration,
  View,
  ViewStyle,
} from "react-native";
export type CardPressableProps = {
  children: React.ReactNode;
  radius?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  ripple?: string;
  overlayColor?: string;
  hitSlop?: number | Insets;
  accessibilityLabel?: string;
  pressedScale?: number;
  animationDuration?: number;
  onFeedback?: boolean;
};
export const CardPressable = React.memo(function CardPressable({
  children,
  radius = 14,
  onPress,
  onLongPress,
  delayLongPress,
  style,
  disabled,
  ripple = "rgba(0, 0, 0, 0.2)",
  overlayColor,
  hitSlop,
  accessibilityLabel,
  pressedScale = 0.97,
  animationDuration = 150,
  onFeedback = true,
}: CardPressableProps) {
  const overlay = overlayColor ?? "rgba(255,255,255,0.10)";
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animateScale = (toValue: number) => {
    Animated.timing(animatedScale, {
      toValue,
      duration: animationDuration,
      useNativeDriver: true,
    }).start();
  };
  const handlePressIn = () => {
    if (onFeedback && !disabled) {
      Vibration.vibrate(10);
    }
    animateScale(pressedScale);
  };
  const handlePressOut = () => {
    animateScale(1);
  };
  const handlePress = () => {
    onPress?.();
  };
  const scaleStyle = {
    transform: [{ scale: animatedScale }],
  };
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress ?? 350}
        android_ripple={
          !disabled ? { color: ripple, borderless: false } : undefined
        }
        hitSlop={hitSlop}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [{ borderRadius: radius }]}
      >
        {({ pressed }) => (
          <Animated.View style={[scaleStyle, { borderRadius: radius }]}>
            {children}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: overlay,
                  opacity: pressed && !disabled ? 1 : 0,
                },
              ]}
            />
          </Animated.View>
        )}
      </Pressable>
    </View>
  );
});
