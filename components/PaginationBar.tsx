// components/PaginationBar.tsx
import { useTheme } from "@/lib/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
  onRequestScrollTop?: () => void;
};

export default function PaginationBar({
  currentPage,
  totalPages,
  onChange,
  onRequestScrollTop,
}: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [sliderPage, setSliderPage] = useState(currentPage);
  const scale = useMemo(() => new Animated.Value(1), []);
  const sheetY = useRef(new Animated.Value(0)).current; // 0..1

  if (totalPages <= 1) return null;

  const animateTap = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true }).start();

  const commit = (next: number) => {
    const page = Math.max(1, Math.min(totalPages, Math.round(next)));
    if (page === currentPage) return;
    onRequestScrollTop?.();
    onChange(page);
  };

  const openSheet = () => {
    setSliderPage(currentPage);
    setVisible(true);
    Animated.timing(sheetY, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  const closeSheet = () => {
    Keyboard.dismiss();
    Animated.timing(sheetY, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => finished && setVisible(false));
  };

  const jump = (delta: number) => {
    const next = Math.max(1, Math.min(totalPages, sliderPage + delta));
    setSliderPage(next);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  };

  const translateY = sheetY.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <>
      <View style={[styles.bar, { backgroundColor: colors.menuBg }]}>
        <TouchableOpacity
          onPressIn={() => animateTap(0.95)}
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

        <TouchableOpacity
          onPressIn={() => animateTap(0.95)}
          onPressOut={() => animateTap(1)}
          onPress={openSheet}
          style={styles.center}
        >
          <Animated.View style={[styles.pill, { transform: [{ scale }] }]}>
            <Text style={[styles.pillTxt, { color: colors.menuTxt }]}>
              {currentPage}/{totalPages}
            </Text>
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity
          onPressIn={() => animateTap(0.95)}
          onPressOut={() => animateTap(1)}
          onPress={() => currentPage < totalPages && commit(currentPage + 1)}
          onLongPress={() => currentPage < totalPages && commit(currentPage + 10)}
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
          {/* handle */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.sub }]} />
          </View>

          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setSliderPage(1)} style={styles.roundBtn}>
              <Ionicons name="play-skip-back" size={22} color={colors.txt} />
            </TouchableOpacity>

            <Text style={[styles.title, { color: colors.txt }]}>Страница</Text>

            <TouchableOpacity onPress={() => setSliderPage(totalPages)} style={styles.roundBtn}>
              <Ionicons name="play-skip-forward" size={22} color={colors.txt} />
            </TouchableOpacity>
          </View>

          <View style={styles.valueRow}>
            <TextInput
              style={[
                styles.input,
                { borderColor: colors.page, backgroundColor: colors.menuBg, color: colors.txt },
              ]}
              keyboardType="number-pad"
              returnKeyType="done"
              value={String(sliderPage)}
              onChangeText={(t) => {
                const n = parseInt(t.replace(/[^\d]/g, ""), 10);
                if (!Number.isFinite(n)) return setSliderPage(1);
                setSliderPage(Math.max(1, Math.min(totalPages, n)));
              }}
              onSubmitEditing={() => commit(sliderPage)}
            />
            <Text style={[styles.totalTxt, { color: colors.sub }]}>/ {totalPages}</Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={totalPages}
            step={1}
            value={sliderPage}
            onValueChange={setSliderPage}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.sub}
            thumbTintColor={colors.accent}
          />

          <View style={styles.controls}>
            <TouchableOpacity style={styles.jumpBtn} onPress={() => jump(-5)}>
              <Text style={[styles.jumpTxt, { color: colors.txt }]}>−5</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.jumpBtn} onPress={() => jump(-1)}>
              <Text style={[styles.jumpTxt, { color: colors.txt }]}>−1</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity style={styles.jumpBtn} onPress={() => jump(+1)}>
              <Text style={[styles.jumpTxt, { color: colors.txt }]}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.jumpBtn} onPress={() => jump(+5)}>
              <Text style={[styles.jumpTxt, { color: colors.txt }]}>+5</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={closeSheet} style={styles.cancelBtn}>
              <Text style={[styles.cancelTxt, { color: colors.sub }]}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                closeSheet();
                commit(sliderPage);
              }}
              style={[styles.okBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.okTxt, { color: colors.bg }]}>ОК</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
  },
  iconBtn: { padding: 8, borderRadius: 16 },
  center: { flex: 1, alignItems: "center" },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 40,
  },
  pillTxt: { fontSize: 16, fontWeight: "600" },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  handleWrap: { alignItems: "center", paddingVertical: 6 },
  handle: { width: 40, height: 4, borderRadius: 4, opacity: 0.6 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, fontWeight: "700" },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  valueRow: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 4 },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    width: 86,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  totalTxt: { marginLeft: 8, fontSize: 16 },

  slider: { width: "100%", height: 44, marginVertical: 4 },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  jumpBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  jumpTxt: { fontSize: 16, fontWeight: "600" },

  actions: { flexDirection: "row", justifyContent: "space-between" },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
  cancelTxt: { fontSize: 16, fontWeight: "500" },
  okBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
  okTxt: { fontSize: 16, fontWeight: "700" },
});
