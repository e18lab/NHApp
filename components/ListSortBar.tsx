import { FilterDropdown, SelectItem } from "@/components/uikit/FilterDropdown";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type ListSortValue =
  | "added_desc"
  | "added_asc"
  | "year_desc"
  | "year_asc"
  | "alpha_asc"
  | "alpha_desc";

export const LIST_SORT_VALUES: ListSortValue[] = [
  "added_desc",
  "added_asc",
  "year_desc",
  "year_asc",
  "alpha_asc",
  "alpha_desc",
];

export function isListSortValue(v: unknown): v is ListSortValue {
  return typeof v === "string" && (LIST_SORT_VALUES as string[]).includes(v);
}

export default function ListSortBar({
  count,
  sort,
  onChangeSort,
}: {
  count: number;
  sort: ListSortValue;
  onChangeSort: (v: ListSortValue) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const options = useMemo<SelectItem[]>(
    () => [
      {
        type: "submenu",
        label: t("listSort.byAdded"),
        children: [
          { value: "added_desc", label: t("listSort.newToOld") },
          { value: "added_asc", label: t("listSort.oldToNew") },
        ],
      },
      {
        type: "submenu",
        label: t("listSort.byYear"),
        children: [
          { value: "year_desc", label: t("listSort.newToOld") },
          { value: "year_asc", label: t("listSort.oldToNew") },
        ],
      },
      {
        type: "submenu",
        label: t("listSort.byAlpha"),
        children: [
          { value: "alpha_asc", label: t("listSort.az") },
          { value: "alpha_desc", label: t("listSort.za") },
        ],
      },
    ],
    [t]
  );

  const groupLabel = useMemo(() => {
    if (sort.startsWith("added_")) return t("listSort.byAdded");
    if (sort.startsWith("year_")) return t("listSort.byYear");
    return t("listSort.byAlpha");
  }, [sort, t]);

  const iconName = useMemo(() => {
    if (sort.startsWith("added_")) return "sliders";
    if (sort.startsWith("year_")) return "calendar";
    return "type";
  }, [sort]);

  const countLabel = useMemo(
    () => t("listSort.totalCount", { count }),
    [t, count]
  );

  return (
    <View style={s.row}>
      <Text style={[s.count, { color: colors.sub }]}>{countLabel}</Text>
      <FilterDropdown
        value={sort}
        onChange={(v) => onChangeSort(v as ListSortValue)}
        options={options}
        placeholder={groupLabel}
        variant="ghost"
        minWidth={160}
        style={s.dd}
        trigger={({ open, onPress }) => (
          <Pressable
            onPress={onPress}
            style={[
              s.btn,
              {
                backgroundColor:
                  (colors as any).surfaceElevated ??
                  (colors as any).searchBg ??
                  (colors as any).page ??
                  colors.bg,
              },
            ]}
          >
            <Feather name={iconName as any} size={16} color={colors.sub} />
            <Text style={[s.btnText, { color: colors.sub }]} numberOfLines={1}>
              {groupLabel}
            </Text>
            <Feather
              name={open ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.sub}
            />
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 12,
  },
  count: { fontSize: 13, fontWeight: "700" },
  dd: { maxWidth: 260 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    minHeight: 42,
  },
  btnText: { fontSize: 15, fontWeight: "600", letterSpacing: 0.2 },
});

