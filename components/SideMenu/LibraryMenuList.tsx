import { CardPressable } from "@/components/ui/CardPressable";
import type { MenuItem } from "@/constants/Menu";
import type { MenuRoute } from "@/types/routes";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
export const LibraryMenuList = React.memo(function LibraryMenuList({
  items,
  pathname,
  loggedIn,
  colors,
  rippleItem,
  overlaySoft,
  goTo,
}: {
  items: MenuItem[];
  pathname?: string | null;
  loggedIn: boolean;
  colors: any;
  rippleItem: string;
  overlaySoft: string;
  goTo: (route: MenuRoute) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((item) => {
        const active = pathname?.startsWith(item.route);
        const disabled = !loggedIn && item.route === "/favoritesOnline";
        const tint = disabled
          ? colors.sub
          : active
          ? colors.accent
          : colors.menuTxt;
        const bg = active ? colors.accent + "14" : colors.tagBg;
        return (
          <CardPressable
            key={item.route}
            ripple={rippleItem}
            overlayColor={overlaySoft}
            radius={14}
            onPress={() => {
              if (!disabled) goTo(item.route);
            }}
            disabled={disabled}
            accessibilityLabel={item.labelKey}
          >
            <View
              style={[
                styles.row,
                {
                  backgroundColor: bg,
                  borderColor: active ? colors.accent + "55" : colors.page,
                },
              ]}
            >
              {active && (
                <View style={[styles.activeBar, { backgroundColor: tint }]} />
              )}
              <Feather
                name={item.icon as any}
                size={18}
                color={tint}
                style={{ width: 22, textAlign: "center", marginRight: 12 }}
              />
              <Text
                style={[styles.itemTxt, { color: tint, flex: 1 }]}
                numberOfLines={1}
              ></Text>
            </View>
          </CardPressable>
        );
      })}
    </View>
  );
});
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
  },
  activeBar: { width: 3, height: "70%", borderRadius: 2, marginRight: 8 },
  itemTxt: { fontSize: 13, fontWeight: "900", letterSpacing: 0.2 },
});
