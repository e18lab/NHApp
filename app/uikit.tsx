import HuePaletteSelector from "@/components/settings/HuePaletteSelector";
import SwitchRow from "@/components/settings/rows/SwitchRow";
import { UIKIT_AS_HOME_KEY, STORAGE_KEY_HUE } from "@/components/settings/keys";
import { Button } from "@/components/uikit/Button";
import { Select } from "@/components/uikit/Select";
import { FilterDropdown } from "@/components/uikit/FilterDropdown";
import type { SelectItem } from "@/components/uikit/FilterDropdown";
import { KeyInputModal } from "@/components/uikit/KeyInputModal";
import { Slider } from "@/components/uikit/Slider";
import { Toggle } from "@/components/uikit/Toggle";
import { ViewToggle } from "@/components/uikit/ViewToggle";
import { Graph } from "@/components/uikit/Graph";
import { useGraphStorageData } from "@/hooks/useGraphStorageData";
import { TypographySample } from "@/components/uikit/Typography";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { usePersistedState } from "@/hooks/usePersistedState";

function GraphStorageBlock() {
  const { colors } = useTheme();
  const { segments, loading, error, documentPath } = useGraphStorageData();
  if (loading && segments.length === 0) {
    return (
      <Text style={[styles.sectionTitle, { color: colors.sub, fontSize: 14 }]}>
        Загрузка…
      </Text>
    );
  }
  if (error) {
    return (
      <Text style={[styles.sectionTitle, { color: colors.sub, fontSize: 14 }]}>
        Ошибка: {error}
      </Text>
    );
  }
  const isPc = Platform.OS === "web";
  const title = isPc ? (documentPath ? "Хранилище" : "Хранилище (демо)") : "Хранилище";
  const pathText = documentPath
    ? `Путь к скачанным: ${documentPath}NHAppAndroid`
    : "";
  const description = [
    pathText,
    isPc ? "Скачанные, хранилище приложения, свободно, другие приложения. Реальные данные (ПК)." : "Скачанные, хранилище приложения, свободно, другие приложения. На Android — реальные данные.",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <Graph
      title={title}
      segments={segments}
      description={description}
    />
  );
}

export default function UIKitScreen() {
  const { colors, hue, setHue } = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;
  const [uikitAsHome, setUikitAsHome] = usePersistedState<boolean>(UIKIT_AS_HOME_KEY, false);
  const [hueLocal, setHueLocal] = usePersistedState<number>(STORAGE_KEY_HUE, hue);
  const [loadingWhich, setLoadingWhich] = useState<string | null>(null);
  const [selectValue, setSelectValue] = useState<string | number | null>("b");
  const [period, setPeriod] = useState<string | undefined>("new");
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sliderValue, setSliderValue] = useState(50);
  const [volumeValue, setVolumeValue] = useState(75);
  const [keyInputVisible, setKeyInputVisible] = useState(false);
  const [keyInputValue, setKeyInputValue] = useState("50");

  const periodOptions: SelectItem[] = [
    { value: "new", label: t("uikit.periodNew") },
    { value: "today", label: t("uikit.periodToday") },
    { value: "week", label: t("uikit.periodWeek") },
    { value: "month", label: t("uikit.periodMonth") },
    { value: "all", label: t("uikit.periodAll") },
    {
      type: "submenu",
      label: t("uikit.dateFilterSubmenu"),
      backLabel: t("uikit.back"),
      icon: (c: string) => <Feather name="calendar" size={15} color={c} />,
      children: [
        {
          type: "submenu",
          label: t("uikit.dateCustomRange"),
          backLabel: t("uikit.back"),
          icon: (c: string) => <Feather name="calendar" size={15} color={c} />,
          children: [
            { value: "custom", label: t("uikit.dateCustomPick") },
          ],
        },
        { value: "24h", label: t("uikit.datePreset24h") },
        { value: "7d", label: t("uikit.datePreset7d") },
        { value: "30d", label: t("uikit.datePreset30d") },
      ],
    },
  ];

  useEffect(() => {
    if (hueLocal !== hue) setHue(hueLocal);
  }, [hueLocal, hue]);

  const startLoading = useCallback((key: string) => {
    setLoadingWhich(key);
    setTimeout(() => setLoadingWhich(null), 2000);
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.searchBg ?? colors.bg,
              borderBottomColor: colors.sub + "40",
            },
          ]}
        >
          <Text
            style={[
              styles.title,
              {
                color: colors.txt,
                fontSize: isDesktop ? 20 : 18,
              },
            ]}
            numberOfLines={1}
          >
            {t("uikit.title")}
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: isDesktop ? 24 : 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.toggleRow}>
            <SwitchRow
              title={t("uikit.openAsHome")}
              description={t("uikit.openAsHomeDesc")}
              value={uikitAsHome}
              onChange={setUikitAsHome}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt }]}>
            {t("uikit.paletteTitle")}
          </Text>
          <View style={styles.paletteBlock}>
            <HuePaletteSelector
              value={hue}
              onValueChange={(deg) => {
                setHueLocal(deg);
                setHue(deg);
              }}
              onComplete={setHue}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            {t("uikit.typographyTitle")}
          </Text>
          <View style={styles.typographyBlock}>
            <TypographySample variant="h1" sample={t("uikit.typographySample")} />
            <TypographySample variant="h2" sample={t("uikit.typographySample")} />
            <TypographySample variant="h3" sample={t("uikit.typographySample")} />
            <TypographySample variant="h4" sample={t("uikit.typographySample")} />
            <TypographySample variant="body" sample={t("uikit.typographySample")} />
            <TypographySample variant="bodySmall" sample={t("uikit.typographySample")} />
            <TypographySample variant="caption" sample={t("uikit.typographySample")} />
            <TypographySample variant="label" sample={t("uikit.typographySample")} />
            <TypographySample variant="overline" sample={t("uikit.typographySample")} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            {t("uikit.buttonTitle")}
          </Text>
          <View style={styles.buttonBlock}>
            <Button
              title={t("uikit.buttonPrimary")}
              variant="primary"
              onPress={() => {}}
              onLongPress={() => {}}
            />
            <Button
              title={t("uikit.buttonSecondary")}
              variant="secondary"
              onPress={() => {}}
            />
            <Button
              title={t("uikit.buttonOutline")}
              variant="outline"
              onPress={() => {}}
            />
            <Button
              title={t("uikit.buttonCompact")}
              variant="primary"
              compact
              onPress={() => {}}
            />
            <Button
              title={t("uikit.buttonGhost")}
              variant="ghost"
              onPress={() => {}}
            />
            <Button
              title={t("uikit.buttonChip")}
              variant="chip"
              onPress={() => {}}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            {t("uikit.loadingTitle")}
          </Text>
          <View style={styles.buttonBlock}>
            <Button
              title={t("uikit.loadingWithText")}
              variant="primary"
              loading={loadingWhich === "primary"}
              loadingLabel={t("uikit.loadingLabel")}
              onPress={() => startLoading("primary")}
            />
            <Button
              title={t("uikit.loadingWithText")}
              variant="secondary"
              loading={loadingWhich === "secondary"}
              loadingLabel={t("uikit.loadingLabel")}
              onPress={() => startLoading("secondary")}
            />
            <Button
              title={t("uikit.loadingWithText")}
              variant="outline"
              loading={loadingWhich === "outline"}
              loadingLabel={t("uikit.loadingLabel")}
              onPress={() => startLoading("outline")}
            />
            <Button
              title=""
              variant="primary"
              iconOnly
              leftIcon={(color) => <Feather name="loader" size={20} color={color} />}
              loading={loadingWhich === "icon-p"}
              accessibilityLabel={t("uikit.loadingLabel")}
              onPress={() => startLoading("icon-p")}
            />
            <Button
              title=""
              variant="ghost"
              iconOnly
              leftIcon={(color) => <Feather name="loader" size={20} color={color} />}
              loading={loadingWhich === "icon-g"}
              accessibilityLabel={t("uikit.loadingLabel")}
              onPress={() => startLoading("icon-g")}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            {t("uikit.iconsTitle")}
          </Text>
          <View style={styles.buttonBlock}>
            <Button
              title={t("uikit.download")}
              variant="primary"
              leftIcon={(color) => <Feather name="download" size={18} color={color} />}
              iconGap={10}
              onPress={() => {}}
            />
            <Button
              title={t("uikit.download")}
              variant="outline"
              rightIcon={(color) => <Feather name="download" size={18} color={color} />}
              iconGap={8}
              onPress={() => {}}
            />
            <Button
              title=""
              variant="primary"
              iconOnly
              leftIcon={(color) => <Feather name="heart" size={20} color={color} />}
              accessibilityLabel={t("uikit.favorite")}
              onPress={() => {}}
            />
            <Button
              title=""
              variant="ghost"
              iconOnly
              leftIcon={(color) => <Feather name="settings" size={20} color={color} />}
              accessibilityLabel={t("uikit.settings")}
              onPress={() => {}}
            />
            <Button
              title={t("uikit.settings")}
              variant="chip"
              leftIcon={(color) => <Feather name="settings" size={16} color={color} />}
              iconGap={6}
              onPress={() => {}}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            {t("uikit.selectTitle")}
          </Text>
          <View style={[styles.sliderBlock, { marginBottom: 16 }]}>
            <Select
              label="Framework"
              description="Простой выбор из списка. Триггер с hover на ПК."
              value={selectValue}
              onChange={(v) => setSelectValue(v)}
              options={[
                { value: "a", label: "Option A" },
                { value: "b", label: "Option B" },
                { value: "c", label: "Option C" },
              ]}
              defaultValue="b"
              resetText={t("uikit.sliderReset")}
              placeholder={t("uikit.selectPlaceholder")}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            Filter dropdown
          </Text>
          <View style={styles.filterBlock}>
            <FilterDropdown
              value={period}
              onChange={setPeriod}
              options={periodOptions}
              keepOpen
              description="Фильтр с вложенным меню (период, свой диапазон дат)."
              trigger={({ open: isOpen, onPress }) => (
                <Button
                  title={t("uikit.filterButton")}
                  variant="ghost"
                  leftIcon={(c) => <Feather name="filter" size={16} color={c} />}
                  iconGap={6}
                  onPress={onPress}
                />
              )}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            {t("uikit.sliderTitle")}
          </Text>
          <View style={styles.sliderBlock}>
            <Slider
              label={t("uikit.sliderOpacity")}
              min={0}
              max={100}
              step={1}
              value={sliderValue}
              onChange={setSliderValue}
              unit="%"
              description="Прозрачность элемента. Сброс выключен (нет defaultValue)."
            />
            <Slider
              label={t("uikit.sliderVolume")}
              min={0}
              max={100}
              value={volumeValue}
              onChange={setVolumeValue}
              defaultValue={100}
              unit="%"
              resetText={t("uikit.sliderReset")}
              description="Громкость. Тап по значению в центре открывает ввод (на Android — над клавиатурой)."
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            {t("uikit.keyInputModalTitle")} ({t("uikit.keyInputModalOnlyAndroid")})
          </Text>
          <View style={styles.sliderBlock}>
            <Pressable
              onPress={() => {
                setKeyInputValue(String(volumeValue));
                setKeyInputVisible(true);
              }}
              style={[styles.keyInputTrigger, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.keyInputTriggerText, { color: colors.bg }]}>
                {t("uikit.keyInputModalOpenButton")}
              </Text>
            </Pressable>
            <KeyInputModal
              visible={keyInputVisible}
              onClose={() => setKeyInputVisible(false)}
              value={keyInputValue}
              onChangeText={setKeyInputValue}
              onSubmit={(val) => {
                const n = parseInt(val, 10);
                if (!Number.isNaN(n)) setVolumeValue(Math.min(100, Math.max(0, n)));
              }}
              label={t("uikit.sliderVolume")}
              keyboardType="numeric"
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            {t("uikit.toggleTitle")}
          </Text>
          <View style={styles.toggleBlock}>
            <Text style={[styles.categoryLabel, { color: colors.sub }]}>
              {t("uikit.toggleBasic")}
            </Text>
            <Toggle
              label={t("uikit.toggleEnableLabel")}
              value={featureEnabled}
              onValueChange={setFeatureEnabled}
              enabledText={t("uikit.toggleOn")}
              disabledText={t("uikit.toggleOff")}
              defaultValue={false}
              resetText={t("uikit.sliderReset")}
              description="Подсказка под переключателем. Сброс — по желанию (defaultValue)."
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            ViewToggle
          </Text>
          <View style={styles.toggleBlock}>
            <ViewToggle
              options={[
                {
                  value: "list",
                  label: "List",
                  icon: (c) => <Feather name="list" size={18} color={c} />,
                },
                {
                  value: "grid",
                  label: "Grid",
                  icon: (c) => <Feather name="grid" size={18} color={c} />,
                },
              ]}
              value={viewMode}
              onChange={(v) => setViewMode(v as "list" | "grid")}
              description="Режим отображения: список или сетка."
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            Graph
          </Text>
          <View style={[styles.sliderBlock, { marginBottom: 16 }]}>
            <GraphStorageBlock />
          </View>

          <Text style={[styles.placeholder, { color: colors.sub, marginTop: 24 }]}>
            {t("uikit.placeholder")}
          </Text>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontWeight: "700" },
  scroll: { flex: 1 },
  content: { paddingTop: 24, paddingBottom: 32 },
  toggleRow: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  paletteBlock: { marginBottom: 8 },
  buttonBlock: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    alignContent: "flex-start",
    gap: 12,
  },
  filterBlock: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  sliderBlock: {
    maxWidth: 400,
    gap: 16,
  },
  keyInputTrigger: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  keyInputTriggerText: {
    fontSize: 15,
    fontWeight: "600",
  },
  toggleBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: 600,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  typographyBlock: { marginTop: 4 },
  placeholder: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
  },
});
