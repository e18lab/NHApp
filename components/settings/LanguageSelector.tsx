import { isElectron } from "@/electron/bridge";
import { useTheme } from "@/lib/ThemeContext";
import { AppLocale, useI18n } from "@/lib/i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
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
  const { width } = useWindowDimensions();
  const isDesktop = isElectron() || (Platform.OS === "web" && width >= 768);
  const isTablet = width >= 600 && width < 768;
  const [modalVisible, setModalVisible] = useState(false);

  const currentOption = available.find((opt) => opt.code === locale);

  const handleSelect = (code: AppLocale) => {
    setLocale(code);
    setModalVisible(false);
  };

  return (
    <View>
      {}
      <Pressable
        onPress={() => setModalVisible(true)}
        style={[
          styles.selectorButton,
          isDesktop && styles.selectorButtonDesktop,
          isTablet && styles.selectorButtonTablet,
          {
            backgroundColor: colors.page,
            borderColor: colors.accent + "40",
          },
        ]}
        android_ripple={{ color: colors.accent + "15", borderless: false }}
      >
        <View style={[
          styles.selectorContent,
          isDesktop && styles.selectorContentDesktop,
          isTablet && styles.selectorContentTablet,
        ]}>
          <View style={styles.selectorLeft}>
            <Text style={[
              styles.selectorLabel,
              isDesktop && styles.selectorLabelDesktop,
              isTablet && styles.selectorLabelTablet,
              { color: colors.sub }
            ]}>
              {t("settings.language.current", {
                defaultValue: "Current",
              })}
            </Text>
            <Text style={[
              styles.selectorValue,
              isDesktop && styles.selectorValueDesktop,
              isTablet && styles.selectorValueTablet,
              { color: colors.txt }
            ]}>
              {currentOption?.label || locale}
            </Text>
          </View>
          <Feather 
            name="chevron-down" 
            size={isDesktop ? 22 : isTablet ? 21 : 20} 
            color={colors.accent} 
          />
        </View>
      </Pressable>

      {}
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
            style={[
              styles.modalContent,
              isDesktop && styles.modalContentDesktop,
              isTablet && styles.modalContentTablet,
              { backgroundColor: colors.page }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {}
            <View style={[
              styles.modalHeader,
              isDesktop && styles.modalHeaderDesktop,
              isTablet && styles.modalHeaderTablet,
            ]}>
              <Text style={[
                styles.modalTitle,
                isDesktop && styles.modalTitleDesktop,
                isTablet && styles.modalTitleTablet,
                { color: colors.txt }
              ]}>
                {t("settings.language.choose")}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[
                  styles.closeButton,
                  isDesktop && styles.closeButtonDesktop,
                  isTablet && styles.closeButtonTablet,
                  { backgroundColor: colors.bg }
                ]}
              >
                <Feather 
                  name="x" 
                  size={isDesktop ? 22 : isTablet ? 21 : 20} 
                  color={colors.txt} 
                />
              </TouchableOpacity>
            </View>

            {}
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
                    <View style={[
                      styles.modalItemContent,
                      isDesktop && styles.modalItemContentDesktop,
                      isTablet && styles.modalItemContentTablet,
                    ]}>
                      <Text
                        style={[
                          styles.modalItemLabel,
                          isDesktop && styles.modalItemLabelDesktop,
                          isTablet && styles.modalItemLabelTablet,
                          {
                            color: isSelected ? colors.accent : colors.txt,
                            fontWeight: isSelected ? "700" : "600",
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Feather 
                          name="check" 
                          size={isDesktop ? 20 : isTablet ? 19 : 18} 
                          color={colors.accent} 
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {}
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
  selectorButtonDesktop: {
    borderRadius: 16,
    borderWidth: 2.5,
  },
  selectorButtonTablet: {
    borderRadius: 15,
    borderWidth: 2.25,
  },
  selectorContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  selectorContentDesktop: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  selectorContentTablet: {
    paddingHorizontal: 18,
    paddingVertical: 18,
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
  selectorLabelDesktop: {
    fontSize: 13,
    letterSpacing: 0.3,
  },
  selectorLabelTablet: {
    fontSize: 12.5,
    letterSpacing: 0.25,
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  selectorValueDesktop: {
    fontSize: 18,
    letterSpacing: 0.3,
  },
  selectorValueTablet: {
    fontSize: 17,
    letterSpacing: 0.25,
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
  modalContentDesktop: {
    maxWidth: 500,
    borderRadius: 24,
  },
  modalContentTablet: {
    maxWidth: 450,
    borderRadius: 22,
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
  modalHeaderDesktop: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  modalHeaderTablet: {
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  modalTitleDesktop: {
    fontSize: 20,
    letterSpacing: 0.4,
  },
  modalTitleTablet: {
    fontSize: 19,
    letterSpacing: 0.35,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonDesktop: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  closeButtonTablet: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  modalItemContentDesktop: {
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  modalItemContentTablet: {
    paddingHorizontal: 22,
    paddingVertical: 17,
  },
  modalItemLabel: {
    fontSize: 16,
    letterSpacing: 0.2,
  },
  modalItemLabelDesktop: {
    fontSize: 18,
    letterSpacing: 0.3,
  },
  modalItemLabelTablet: {
    fontSize: 17,
    letterSpacing: 0.25,
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
