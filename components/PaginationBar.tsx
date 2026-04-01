import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import { scrollToTop } from "@/utils/scrollToTop";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

type Props = {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
  onRequestScrollTop?: () => void;
  scrollRef?: React.RefObject<any> | null;
  hideWhenInfiniteScroll?: boolean;
};

export default function PaginationBar({
  currentPage,
  totalPages,
  onChange,
  onRequestScrollTop,
  scrollRef,
  hideWhenInfiniteScroll = false,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const [visible, setVisible] = useState(false);
  const [sliderPage, setSliderPage] = useState(currentPage);

  const scale = useMemo(() => new Animated.Value(1), []);
  const sheetY = useRef(new Animated.Value(0)).current;

  if (totalPages <= 1) return null;
  if (hideWhenInfiniteScroll) return null;

  const animateTap = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true }).start();

  const commit = (next: number) => {
    const page = Math.max(1, Math.min(totalPages, Math.round(next)));
    if (page === currentPage) return;
    scrollToTop(scrollRef);
    onRequestScrollTop?.();
    onChange(page);
  };

  const openSheet = () => {
    setSliderPage(currentPage);
    setVisible(true);
    Animated.timing(sheetY, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Keyboard.dismiss();
    Animated.timing(sheetY, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => finished && setVisible(false));
  };

  const jump = (delta: number) => {
    const next = Math.max(1, Math.min(totalPages, sliderPage + delta));
    setSliderPage(next);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const translateY = sheetY.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <>
      <View
        style={[
          styles.bar,
          { backgroundColor: colors.menuBg, borderColor: colors.sub + "30" },
        ]}
      >
        <TouchableOpacity
          onPressIn={() => currentPage > 1 && animateTap(0.95)}
          onPressOut={() => animateTap(1)}
          onPress={() => currentPage > 1 && commit(currentPage - 1)}
          onLongPress={() => currentPage > 1 && commit(currentPage - 10)}
          delayLongPress={320}
          disabled={currentPage === 1}
          style={styles.iconBtn}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={currentPage === 1 ? colors.sub : colors.menuTxt}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={openSheet} style={styles.center}>
          <Animated.View style={[styles.pill, { transform: [{ scale }] }]}>
            <Text style={[styles.pillTxt, { color: colors.menuTxt }]}>
              {currentPage} / {totalPages}
            </Text>
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity
          onPressIn={() => currentPage < totalPages && animateTap(0.95)}
          onPressOut={() => animateTap(1)}
          onPress={() => currentPage < totalPages && commit(currentPage + 1)}
          onLongPress={() =>
            currentPage < totalPages && commit(currentPage + 10)
          }
          delayLongPress={320}
          disabled={currentPage === totalPages}
          style={styles.iconBtn}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={currentPage === totalPages ? colors.sub : colors.menuTxt}
          />
        </TouchableOpacity>
      </View>

      <Modal
        visible={visible}
        statusBarTranslucent
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.page,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.sub }]} />
          </View>

          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => setSliderPage(1)}
              style={[
                styles.roundBtn,
                { backgroundColor: colors.menuBg + "00" },
              ]}
            >
              <Ionicons name="play-skip-back" size={22} color={colors.txt} />
            </TouchableOpacity>

            <Text style={[styles.title, { color: colors.txt }]}>
              {t("reader.pagination.goToPage") || "Перейти к странице"}
            </Text>

            <TouchableOpacity
              onPress={() => setSliderPage(totalPages)}
              style={[
                styles.roundBtn,
                { backgroundColor: colors.menuBg + "00" },
              ]}
            >
              <Ionicons name="play-skip-forward" size={22} color={colors.txt} />
            </TouchableOpacity>
          </View>

          <View style={styles.valueRow}>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.sub + "50",
                  backgroundColor: colors.page,
                  color: colors.txt,
                },
              ]}
              keyboardType="number-pad"
              returnKeyType="done"
              value={String(sliderPage)}
              onChangeText={(tStr) => {
                const n = parseInt(tStr.replace(/[^\d]/g, ""), 10);
                if (!Number.isFinite(n)) return setSliderPage(1);
                setSliderPage(Math.max(1, Math.min(totalPages, n)));
              }}
              onSubmitEditing={() => commit(sliderPage)}
            />
            <Text style={[styles.totalTxt, { color: colors.sub }]}>
              / {totalPages}
            </Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={totalPages}
            step={1}
            value={sliderPage}
            onValueChange={setSliderPage}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.sub + "50"}
            thumbTintColor={colors.accent}
          />

          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.jumpBtn, { borderColor: colors.sub + "50" }]}
              onPress={() => jump(-5)}
            >
              <Text style={[styles.jumpTxt, { color: colors.txt }]}>−5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.jumpBtn, { borderColor: colors.sub + "50" }]}
              onPress={() => jump(-1)}
            >
              <Text style={[styles.jumpTxt, { color: colors.txt }]}>−1</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={[styles.jumpBtn, { borderColor: colors.sub + "50" }]}
              onPress={() => jump(+1)}
            >
              <Text style={[styles.jumpTxt, { color: colors.txt }]}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.jumpBtn, { borderColor: colors.sub + "50" }]}
              onPress={() => jump(+5)}
            >
              <Text style={[styles.jumpTxt, { color: colors.txt }]}>+5</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={closeSheet}
              style={[styles.cancelBtn, { marginRight: 8 }]}
            >
              <Text style={[styles.cancelTxt, { color: colors.accent }]}>
                {t("common.cancel") || "Отмена"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                closeSheet();
                commit(sliderPage);
              }}
              style={[styles.okBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.okTxt, { color: colors.bg }]}>
                {t("common.ok") || "ОК"}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

type Styles = {
  bar: ViewStyle;
  iconBtn: ViewStyle;
  center: ViewStyle;
  pill: ViewStyle;
  pillTxt: TextStyle;

  backdrop: ViewStyle;
  sheet: ViewStyle;
  handleWrap: ViewStyle;
  handle: ViewStyle;

  headerRow: ViewStyle;
  title: TextStyle;
  roundBtn: ViewStyle;

  valueRow: ViewStyle;
  input: TextStyle;
  totalTxt: TextStyle;

  slider: ViewStyle;

  controls: ViewStyle;
  jumpBtn: ViewStyle;
  jumpTxt: TextStyle;

  actions: ViewStyle;
  cancelBtn: ViewStyle;
  cancelTxt: TextStyle;
  okBtn: ViewStyle;
  okTxt: TextStyle;
};

const styles = StyleSheet.create<Styles>({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 20,
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  pillTxt: {
    fontSize: 16,
    fontWeight: "500",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "android" ? 24 : 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -5 },
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  handleWrap: {
    alignItems: "center",
    paddingVertical: 4,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    width: 90,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
  },
  totalTxt: {
    marginLeft: 10,
    fontSize: 18,
    fontWeight: "500",
  },

  slider: {
    width: "100%",
    height: 48,
    marginVertical: 8,
  },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  jumpBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  jumpTxt: {
    fontSize: 16,
    fontWeight: "500",
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  cancelTxt: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  okBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  okTxt: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
