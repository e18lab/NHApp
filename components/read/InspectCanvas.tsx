import ExpoImage from "@/components/ExpoImageCompat";
import React from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

export function InspectCanvas({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const pan = Gesture.Pan().onChange((e) => {
    tx.value += e.changeX;
    ty.value += e.changeY;
  });
  const pinch = Gesture.Pinch().onChange((e) => {
    const next = scale.value * e.scaleChange;
    scale.value = Math.max(1, next);
  });
  const rotate = Gesture.Rotation().onChange((e) => {
    rotation.value += e.rotationChange;
  });

  const composed = Gesture.Simultaneous(pan, pinch, rotate);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { zIndex: 10, justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Animated.View style={[{ width, height }, style]}>
          <ExpoImage
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            cachePolicy="disk"
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
