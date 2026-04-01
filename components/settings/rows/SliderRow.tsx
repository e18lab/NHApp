import { isElectron } from "@/electron/bridge";
import { useTheme } from "@/lib/ThemeContext";
import Slider from "@react-native-community/slider";
import React from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";

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
  const { width } = useWindowDimensions();
  const isDesktop = isElectron() || (Platform.OS === "web" && width >= 768);
  const isTablet = width >= 600 && width < 768;

  return (
    <View style={[
      styles.wrap,
      isDesktop && styles.wrapDesktop,
      isTablet && styles.wrapTablet,
    ]}>
      <View style={styles.labelContainer}>
        <Text style={[
          styles.label,
          isDesktop && styles.labelDesktop,
          isTablet && styles.labelTablet,
          { color: colors.txt }
        ]}>
          {label}
        </Text>
        <View style={[
          styles.valueBadge,
          isDesktop && styles.valueBadgeDesktop,
          isTablet && styles.valueBadgeTablet,
          { backgroundColor: colors.accent + "20" }
        ]}>
          <Text style={[
            styles.valueText,
            isDesktop && styles.valueTextDesktop,
            isTablet && styles.valueTextTablet,
            { color: colors.accent }
          ]}>
            {Math.round(value)}
          </Text>
        </View>
      </View>
      <View style={[
        styles.sliderContainer,
        isDesktop && styles.sliderContainerDesktop,
        isTablet && styles.sliderContainerTablet,
        { backgroundColor: colors.page + "50" }
      ]}>
        <Slider
          style={[
            styles.slider,
            isDesktop && styles.sliderDesktop,
            isTablet && styles.sliderTablet,
          ]}
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
  wrapDesktop: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  wrapTablet: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 5,
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
  labelDesktop: {
    fontSize: 17,
    letterSpacing: 0.3,
  },
  labelTablet: {
    fontSize: 16,
    letterSpacing: 0.25,
  },
  valueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  valueBadgeDesktop: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  valueBadgeTablet: {
    paddingHorizontal: 11,
    paddingVertical: 4.5,
    borderRadius: 9,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  valueTextDesktop: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
  valueTextTablet: {
    fontSize: 13.5,
    letterSpacing: 0.25,
  },
  sliderContainer: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sliderContainerDesktop: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  sliderContainerTablet: {
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 4.5,
  },
  slider: { 
    height: 40,
  },
  sliderDesktop: {
    height: 44,
  },
  sliderTablet: {
    height: 42,
  },
});
