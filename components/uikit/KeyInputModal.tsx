/**
 * KeyInputModal — модальный ввод: панель с полем прижата к верхнему краю клавиатуры.
 * Используется для редактирования значения поверх клавиатуры без перекрытия полем.
 * Рекомендуется для использования на Android (only Android).
 */
import { useTheme } from "@/lib/ThemeContext";
import React, { useEffect, useRef, useState } from "react";
import type { TextInputProps } from "react-native";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type KeyInputModalProps = {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChangeText: (text: string) => void;
  /** Вызывается при Submit с клавиатуры с текущим значением */
  onSubmit?: (value: string) => void;
  label?: string;
  /** Показывать подпись слева от поля (по умолчанию true). Не показывается, если label пустой или showLabel false */
  showLabel?: boolean;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  /** При фокусе: false — курсор в конец текста (по умолчанию), true — выделить весь текст */
  selectTextOnFocus?: boolean;
  autoFocus?: boolean;
  /** Дополнительные пропсы для TextInput */
  inputProps?: Partial<TextInputProps>;
};

export function KeyInputModal({
  visible,
  onClose,
  value,
  onChangeText,
  onSubmit,
  label,
  showLabel = true,
  placeholder,
  keyboardType = "default",
  selectTextOnFocus = false,
  autoFocus = true,
  inputProps,
}: KeyInputModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputReady, setInputReady] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      setInputReady(false);
      return;
    }
    const show = (e: { endCoordinates: { height: number } }) =>
      setKeyboardHeight(e.endCoordinates.height);
    const hide = () => {
      setKeyboardHeight(0);
      onClose();
    };
    const subShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      show
    );
    const subHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      hide
    );
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible || !autoFocus || !inputReady) return;
    const delay = Platform.OS === "android" ? 300 : 50;
    const t = setTimeout(() => inputRef.current?.focus(), delay);
    return () => clearTimeout(t);
  }, [visible, autoFocus, inputReady]);

  const handleDone = () => {
    onSubmit?.(value);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      onShow={() => {
        setInputReady(false);
        const delay = Platform.OS === "android" ? 100 : 0;
        setTimeout(() => setInputReady(true), delay);
      }}
    >
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable
          style={[
            s.bar,
            {
              bottom: keyboardHeight,
              paddingBottom: Math.max(12, insets.bottom),
              backgroundColor: colors.surfaceElevated ?? colors.bg,
              borderTopColor: colors.sub + "30",
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {showLabel && label != null && label !== "" ? (
            <Text selectable={false} style={[s.label, { color: colors.sub }]} numberOfLines={1}>
              {label}
            </Text>
          ) : null}
          {inputReady ? (
            <TextInput
              ref={inputRef}
              style={[
                s.input,
                {
                  color: colors.txt,
                  borderColor: colors.accent,
                  backgroundColor: colors.bg,
                },
              ]}
              value={value}
              onChangeText={onChangeText}
              onSubmitEditing={handleDone}
              placeholder={placeholder}
              placeholderTextColor={colors.sub + "99"}
              keyboardType={keyboardType}
              selectTextOnFocus={selectTextOnFocus}
              autoFocus={autoFocus}
              showSoftInputOnFocus={true}
              {...inputProps}
            />
          ) : (
            <View style={[s.input, s.inputPlaceholder, { backgroundColor: colors.bg, borderColor: colors.sub + "30" }]} />
          )}
        </Pressable>
      </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    maxWidth: 80,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  inputPlaceholder: {
    borderWidth: 1,
  },
});
