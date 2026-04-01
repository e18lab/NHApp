import { Rect } from "@/api/nhappApi/characterCards";
import type { Book } from "@/api/nhappApi/types";
import CharacterCropModal from "@/components/CharacterCropModal";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import ExpoImage from "@/components/ExpoImageCompat";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type CharacterTag = {
  creatorUserId?: number | null;
  creatorName?: string | null;
  creatorAvatar?: string | null;
  cardImageUrl?: string | null;
  cardRect?: Rect | null;
  name: string;
  cardId?: number | null;
};

type EditCharacterCardModalProps = {
  visible: boolean;
  tag: CharacterTag | null;
  parodyName: string | null;
  bookId: number | null;

  name: string;
  setName: (v: string) => void;
  parody: string;
  setParody: (v: string) => void;

  saving: boolean;
  error: string | null;
  canDelete: boolean;

  onCancel: () => void;
  onSave: (newRect?: Rect) => void;
  onDelete: () => void;
};

const { width: winWidth } = Dimensions.get("window");

const EditCharacterCardModal: React.FC<EditCharacterCardModalProps> = ({
  visible,
  tag,
  parodyName,
  bookId,
  name,
  setName,
  parody,
  setParody,
  saving,
  error,
  canDelete,
  onCancel,
  onSave,
  onDelete,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [currentRect, setCurrentRect] = useState<Rect | null>(
    tag?.cardRect ?? null
  );
  const [bookInfo, setBookInfo] = useState<Book | null>(null);
  const [thumbSize, setThumbSize] = useState({ width: 5000, height: 5000 });

  const characterOptions = bookInfo?.characters ?? [];
  const parodyOptions = bookInfo?.parodies ?? [];

  useEffect(() => {
    if (!visible) return;
    setCurrentRect(tag?.cardRect ?? null);
  }, [visible, tag]);

  useEffect(() => {
    if (!visible || !bookId) {
      setBookInfo(null);
      return;
    }

    let cancelled = false;
    const loadBook = async () => {
      try {
        const { getGallery } = await import("@/api/v2/galleries");
        const { galleryToBook } = await import("@/api/v2/compat");
        const book = galleryToBook(await getGallery(bookId));
        if (!cancelled) setBookInfo(book);
      } catch (err) {
        console.warn("Unable to download the book:", err);
        if (!cancelled) setBookInfo(null);
      }
    };

    loadBook();
    return () => {
      cancelled = true;
    };
  }, [visible, bookId]);

  const renderCroppedPreview = () => {
    if (!tag?.cardImageUrl || !currentRect) return null;

    let imageStyle: any = { width: "100%", height: "100%" };

    if (thumbSize.width > 0 && thumbSize.height > 0) {
      const r = currentRect;
      const displayWidth = thumbSize.width / r.width;
      const displayHeight = thumbSize.height / r.height;
      const offsetX = -r.x * displayWidth;
      const offsetY = -r.y * displayHeight;

      imageStyle = {
        width: displayWidth,
        height: displayHeight,
        position: "absolute",
        left: offsetX,
        top: offsetY,
      };
    }

    return (
      <View style={styles.previewWrapper}>
        <View
          style={styles.croppedPreviewContainer}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width !== thumbSize.width || height !== thumbSize.height) {
              setThumbSize({ width, height });
            }
          }}
        >
          <ExpoImage
            source={{ uri: tag.cardImageUrl }}
            style={imageStyle}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>

        <Pressable
          style={[styles.editCropButton, { backgroundColor: colors.accent }]}
          onPress={() => setCropModalVisible(true)}
        >
          <Feather name="edit-3" size={16} color={colors.bg} />
          <Text style={[styles.editCropText, { color: colors.bg }]}>
            {t("editCard.editArea")}
          </Text>
        </Pressable>
      </View>
    );
  };

  if (!visible || !tag) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
        statusBarTranslucent
        transparent
        onRequestClose={onCancel}
      >
        <View style={styles.backdrop}>
          <View style={[styles.modal, { backgroundColor: colors.page }]}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.title, { color: colors.title }]}>
                {t("editCard.title")}
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
                  {t("editCard.warningTitle")}
                </Text>
                <Text style={styles.warningText}>
                  {t("editCard.warningText")}
                </Text>
              </View>

              {renderCroppedPreview()}

              <Text style={[styles.label, { color: colors.metaText }]}>
                {t("editCard.labelCharacter")}
              </Text>
              <View
                style={[
                  styles.pickerContainer,
                  { borderColor: colors.tagBg + "80" },
                ]}
              >
                <Picker
                  selectedValue={name}
                  onValueChange={(val) => setName(String(val))}
                >
                  <Picker.Item
                    label={
                      name || t("charSelect.placeholderCharacter")
                    }
                    value={name || ""}
                    color={name ? colors.txt : colors.sub}
                  />

                  {characterOptions
                    .filter((c) => c.name !== name)
                    .map((c) => (
                      <Picker.Item key={c.id} label={c.name} value={c.name} />
                    ))}
                </Picker>
              </View>

              <Text
                style={[
                  styles.label,
                  { color: colors.metaText, marginTop: 16 },
                ]}
              >
                {t("editCard.labelParody")}
              </Text>
              <View
                style={[
                  styles.pickerContainer,
                  { borderColor: colors.tagBg + "80" },
                ]}
              >
                <Picker
                  selectedValue={parody}
                  onValueChange={(val) => setParody(String(val))}
                >
                  <Picker.Item
                    label={parody || t("charSelect.parodyNone")}
                    value={parody || ""}
                    color={parody ? colors.txt : colors.sub}
                  />

                  {parodyOptions
                    .filter((p) => p.name !== parody)
                    .map((p) => (
                      <Picker.Item key={p.id} label={p.name} value={p.name} />
                    ))}
                </Picker>
              </View>

              <View
                style={[
                  styles.creatorBox,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.related,
                  },
                ]}
              >
                <Text style={[styles.creatorTitle, { color: colors.title }]}>
                  {t("editCard.cardAuthor")}
                </Text>

                <View style={styles.creatorRow}>
                  {tag.creatorAvatar ? (
                    <ExpoImage
                      source={{ uri: tag.creatorAvatar }}
                      style={styles.creatorAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.creatorAvatar,
                        { backgroundColor: colors.tagBg },
                      ]}
                    >
                      <Feather name="user" size={20} color={colors.metaText} />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.creatorName, { color: colors.txt }]}
                      numberOfLines={1}
                    >
                      {tag.creatorName ||
                        (tag.creatorUserId
                          ? `User #${tag.creatorUserId}`
                          : t("editCard.noName"))}
                    </Text>

                    {tag.creatorUserId && (
                      <Text
                        style={[
                          styles.creatorSource,
                          { color: colors.metaText },
                        ]}
                      >
                        ID: {tag.creatorUserId}
                      </Text>
                    )}
                  </View>
                </View>

                {bookId && (
                  <Pressable
                    style={[
                      styles.openBookBtn,
                      { backgroundColor: colors.accent },
                    ]}
                    onPress={() => router.push(`/book/${bookId}`)}
                  >
                    <Feather name="book-open" size={16} color={colors.bg} />
                    <Text
                      style={[styles.openBookText, { color: colors.bg }]}
                    >
                      {t("editCard.openBook")}
                    </Text>
                  </Pressable>
                )}
              </View>

              {error && (
                <Text style={[styles.errorText, { color: "#ff6b6b" }]}>
                  {error}
                </Text>
              )}

              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.button, { backgroundColor: colors.tagBg }]}
                  onPress={onCancel}
                  disabled={saving}
                >
                  <Text style={[styles.buttonText, { color: colors.tagText }]}>
                    {t("editCard.cancel")}
                  </Text>
                </Pressable>

                {canDelete && (
                  <Pressable
                    style={[styles.button, styles.deleteButton]}
                    onPress={onDelete}
                    disabled={saving}
                  >
                    <Feather name="trash-2" size={16} color="#fff" />
                    <Text style={styles.deleteText}>
                      {t("editCard.delete")}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={[styles.button, { backgroundColor: colors.accent }]}
                  onPress={() => onSave(currentRect ?? undefined)}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.bg} />
                  ) : (
                    <Text style={[styles.buttonText, { color: colors.bg }]}>
                      {t("editCard.save")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {tag?.cardImageUrl && (
        <CharacterCropModal
          visible={cropModalVisible}
          imageUri={tag.cardImageUrl}
          onCancel={() => setCropModalVisible(false)}
          onConfirm={(newRect) => {
            setCurrentRect(newRect);
            setCropModalVisible(false);
          }}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
  },
  modal: {
    width: winWidth > 600 ? "70%" : "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderRadius: 16,
    borderBottomLeftRadius: winWidth > 600 ? 16 : 0,
    borderBottomRightRadius: winWidth > 600 ? 16 : 0,
    maxHeight: "92%",
    overflow: "hidden",
  },
  scrollContent: { padding: 20, paddingBottom: 30 },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  warningBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  warningTitle: {
    color: "#ffb3b3",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  warningText: { color: "#ffdede", fontSize: 12, lineHeight: 16 },
  previewWrapper: { alignItems: "center", marginBottom: 20 },
  croppedPreviewContainer: {
    width: 140,
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 12,
  },
  editCropButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 8,
  },
  editCropText: { fontSize: 13, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  creatorBox: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1 },
  creatorTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  creatorRow: { flexDirection: "row", alignItems: "center" },
  creatorAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  creatorName: { fontSize: 15, fontWeight: "600" },
  creatorSource: { fontSize: 11, marginTop: 4 },
  openBookBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  openBookText: {
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: { marginTop: 12, fontSize: 13, textAlign: "center" },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 12,
    flexWrap: "wrap",
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 100,
    justifyContent: "center",
  },
  buttonText: { fontSize: 14, fontWeight: "600" },
  deleteButton: { backgroundColor: "#ff4757" },
  deleteText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

export default EditCharacterCardModal;
