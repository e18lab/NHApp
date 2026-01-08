import { useI18n } from "@/lib/i18n/I18nContext";
import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import Card from "./Card";

type KV = { key: string; value: string };

type StorageChangeEvent =
  | { op: "set" | "remove"; key: string; value?: string }
  | { op: "clear" }
  | { op: "multi-set"; keys: string[] };

function broadcastChange(ev: StorageChangeEvent) {
  try {
    globalThis.dispatchEvent?.(
      new globalThis.CustomEvent("app-storage", { detail: ev })
    );
  } catch {}
  try {
    const arr = (globalThis as any).__onStorageChange;
    if (Array.isArray(arr)) arr.forEach((fn) => fn?.(ev));
    else if (typeof arr === "function") arr(ev);
  } catch {}
}

function ChipBtn({
  icon,
  label,
  onPress,
  bg,
  fg,
  border,
}: {
  icon: any;
  label: string;
  onPress?: () => void;
  bg: string;
  fg: string;
  border?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: bg, borderColor: border || "transparent" },
      ]}
      android_ripple={{ color: fg + "22", borderless: false }}
    >
      <Feather name={icon} size={14} color={fg} />
      <Text style={{ color: fg, fontWeight: "700", fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function StorageManager() {
  const { colors, setHue } = useTheme();
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<KV[]>([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [overrideExisting, setOverrideExisting] = useState(true);
  const [wipeBeforeImport, setWipeBeforeImport] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const mutableKeys = [...keys];
      mutableKeys.sort();
      const pairs = await AsyncStorage.multiGet(mutableKeys);
      setItems(pairs.map(([k, v]) => ({ key: k, value: v ?? "" })));
    } catch (e) {
      console.warn("StorageManager reload error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();

    const handler = () => reload();
    try {
      (globalThis as any).addEventListener?.("app-storage", handler);
    } catch {}
    const interval = setInterval(reload, 2500);

    return () => {
      try {
        (globalThis as any).removeEventListener?.("app-storage", handler);
      } catch {}
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.key.toLowerCase().includes(q) || i.value.toLowerCase().includes(q)
    );
  }, [items, query]);

  const totalSize = useMemo(
    () => items.reduce((a, i) => a + (i.key.length + i.value.length), 0),
    [items]
  );

  const applySideEffects = (k: string, v?: string) => {
    try {
      if (k === "themeHue" && typeof v === "string") {
        const n = Number(v);
        if (!Number.isNaN(n)) setHue?.(n);
      }
      if (k === "ui_fullscreen" && typeof v === "string") {
        const on = v === "1" || v.toLowerCase() === "true";
        (globalThis as any).__setFullscreen?.(on);
      }
      if (k === "reader_hide_hints" && typeof v === "string") {
        const on = v === "1" || v.toLowerCase() === "true";
        (globalThis as any).__setReaderHideHints?.(on);
      }
    } catch (e) {
      console.warn("[storage] side-effects failed for", k, e);
    }
  };

  const exportAll = async () => {
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        platform: Platform.OS,
        totalItems: items.length,
        totalBytes: totalSize,
      },
      data: Object.fromEntries(items.map((i) => [i.key, i.value])),
    };
    const json = JSON.stringify(payload, null, 2);
    const fileName = `storage-export-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

    try {
      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const uri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(uri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        try {
          await Sharing.shareAsync(uri, { mimeType: "application/json" });
        } catch {}
      }
    } catch (e) {
      Alert.alert(
        t("storageManager.export.title"),
        t("storageManager.export.failed", { error: String(e) })
      );
    }
  };

  const importFromFile = async () => {
    try {
      if (Platform.OS === "web") {
        Alert.alert(
          t("storageManager.import.title"),
          t("storageManager.import.webHint"),
          [{ text: t("common.ok") }]
        );
        return;
      }
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/json",
      });
      if (res.canceled || !res.assets?.[0]) return;
      const uri = res.assets[0].uri;
      const raw = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await importJson(raw);
    } catch (e) {
      Alert.alert(
        t("storageManager.import.title"),
        t("storageManager.import.error", { error: String(e) })
      );
    }
  };

  const importFromClipboard = async () => {
    try {
      const raw = await Clipboard.getStringAsync();
      if (!raw) {
        Alert.alert(
          t("storageManager.import.title"),
          t("storageManager.import.clipboardEmpty")
        );
        return;
      }
      await importJson(raw);
    } catch (e) {
      Alert.alert(
        t("storageManager.import.title"),
        t("storageManager.import.error", { error: String(e) })
      );
    }
  };

  const importJson = async (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      const data: Record<string, string> = parsed.data ?? parsed;

      if (wipeBeforeImport) {
        const ok = await confirmAsync(
          t("storageManager.confirm.wipeBeforeImport")
        );
        if (!ok) return;
        await AsyncStorage.clear();
        broadcastChange({ op: "clear" });
      }

      const entries = Object.entries(data);
      await AsyncStorage.multiSet(entries.map(([k, v]) => [k, String(v)]));

      for (const [k, v] of entries) {
        applySideEffects(k, String(v));
        broadcastChange({ op: "set", key: k, value: String(v) });
      }
      broadcastChange({ op: "multi-set", keys: entries.map(([k]) => k) });

      Alert.alert(
        t("storageManager.import.title"),
        t("storageManager.import.ok", { count: entries.length })
      );
      reload();
    } catch (e) {
      Alert.alert(
        t("storageManager.import.title"),
        t("storageManager.import.invalidJson", { error: String(e) })
      );
    }
  };

  const confirmAsync = (message: string) =>
    new Promise<boolean>((resolve) => {
      Alert.alert(t("storageManager.confirm.title"), message, [
        {
          text: t("common.cancel"),
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: t("common.yes"),
          style: "destructive",
          onPress: () => resolve(true),
        },
      ]);
    });

  const removeKey = async (k: string) => {
    const ok = await confirmAsync(
      t("storageManager.confirm.deleteKey", { key: k })
    );
    if (!ok) return;
    await AsyncStorage.removeItem(k);
    setItems((prev) => prev.filter((i) => i.key !== k));
    broadcastChange({ op: "remove", key: k });
  };

  const clearAll = async () => {
    const ok = await confirmAsync(t("storageManager.confirm.clearAll"));
    if (!ok) return;
    await AsyncStorage.clear();
    setItems([]);
    broadcastChange({ op: "clear" });
  };

  const openEdit = (k: string, v: string) => {
    setEditKey(k);
    setEditVal(v);
  };

  const saveEdit = async () => {
    if (editKey == null) return;
    await AsyncStorage.setItem(editKey, editVal);
    setItems((prev) =>
      prev.map((i) => (i.key === editKey ? { ...i, value: editVal } : i))
    );
    applySideEffects(editKey, editVal);
    broadcastChange({ op: "set", key: editKey, value: editVal });
    setEditKey(null);
  };

  const pretty = (v: string, max = 240) => {
    try {
      const obj = JSON.parse(v);
      v = JSON.stringify(obj, null, 2);
    } catch {}
    if (v.length > max) return v.slice(0, max) + "…";
    return v;
  };

  const kb = (totalSize / 1024).toFixed(1);

  return (
    <Card>
      <View style={styles.headerRow}>
        <View style={[styles.iconContainer, { backgroundColor: colors.accent + "15" }]}>
          <Feather name="database" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.txt }]}>
            {t("storageManager.title")}
          </Text>
          <Text style={[styles.meta, { color: colors.sub }]}>
            {t("storageManager.meta", { count: items.length, size: kb })}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.search,
          { borderColor: colors.page, backgroundColor: colors.searchBg },
        ]}
      >
        <Feather name="search" size={14} color={colors.searchTxt} />
        <TextInput
          placeholder={t("storageManager.searchPlaceholder")}
          placeholderTextColor={colors.sub}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: colors.searchTxt }]}
        />
        <Pressable
          onPress={reload}
          style={styles.iconBtn}
          android_ripple={{ color: colors.accent + "22" }}
        >
          <Feather
            name={loading ? "loader" : "refresh-ccw"}
            size={16}
            color={colors.searchTxt}
          />
        </Pressable>
      </View>

      <View style={styles.actionsRow}>
        <ChipBtn
          icon="download"
          label={t("storageManager.actions.export")}
          onPress={exportAll}
          bg={colors.tagBg}
          fg={colors.tagText}
          border={colors.page}
        />
        <ChipBtn
          icon="upload"
          label={t("storageManager.actions.importFile")}
          onPress={importFromFile}
          bg={colors.tagBg}
          fg={colors.tagText}
          border={colors.page}
        />
        <ChipBtn
          icon="clipboard"
          label={t("storageManager.actions.importClipboard")}
          onPress={importFromClipboard}
          bg={colors.tagBg}
          fg={colors.tagText}
          border={colors.page}
        />
        <ChipBtn
          icon="trash-2"
          label={t("storageManager.actions.clearAll")}
          onPress={clearAll}
          bg={"#ff585811"}
          fg={"#ff5858"}
          border={colors.page}
        />
      </View>

      <View className="import-opts" style={styles.importOpts}>
        <Pressable
          onPress={() => setOverrideExisting((v) => !v)}
          style={[styles.opt, { borderColor: colors.page }]}
        >
          <Feather
            name={overrideExisting ? "check-square" : "square"}
            size={14}
            color={colors.sub}
          />
          <Text style={{ color: colors.sub, fontSize: 12 }}>
            {t("storageManager.options.overwrite")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setWipeBeforeImport((v) => !v)}
          style={[styles.opt, { borderColor: colors.page }]}
        >
          <Feather
            name={wipeBeforeImport ? "check-square" : "square"}
            size={14}
            color={colors.sub}
          />
          <Text style={{ color: colors.sub, fontSize: 12 }}>
            {t("storageManager.options.wipeBeforeImport")}
          </Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 8 }}>
        {filtered.map((it) => {
          const isOpen = !!expanded[it.key];
          return (
            <View
              key={it.key}
              style={[
                styles.item,
                { borderColor: colors.page, backgroundColor: colors.bg },
              ]}
            >
              <Pressable
                onPress={() =>
                  setExpanded((m) => ({ ...m, [it.key]: !isOpen }))
                }
                style={styles.itemHead}
                android_ripple={{ color: colors.accent + "12" }}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.k, { color: colors.txt }]}
                >
                  {it.key}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.sub, fontSize: 12 }}
                  >
                    {(it.value?.length || 0) + t("storageManager.bytesSuffix")}
                  </Text>
                  <Feather
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.sub}
                  />
                </View>
              </Pressable>

              {isOpen && (
                <View style={styles.itemBody}>
                  <ScrollView
                    horizontal
                    contentContainerStyle={{ flexGrow: 1 }}
                  >
                    <Text
                      selectable
                      style={[
                        styles.v,
                        {
                          color: colors.tagText,
                          backgroundColor: colors.tagBg,
                        },
                      ]}
                    >
                      {pretty(it.value)}
                    </Text>
                  </ScrollView>
                  <View style={styles.itemActions}>
                    <ChipBtn
                      icon="edit"
                      label={t("storageManager.actions.edit")}
                      onPress={() => openEdit(it.key, it.value)}
                      bg={colors.incBg}
                      fg={colors.incTxt}
                    />
                    <ChipBtn
                      icon="copy"
                      label={t("storageManager.actions.copy")}
                      onPress={() => Clipboard.setStringAsync(it.value)}
                      bg={colors.tagBg}
                      fg={colors.tagText}
                      border={colors.page}
                    />
                    <ChipBtn
                      icon="trash-2"
                      label={t("storageManager.actions.delete")}
                      onPress={() => removeKey(it.key)}
                      bg={"#ff585811"}
                      fg={"#ff5858"}
                      border={colors.page}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}
        {!filtered.length && (
          <Text
            style={{
              color: colors.sub,
              fontSize: 12,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            {t("storageManager.noMatches")}
          </Text>
        )}
      </View>

      <Modal
        statusBarTranslucent
        animationType="slide"
        visible={editKey != null}
        onRequestClose={() => setEditKey(null)}
      >
        <View style={[styles.modal, { backgroundColor: colors.bg }]}>
          <View style={styles.modalTop}>
            <Text style={[styles.modalTitle, { color: colors.txt }]}>
              {t("storageManager.modal.editTitle")}
            </Text>
            <Text style={{ color: colors.sub, fontSize: 12 }}>{editKey}</Text>
          </View>
          <TextInput
            value={editVal}
            onChangeText={setEditVal}
            placeholder={t("storageManager.modal.valuePlaceholder")}
            placeholderTextColor={colors.sub}
            style={[
              styles.input,
              {
                color: colors.txt,
                borderColor: colors.page,
                backgroundColor: colors.searchBg,
              },
            ]}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
          />
          <View style={styles.modalBtns}>
            <ChipBtn
              icon="save"
              label={t("common.save")}
              onPress={saveEdit}
              bg={colors.accent}
              fg={colors.bg}
            />
            <ChipBtn
              icon="x"
              label={t("common.cancel")}
              onPress={() => setEditKey(null)}
              bg={colors.tagBg}
              fg={colors.tagText}
              border={colors.page}
            />
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { 
    fontSize: 17, 
    fontWeight: "800", 
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  meta: { 
    fontSize: 12,
    marginTop: 2,
    opacity: 0.75,
  },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 2 },
  iconBtn: { padding: 6, borderRadius: 8, overflow: "hidden" },

  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  importOpts: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },

  item: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    overflow: "hidden",
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  k: { fontSize: 13, fontWeight: "700", flex: 1, marginRight: 8 },
  itemBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  v: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 12,
    padding: 8,
    borderRadius: 8,
    minWidth: 200,
  },
  itemActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  modal: { flex: 1, padding: 16 },
  modalTop: { marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    minHeight: 180,
  },
  modalBtns: { flexDirection: "row", gap: 8, marginTop: 12 },
});
