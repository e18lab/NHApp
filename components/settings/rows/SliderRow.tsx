import { useTheme } from "@/lib/ThemeContext";
import Slider from "@react-native-community/slider";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange?: (v: number) => void;
  onCommit: (v: number) => void;
}

export default function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
}: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.labelContainer}>
        <Text style={[styles.label, { color: colors.txt }]}>
          {label}
        </Text>
        <View style={[styles.valueBadge, { backgroundColor: colors.accent + "20" }]}>
          <Text style={[styles.valueText, { color: colors.accent }]}>
            {Math.round(value)}
          </Text>
        </View>
      </View>
      <View style={[styles.sliderContainer, { backgroundColor: colors.page + "50" }]}>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.page + "30"}
          thumbTintColor={colors.accent}
          onValueChange={onChange}
          onSlidingComplete={onCommit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { 
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  label: { 
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  valueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  sliderContainer: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  slider: { 
    height: 40,
  },
});
