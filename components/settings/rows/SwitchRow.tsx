import { isElectron } from "@/electron/bridge";
import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import { Platform, StyleSheet, Switch, Text, useWindowDimensions, View } from "react-native";

interface Props {
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export default function SwitchRow({
  title,
  description,
  value,
  onChange,
}: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = isElectron() || (Platform.OS === "web" && width >= 768);
  const isTablet = width >= 600 && width < 768;

  return (
    <View style={[
      styles.container,
      isDesktop && styles.containerDesktop,
      isTablet && styles.containerTablet,
    ]}>
      <View style={styles.content}>
        <Text style={[
          styles.cardTitle,
          isDesktop && styles.cardTitleDesktop,
          isTablet && styles.cardTitleTablet,
          { color: colors.txt }
        ]}>
          {title}
        </Text>
        {description ? (
          <Text style={[
            styles.desc,
            isDesktop && styles.descDesktop,
            isTablet && styles.descTablet,
            { color: colors.sub }
          ]}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[
        styles.switchContainer,
        isDesktop && styles.switchContainerDesktop,
        isTablet && styles.switchContainerTablet,
        { 
          backgroundColor: value ? colors.accent + "20" : colors.page + "30",
        }
      ]}>
        <Switch
          value={value}
          onValueChange={onChange}
          thumbColor={value ? colors.accent : "#ffffff"}
          trackColor={{ 
            true: colors.accent + "90", 
            false: colors.page + "50" 
          }}
          ios_backgroundColor={colors.page + "50"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  containerDesktop: {
    gap: 20,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  containerTablet: {
    gap: 18,
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  content: {
    flex: 1,
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: "700", 
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  cardTitleDesktop: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  cardTitleTablet: {
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: 0.25,
  },
  desc: { 
    fontSize: 13, 
    marginTop: 6, 
    lineHeight: 18, 
    opacity: 0.75,
  },
  descDesktop: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  descTablet: {
    fontSize: 13.5,
    marginTop: 7,
    lineHeight: 19,
  },
  switchContainer: {
    borderRadius: 20,
    padding: 2,
  },
  switchContainerDesktop: {
    borderRadius: 22,
    padding: 3,
  },
  switchContainerTablet: {
    borderRadius: 21,
    padding: 2.5,
  },
});
