import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

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
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={[styles.cardTitle, { color: colors.txt }]}>{title}</Text>
        {description ? (
          <Text style={[styles.desc, { color: colors.sub }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.switchContainer, { 
        backgroundColor: value ? colors.accent + "20" : colors.page + "30",
      }]}>
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
  content: {
    flex: 1,
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: "700", 
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  desc: { 
    fontSize: 13, 
    marginTop: 6, 
    lineHeight: 18, 
    opacity: 0.75,
  },
  switchContainer: {
    borderRadius: 20,
    padding: 2,
  },
});
