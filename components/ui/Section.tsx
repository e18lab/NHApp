import React from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";
export const Section = React.memo(function Section({
  title,
  color,
  dividerColor,
  dense = false,
  style,
}: {
  title?: string;
  color: string;
  dividerColor?: string;
  dense?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      {title ? (
        <Text
          style={{
            color,
            fontSize: dense ? 11 : 12,
            fontWeight: "800",
            letterSpacing: 0.6,
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          {title}
        </Text>
      ) : null}
      <View style={{ height: 1, backgroundColor: dividerColor ?? "#0002", opacity: 0.7 }} />
    </View>
  );
});
