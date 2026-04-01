import {
  collectLocalStorageForSync,
  fetchCloudStorage,
  pushCloudStorage,
} from "@/api/nhappApi/cloudStorage";
import HuePaletteSelector from "@/components/settings/HuePaletteSelector";
import { STORAGE_KEY_HUE, UIKIT_AS_HOME_KEY } from "@/components/settings/keys";
import SwitchRow from "@/components/settings/rows/SwitchRow";
import { BottomNavBar } from "@/components/uikit/BottomNavBar";
import { Button } from "@/components/uikit/Button";
import { SwipeableTabStrip } from "@/components/uikit/SwipeableTabStrip";
import type { SelectItem } from "@/components/uikit/FilterDropdown";
import { FilterDropdown } from "@/components/uikit/FilterDropdown";
import { Graph } from "@/components/uikit/Graph";
import { KeyInputModal } from "@/components/uikit/KeyInputModal";
import { Select } from "@/components/uikit/Select";
import { Slider } from "@/components/uikit/Slider";
import { Toggle } from "@/components/uikit/Toggle";
import { TypographySample } from "@/components/uikit/Typography";
import { ViewToggle } from "@/components/uikit/ViewToggle";
import { API_BASE_URL, API_BASE_URL_RAW } from "@/config/api";
import { useGraphStorageData } from "@/hooks/useGraphStorageData";
import { useOnlineMe } from "@/hooks/useOnlineMe";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { getDeviceId, getDeviceName } from "@/utils/deviceId";
import { Feather } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";

function DebugInfoBlock() {
  const { colors } = useTheme();
  const me = useOnlineMe();
  const [deviceId, setDeviceId] = useState<string>("…");
  const [deviceName, setDeviceName] = useState<string>("…");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    getDeviceName().then(setDeviceName);
  }, []);

  const onTestPull = useCallback(async () => {
    if (!me?.id) {
      setLastResult("Ошибка: не авторизован");
      return;
    }
    setLoading(true);
    setLastResult(null);
    try {
      const { storage_updated_at } = await fetchCloudStorage(me.id);
      setLastResult(`GET storage OK. storage_updated_at: ${storage_updated_at ?? "null"}`);
    } catch (e: any) {
      setLastResult(`GET ошибка: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [me?.id]);

  const onTestPush = useCallback(async () => {
    if (!me?.id) {
      setLastResult("Ошибка: не авторизован");
      return;
    }
    setLoading(true);
    setLastResult(null);
    try {
      const storage = await collectLocalStorageForSync();
      await pushCloudStorage(me.id, storage);
      const keys = Object.keys(storage).length;
      setLastResult(`PUT storage OK. Отправлено ключей: ${keys}`);
    } catch (e: any) {
      setLastResult(`PUT ошибка: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [me?.id]);

  return (
    <View style={[styles.debugBlock, { borderColor: colors.sub + "40", backgroundColor: colors.bg }]}>
      <Text selectable style={[styles.debugLine, { color: colors.sub }]}>
        API (.env): {API_BASE_URL_RAW || "(не задан)"}
      </Text>
      {API_BASE_URL !== API_BASE_URL_RAW && API_BASE_URL ? (
        <Text selectable style={[styles.debugLine, { color: colors.sub }]}>
          API (запросы): {API_BASE_URL}
        </Text>
      ) : null}
      <Text selectable style={[styles.debugLine, { color: colors.sub }]}>
        User: {me ? `${me.id} / ${me.username}` : "не авторизован"}
      </Text>
      <Text selectable style={[styles.debugLine, { color: colors.sub }]}>
        Device id: {deviceId}
      </Text>
      <Text selectable style={[styles.debugLine, { color: colors.sub }]}>
        Device name: {deviceName}
      </Text>
      {me ? (
        <View style={styles.debugButtons}>
          <Button
            variant="secondary"
            compact
            onPress={onTestPull}
            disabled={loading}
            title={loading ? "…" : "Проверить загрузку (GET)"}
          />
          <Button
            variant="secondary"
            compact
            onPress={onTestPush}
            disabled={loading}
            title={loading ? "…" : "Отправить хранилище (PUT)"}
          />
        </View>
      ) : null}
      {lastResult != null ? (
        <Text selectable style={[styles.debugResult, { color: colors.txt }]}>
          {lastResult}
        </Text>
      ) : null}
    </View>
  );
}

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
  const [bottomNavTab, setBottomNavTab] = useState<"manga" | "settings" | "profile">("manga");
  const [swipeableTabIndex, setSwipeableTabIndex] = useState(0);
  const [searchModeTabIndex, setSearchModeTabIndex] = useState(0);
  const [swipeableSearchMode, setSwipeableSearchMode] = useState(false);
  const [swipeableSearchQuery, setSwipeableSearchQuery] = useState("");
  const swipeableSearchInputRef = useRef<TextInput>(null);
  const { width: windowWidth } = useWindowDimensions();
  const slideWidth = Math.min(windowWidth || 400, 420);
  const mainLayerX = useRef(new Animated.Value(0)).current;
  const searchLayerX = useRef(new Animated.Value(400)).current;
  const mainContentX = useRef(new Animated.Value(0)).current;
  const mainContentOpacity = useRef(new Animated.Value(1)).current;
  const searchContentX = useRef(new Animated.Value(0)).current;
  const searchContentOpacity = useRef(new Animated.Value(1)).current;
  const searchSlot0X = useRef(new Animated.Value(0)).current;
  const searchSlot1X = useRef(new Animated.Value(420)).current;
  const prevMainTabRef = useRef<number | null>(null);
  const prevSearchTabRef = useRef<number | null>(null);
  const bottomNavContentX = useRef(new Animated.Value(0)).current;
  const bottomNavContentOpacity = useRef(new Animated.Value(1)).current;
  const prevBottomNavTabRef = useRef<"manga" | "settings" | "profile" | null>(null);
  const BOTTOM_NAV_ORDER: Array<"manga" | "settings" | "profile"> = ["manga", "settings", "profile"];
  const me = useOnlineMe();

  /** direction: 1 = переход вправо (к следующей вкладке), -1 = влево (к предыдущей) */
  const runCascadeOutIn = useCallback(
    (
      contentX: Animated.Value,
      contentOpacity: Animated.Value,
      fromX: number,
      direction: number
    ) => {
      const outX = direction > 0 ? -fromX : fromX;
      const inStartX = direction > 0 ? fromX : -fromX;
      Animated.parallel([
        Animated.timing(contentX, {
          toValue: outX,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        contentX.setValue(inStartX);
        contentOpacity.setValue(0);
        Animated.parallel([
          Animated.timing(contentX, {
            toValue: 0,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    []
  );

  const swipeableTabs = [
    { label: "Главная", icon: (c: string) => <Feather name="home" size={16} color={c} /> },
    { label: "Рекомендации", icon: (c: string) => <Feather name="star" size={16} color={c} /> },
    { label: "Скаченные", icon: (c: string) => <Feather name="download" size={16} color={c} /> },
    { label: "Лайкнутые", icon: (c: string) => <Feather name="heart" size={16} color={c} /> },
    { label: "История", icon: (c: string) => <Feather name="clock" size={16} color={c} /> },
    { label: "Персонажи", icon: (c: string) => <Feather name="users" size={16} color={c} /> },
  ];

  const searchModeTabs = [
    { label: t("search.recent"), icon: (c: string) => <Feather name="clock" size={16} color={c} /> },
    { label: t("menu.search"), icon: (c: string) => <Feather name="search" size={16} color={c} /> },
  ];

  const mockRecentSearches = ["манга", "теги", "автор"];

  useEffect(() => {
    const toSearch = swipeableSearchMode;
    const easing = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(mainLayerX, {
        toValue: toSearch ? -slideWidth : 0,
        duration: 280,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(searchLayerX, {
        toValue: toSearch ? 0 : slideWidth,
        duration: 280,
        easing,
        useNativeDriver: true,
      }),
    ]).start();
  }, [swipeableSearchMode, mainLayerX, searchLayerX, slideWidth]);

  const searchSlideDist = Math.max(slideWidth, 360);

  useEffect(() => {
    if (!swipeableSearchMode) return;
    const d = searchSlideDist;
    if (searchModeTabIndex === 0) {
      searchSlot0X.setValue(0);
      searchSlot1X.setValue(d);
    } else {
      searchSlot0X.setValue(-d);
      searchSlot1X.setValue(0);
    }
  }, [swipeableSearchMode, searchSlideDist]);

  useEffect(() => {
    if (prevMainTabRef.current !== null && prevMainTabRef.current !== swipeableTabIndex) {
      const dir = swipeableTabIndex > prevMainTabRef.current ? 1 : -1;
      runCascadeOutIn(mainContentX, mainContentOpacity, 36, dir);
    }
    prevMainTabRef.current = swipeableTabIndex;
  }, [swipeableTabIndex, mainContentX, mainContentOpacity, runCascadeOutIn]);

  useEffect(() => {
    const prev = prevSearchTabRef.current;
    prevSearchTabRef.current = searchModeTabIndex;
    if (prev === null || prev === searchModeTabIndex) return;
    const d = searchSlideDist;
    if (searchModeTabIndex === 1) {
      searchSlot1X.setValue(d);
      Animated.parallel([
        Animated.timing(searchSlot0X, { toValue: -d, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        Animated.timing(searchSlot1X, { toValue: 0, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      ]).start();
    } else {
      searchSlot0X.setValue(-d);
      Animated.parallel([
        Animated.timing(searchSlot0X, { toValue: 0, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        Animated.timing(searchSlot1X, { toValue: d, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      ]).start();
    }
  }, [searchModeTabIndex, searchSlot0X, searchSlot1X, searchSlideDist]);

  useEffect(() => {
    if (prevBottomNavTabRef.current !== null && prevBottomNavTabRef.current !== bottomNavTab) {
      const oldIdx = BOTTOM_NAV_ORDER.indexOf(prevBottomNavTabRef.current);
      const newIdx = BOTTOM_NAV_ORDER.indexOf(bottomNavTab);
      const dir = newIdx > oldIdx ? 1 : -1;
      runCascadeOutIn(bottomNavContentX, bottomNavContentOpacity, 36, dir);
    }
    prevBottomNavTabRef.current = bottomNavTab;
  }, [bottomNavTab, bottomNavContentX, bottomNavContentOpacity, runCascadeOutIn]);

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

  const onBottomNavChange = useCallback(
    (v: string) => {
      if (v === bottomNavTab) return;
      setBottomNavTab(v as "manga" | "settings" | "profile");
    },
    [bottomNavTab]
  );

  const bottomNavItems = [
    {
      value: "manga",
      label: "Манга",
      icon: (c: string) => <Feather name="book" size={22} color={c} />,
    },
    {
      value: "settings",
      label: "Настройки",
      icon: (c: string) => <Feather name="settings" size={22} color={c} />,
    },
    {
      value: "profile",
      label: "Профиль",
      icon: (c: string) =>
        me?.avatar_url ? (
          <Image
            source={{ uri: me.avatar_url }}
            style={styles.profileTabAvatar}
            accessibilityLabel="Аватар профиля"
          />
        ) : (
          <Feather name="user" size={22} color={c} />
        ),
    },
  ];

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
            SwipeableTabStrip (вкладки-пилюли)
          </Text>
          <Text style={[styles.bottomNavPlaceholder, { color: colors.sub, marginBottom: 8 }]}>
            Фокус в поле поиска переключает контент полосы; ввод — текстовый.
          </Text>
          <View style={[styles.bottomNavDemo, { backgroundColor: colors.page ?? colors.bg }]}>
            <Pressable
              onPress={() => swipeableSearchInputRef.current?.focus()}
              style={({ pressed, hovered }) => [
                styles.swipeableSearchBar,
                { backgroundColor: colors.searchBg ?? colors.bg + "80" },
                pressed && { opacity: 0.95 },
                Platform.OS === "web" && hovered && { opacity: 0.92 },
              ]}
            >
              <Feather name="search" size={18} color={colors.sub} style={styles.swipeableSearchBarIcon} />
              <TextInput
                ref={swipeableSearchInputRef}
                style={[styles.swipeableSearchBarInput, { color: colors.txt, backgroundColor: "transparent" }]}
                placeholder={t("search.placeholder")}
                placeholderTextColor={colors.sub}
                value={swipeableSearchQuery}
                onChangeText={setSwipeableSearchQuery}
                onFocus={() => setSwipeableSearchMode(true)}
                selectTextOnFocus={false}
              />
              {swipeableSearchMode ? (
                <Pressable
                  onPress={() => {
                    setSwipeableSearchQuery("");
                    setSwipeableSearchMode(false);
                    swipeableSearchInputRef.current?.blur();
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.swipeableSearchBarClear, pressed && { opacity: 0.7 }]}
                >
                  <Feather name="x" size={18} color={colors.sub} />
                </Pressable>
              ) : null}
            </Pressable>
            <View style={[styles.swipeableStage, { overflow: "hidden" }]}>
              <Animated.View
                style={[
                  styles.swipeableLayer,
                  { transform: [{ translateX: mainLayerX }] },
                ]}
                pointerEvents={swipeableSearchMode ? "none" : "auto"}
              >
                <SwipeableTabStrip
                  tabs={swipeableTabs}
                  selectedIndex={swipeableTabIndex}
                  onSelectIndex={setSwipeableTabIndex}
                />
                <View style={styles.swipeableContentWrap}>
                  <Animated.View
                    style={[
                      styles.swipeableContentInner,
                      {
                        transform: [{ translateX: mainContentX }],
                        opacity: mainContentOpacity,
                      },
                    ]}
                  >
                    <Text style={[styles.bottomNavPlaceholder, { color: colors.sub, marginTop: 8 }]}>
                      Выбрана: {swipeableTabs[swipeableTabIndex].label}. На ПК при наведении на полосу — скролл колёсиком влево/вправо.
                    </Text>
                  </Animated.View>
                </View>
              </Animated.View>
              <Animated.View
                style={[
                  styles.swipeableLayer,
                  { transform: [{ translateX: searchLayerX }] },
                ]}
                pointerEvents={swipeableSearchMode ? "auto" : "none"}
              >
                <SwipeableTabStrip
                  tabs={searchModeTabs}
                  selectedIndex={searchModeTabIndex}
                  onSelectIndex={setSearchModeTabIndex}
                />
                <View style={styles.swipeableContentWrap}>
                  <Animated.View
                    style={[
                      styles.swipeableContentInner,
                      styles.swipeableSearchSlot,
                      { transform: [{ translateX: searchSlot0X }] },
                    ]}
                    pointerEvents={searchModeTabIndex === 0 ? "auto" : "none"}
                  >
                    <View style={styles.searchModeContent}>
                      <Text style={[styles.searchModeHead, { color: colors.sub }]}>{t("search.recent")}</Text>
                      {mockRecentSearches.map((q) => (
                        <View key={q} style={styles.searchModeRow}>
                          <Feather name="clock" size={16} color={colors.sub} style={{ marginRight: 8 }} />
                          <Text style={[styles.searchModeRowTxt, { color: colors.txt }]}>{q}</Text>
                        </View>
                      ))}
                    </View>
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.swipeableContentInner,
                      styles.swipeableSearchSlot,
                      { transform: [{ translateX: searchSlot1X }] },
                    ]}
                    pointerEvents={searchModeTabIndex === 1 ? "auto" : "none"}
                  >
                    <View style={styles.searchModeSearchBody}>
                      <Feather name="search" size={32} color={colors.sub} />
                      <Text style={[styles.searchModeSearchTitle, { color: colors.txt }]}>{t("menu.search")}</Text>
                      <Text style={[styles.bottomNavPlaceholder, { color: colors.sub }]}>{t("search.placeholder")}</Text>
                    </View>
                  </Animated.View>
                </View>
              </Animated.View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            BottomNavBar (перелистывание страниц)
          </Text>
          <View style={[styles.bottomNavDemo, { backgroundColor: colors.page ?? colors.bg }]}>
            <View style={[styles.bottomNavContent, styles.bottomNavContentOverflow]}>
              <Animated.View
                style={[
                  styles.swipeableContentInner,
                  {
                    transform: [{ translateX: bottomNavContentX }],
                    opacity: bottomNavContentOpacity,
                  },
                ]}
              >
                {bottomNavTab === "manga" && (
                  <Text style={[styles.bottomNavPlaceholder, { color: colors.sub }]}>
                    Контент: Манга — каталог и рекомендации.
                  </Text>
                )}
                {bottomNavTab === "settings" && (
                  <Text style={[styles.bottomNavPlaceholder, { color: colors.sub }]}>
                    Контент: Настройки — тема, хранилище, учётная запись.
                  </Text>
                )}
                {bottomNavTab === "profile" && (
                  <Text style={[styles.bottomNavPlaceholder, { color: colors.sub }]}>
                    Контент: Профиль — избранное, история, библиотека.
                  </Text>
                )}
              </Animated.View>
            </View>
            <BottomNavBar
              items={bottomNavItems}
              value={bottomNavTab}
              onChange={onBottomNavChange}
              description="Нижняя панель навигации. Плавная анимация переключения и hover на Electron/ПК."
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            Graph
          </Text>
          <View style={[styles.sliderBlock, { marginBottom: 16 }]}>
            <GraphStorageBlock />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.txt, marginTop: 24 }]}>
            Debug Info
          </Text>
          <View style={[styles.sliderBlock, { marginBottom: 16 }]}>
            <DebugInfoBlock />
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
  debugBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    maxWidth: 520,
  },
  debugLine: {
    fontSize: 13,
    marginBottom: 6,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  debugHint: {
    fontSize: 11,
    marginBottom: 8,
    opacity: 0.85,
    fontStyle: "italic",
  },
  debugButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  debugResult: {
    fontSize: 13,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  typographyBlock: { marginTop: 4 },
  bottomNavDemo: {
    borderRadius: 20,
    padding: 16,
    paddingBottom: 8,
    maxWidth: 420,
    overflow: "hidden",
  },
  swipeableSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 25,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 24,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  swipeableSearchBarIcon: {
    marginRight: 12,
  },
  swipeableSearchBarInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  swipeableSearchBarClear: {
    padding: 4,
    marginLeft: 4,
  },
  swipeableStage: {
    position: "relative",
    height: 180,
  },
  swipeableLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  swipeableContentWrap: {
    flex: 1,
    paddingTop: 4,
    overflow: "hidden",
    position: "relative",
  },
  swipeableContentInner: {
    flex: 1,
  },
  swipeableSearchSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  bottomNavContent: {
    minHeight: 80,
    justifyContent: "center",
    paddingVertical: 12,
  },
  bottomNavContentOverflow: {
    overflow: "hidden",
  },
  profileTabAvatar: {
    width: 24,
    height: 24,
    borderRadius: 11,
  },
  bottomNavPlaceholder: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  searchModeContent: {
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  searchModeHead: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  searchModeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  searchModeRowTxt: {
    fontSize: 15,
  },
  searchModeSearchBody: {
    alignItems: "center",
    paddingVertical: 24,
  },
  searchModeSearchTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  placeholder: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
  },
});
