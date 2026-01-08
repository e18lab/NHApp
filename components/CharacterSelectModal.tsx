import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Picker } from "@react-native-picker/picker";
import ExpoImage from "@/components/ExpoImageCompat";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export interface CharacterSelectModalProps {
  visible: boolean;
  characters: string[];
  parodies: string[];
  onCancel: () => void;
  onConfirm: (characterName: string, parodyName: string | null) => void;

  currentUserId: number | null;
  currentUsername: string | null;
}

export const CharacterSelectModal: React.FC<CharacterSelectModalProps> = ({
  visible,
  characters,
  parodies,
  onCancel,
  onConfirm,
  currentUserId,
  currentUsername,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();

  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [selectedParody, setSelectedParody] = useState<string>("none");
  const [customParodyName, setCustomParodyName] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedCharacter("");
      setSelectedParody("none");
      setCustomParodyName("");
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = () => {
    if (!selectedCharacter) {
      setError(t("charSelect.errorChooseCharacter"));
      return;
    }

    setSubmitting(true);
    setError(null);

    let parody: string | null = null;

    if (selectedParody === "custom") {
      const trimmed = customParodyName.trim();
      parody = trimmed.length > 0 ? trimmed : null;
    } else if (selectedParody && selectedParody !== "none") {
      parody = selectedParody;
    }

    onConfirm(selectedCharacter, parody);
  };

  const hasParodies = parodies && parodies.length > 0;

  const effectiveParody = (() => {
    if (selectedParody === "custom") {
      const trimmed = customParodyName.trim();
      return trimmed.length > 0
        ? trimmed
        : t("charSelect.parodyOwnEmpty");
    }
    if (selectedParody && selectedParody !== "none") return selectedParody;
    return t("charSelect.parodyNotSpecified");
  })();

  const avatarUri =
    typeof currentUserId === "number" && currentUserId > 0
      ? `https://i1.nhentai.net/avatars/${currentUserId}.png`
      : null;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={[styles.modal, { backgroundColor: colors.page }]}>
          <Text style={[styles.title, { color: colors.title }]}>
            {t("charSelect.title")}
          </Text>

          <View
            style={[
              styles.warningBox,
              {
                backgroundColor: colors.newBadgeBg + "25",
                borderColor: colors.newBadgeBg + "55",
              },
            ]}
          >
            <Text style={styles.warningTitle}>
              {t("charSelect.warningTitle")}
            </Text>
            <Text style={styles.warningText}>
              {t("charSelect.warningText")}
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.metaText }]}>
            {t("charSelect.labelCharacter")}
          </Text>
          <View
            style={[
              styles.pickerContainer,
              { borderColor: colors.tagBg + "80" },
            ]}
          >
            <Picker
              selectedValue={selectedCharacter}
              onValueChange={(itemValue) => setSelectedCharacter(itemValue)}
              style={[styles.picker, { color: colors.txt }]}
              dropdownIconColor={colors.txt}
            >
              <Picker.Item
                label={t("charSelect.placeholderCharacter")}
                value=""
              />
              {characters.map((char) => (
                <Picker.Item key={char} label={char} value={char} />
              ))}
            </Picker>
          </View>

          <Text style={[styles.label, { color: colors.metaText }]}>
            {t("charSelect.labelParody")}
          </Text>
          <View
            style={[
              styles.pickerContainer,
              { borderColor: colors.tagBg + "80" },
            ]}
          >
            <Picker
              selectedValue={selectedParody}
              onValueChange={(itemValue) => setSelectedParody(itemValue)}
              style={[styles.picker, { color: colors.txt }]}
              dropdownIconColor={colors.txt}
            >
              <Picker.Item label={t("charSelect.parodyNone")} value="none" />
              {hasParodies &&
                parodies.map((parody) => (
                  <Picker.Item key={parody} label={parody} value={parody} />
                ))}
              <Picker.Item
                label={t("charSelect.parodyCustom")}
                value="custom"
              />
            </Picker>
          </View>

          {selectedParody === "custom" && (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.searchBg,
                  color: colors.searchTxt,
                  borderColor: colors.accent,
                  marginTop: 8,
                },
              ]}
              placeholder={t("charSelect.parodyPlaceholder")}
              placeholderTextColor={colors.sub}
              value={customParodyName}
              onChangeText={setCustomParodyName}
            />
          )}

          <View
            style={[
              styles.summaryBox,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.related,
              },
            ]}
          >
            <Text style={[styles.summaryTitle, { color: colors.title }]}>
              {t("charSelect.summaryTitle")}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.sub }]}>
              {t("charSelect.summaryCharacter")}:{" "}
              <Text style={[styles.summaryValue, { color: colors.txt }]}>
                {selectedCharacter || t("charSelect.notSelected")}
              </Text>
            </Text>
            <Text style={[styles.summaryLine, { color: colors.sub }]}>
              {t("charSelect.summaryParody")}:{" "}
              <Text style={[styles.summaryValue, { color: colors.txt }]}>
                {effectiveParody}
              </Text>
            </Text>
            <Text style={[styles.summaryHint, { color: colors.metaText }]}>
              {t("charSelect.summaryHint")}
            </Text>
          </View>

          {(avatarUri || currentUsername || currentUserId) && (
            <View
              style={[
                styles.profileBox,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.related,
                },
              ]}
            >
              <Text style={[styles.profileTitle, { color: colors.title }]}>
                {t("charSelect.profileTitle")}
              </Text>
              <View style={styles.profileRow}>
                {avatarUri && (
                  <ExpoImage
                    source={{ uri: avatarUri }}
                    style={styles.avatar}
                    contentFit="cover"
                    cachePolicy="none"
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.profileName, { color: colors.txt }]}>
                    {currentUsername?.trim() || t("charSelect.profileNoname")}
                  </Text>
                  {currentUserId && (
                    <Text
                      style={[styles.profileId, { color: colors.metaText }]}
                    >
                      ID: {currentUserId}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {error && (
            <Text style={[styles.error, { color: "#ff6b6b" }]}>{error}</Text>
          )}

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.button, { backgroundColor: colors.tagBg }]}
              onPress={onCancel}
              disabled={submitting}
            >
              <Text style={[styles.buttonText, { color: colors.tagText }]}>
                {t("charSelect.cancel")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: colors.accent }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.bg }]}>
                  {t("charSelect.save")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "90%",
    maxHeight: "90%",
    borderRadius: 16,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  warningBox: {
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  warningTitle: {
    color: "#ffb3b3",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  warningText: {
    color: "#ffdede",
    fontSize: 12,
  },
  label: {
    fontSize: 13,
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "600",
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  picker: {
    height: 50,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1.5,
  },
  summaryBox: {
    marginTop: 16,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  summaryLine: {
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    fontWeight: "600",
  },
  summaryHint: {
    marginTop: 6,
    fontSize: 11,
  },
  profileBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  profileName: {
    fontSize: 14,
    fontWeight: "600",
  },
  profileId: {
    fontSize: 12,
    marginTop: 2,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    textAlign: "center",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
    gap: 10,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default CharacterSelectModal;
