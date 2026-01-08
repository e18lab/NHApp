import { useTheme } from "@/lib/ThemeContext";
import { AppLocale, useI18n } from "@/lib/i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface LanguageOption {
  code: AppLocale;
  label: string;
  flag?: string;
}

export default function LanguageSelector() {
  const { colors } = useTheme();
  const { t, available, locale, setLocale } = useI18n();
  const [modalVisible, setModalVisible] = useState(false);

  const currentOption = available.find((opt) => opt.code === locale);

  const handleSelect = (code: AppLocale) => {
    setLocale(code);
    setModalVisible(false);
  };

  return (
    <View>
      {/* Кнопка выбора */}
      <Pressable
        onPress={() => setModalVisible(true)}
        style={[
          styles.selectorButton,
          {
            backgroundColor: colors.page,
            borderColor: colors.accent + "40",
          },
        ]}
        android_ripple={{ color: colors.accent + "15", borderless: false }}
      >
        <View style={styles.selectorContent}>
          <View style={styles.selectorLeft}>
            <Text style={[styles.selectorLabel, { color: colors.sub }]}>
              {t("settings.language.current", {
                defaultValue: "Current",
              })}
            </Text>
            <Text style={[styles.selectorValue, { color: colors.txt }]}>
              {currentOption?.label || locale}
            </Text>
          </View>
          <Feather name="chevron-down" size={20} color={colors.accent} />
        </View>
      </Pressable>

      {/* Модальное окно выбора */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.page }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Заголовок модального окна */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.txt }]}>
                {t("settings.language.choose")}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.closeButton, { backgroundColor: colors.bg }]}
              >
                <Feather name="x" size={20} color={colors.txt} />
              </TouchableOpacity>
            </View>

            {/* Список языков */}
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {available.map((opt, index) => {
                const isSelected = locale === opt.code;
                return (
                  <Pressable
                    key={opt.code}
                    onPress={() => handleSelect(opt.code as AppLocale)}
                    style={[
                      styles.modalItem,
                      {
                        backgroundColor: isSelected
                          ? colors.accent + "20"
                          : "transparent",
                        borderBottomColor:
                          index < available.length - 1
                            ? colors.page + "60"
                            : "transparent",
                      },
                    ]}
                    android_ripple={{
                      color: colors.accent + "15",
                      borderless: false,
                    }}
                  >
                    <View style={styles.modalItemContent}>
                      <Text
                        style={[
                          styles.modalItemLabel,
                          {
                            color: isSelected ? colors.accent : colors.txt,
                            fontWeight: isSelected ? "700" : "600",
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Feather name="check" size={18} color={colors.accent} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Информационное сообщение */}
            <View
              style={[
                styles.modalNote,
                { backgroundColor: colors.accent + "08" },
              ]}
            >
              <Feather name="info" size={14} color={colors.accent} />
              <Text style={[styles.modalNoteText, { color: colors.sub }]}>
                {t("settings.language.note")}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  selectorButton: {
    borderRadius: 14,
    borderWidth: 2,
    overflow: "hidden",
  },
  selectorContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  selectorLeft: {
    flex: 1,
    gap: 4,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
    opacity: 0.7,
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalItem: {
    borderBottomWidth: 1,
  },
  modalItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalItemLabel: {
    fontSize: 16,
    letterSpacing: 0.2,
  },
  modalNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  modalNoteText: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.8,
    flex: 1,
  },
});
