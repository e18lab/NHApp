import { Rect } from "@/api/nhappApi/characterCards";
import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
import React, { useEffect, useRef, useState } from "react";
import {
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  PanResponderGestureState,
  PanResponderInstance,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
interface CharacterCropModalProps {
  visible: boolean;
  imageUri: string;
  onCancel: () => void;
  onConfirm: (rect: Rect) => void;
}
const ASPECT = 2 / 1.4;
type NormRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
const MIN_WIDTH_NORM = 0.12;
type GestureMode = "move" | null;
export const CharacterCropModal: React.FC<CharacterCropModalProps> = ({
  visible,
  imageUri,
  onCancel,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { width: winW, height: winH } = useWindowDimensions();
  const isPortrait = winH >= winW;
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [intrinsicSize, setIntrinsicSize] = useState({ width: 0, height: 0 });
  const [rect, setRect] = useState<NormRect | null>(null);
  const containerRef = useRef(containerSize);
  const intrinsicRef = useRef(intrinsicSize);
  const rectRef = useRef<NormRect | null>(rect);
  const initializedRef = useRef(false);
  const modeRef = useRef<GestureMode>(null);
  const moveStartRectRef = useRef<NormRect | null>(null);
  containerRef.current = containerSize;
  intrinsicRef.current = intrinsicSize;
  rectRef.current = rect;
  useEffect(() => {
    if (!visible || !imageUri) return;
    let cancelled = false;
    Image.getSize(
      imageUri,
      (w, h) => {
        if (cancelled) return;
        setIntrinsicSize({ width: w, height: h });
        initializedRef.current = false;
      },
      () => {
        if (cancelled) return;
        setIntrinsicSize({ width: 1000, height: 2000 });
        initializedRef.current = false;
      }
    );
    return () => {
      cancelled = true;
    };
  }, [visible, imageUri]);
  const handleContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width === containerSize.width && height === containerSize.height)
      return;
    setContainerSize({ width, height });
    initializedRef.current = false;
  };
  const getImageMetrics = () => {
    const { width: cw, height: ch } = containerRef.current;
    const { width: iw, height: ih } = intrinsicRef.current;
    if (!cw || !ch || !iw || !ih) return null;
    const scaleToFit = Math.min(cw / iw, ch / ih);
    const imgW = iw * scaleToFit;
    const imgH = ih * scaleToFit;
    const offsetX = (cw - imgW) / 2;
    const offsetY = (ch - imgH) / 2;
    return { cw, ch, iw, ih, scaleToFit, imgW, imgH, offsetX, offsetY };
  };
  const clampRectToImage = (r: NormRect): NormRect => {
    const metrics = getImageMetrics();
    if (!metrics) return r;
    const { cw, ch, imgW, imgH, offsetX, offsetY } = metrics;
    let widthPx = r.width * cw;
    if (widthPx < MIN_WIDTH_NORM * cw) {
      widthPx = MIN_WIDTH_NORM * cw;
    }
    let heightPx = widthPx * ASPECT;
    if (heightPx > imgH) {
      heightPx = imgH;
      widthPx = heightPx / ASPECT;
    }
    if (widthPx > imgW) {
      widthPx = imgW;
      heightPx = widthPx * ASPECT;
    }
    const widthNorm = widthPx / cw;
    const heightNorm = heightPx / ch;
    let xPx = r.x * cw;
    let yPx = r.y * ch;
    const minX = offsetX;
    const minY = offsetY;
    const maxX = offsetX + imgW - widthPx;
    const maxY = offsetY + imgH - heightPx;
    if (maxX < minX || maxY < minY) {
      const centerX = offsetX + imgW / 2;
      const centerY = offsetY + imgH / 2;
      xPx = centerX - widthPx / 2;
      yPx = centerY - heightPx / 2;
    } else {
      xPx = clamp(xPx, minX, maxX);
      yPx = clamp(yPx, minY, maxY);
    }
    return {
      x: xPx / cw,
      y: yPx / ch,
      width: widthNorm,
      height: heightNorm,
    };
  };
  useEffect(() => {
    if (!visible) return;
    const metrics = getImageMetrics();
    if (!metrics) return;
    const { cw, ch, imgW, imgH, offsetX, offsetY } = metrics;
    if (!cw || !ch || !imgW || !imgH) return;
    if (initializedRef.current && rectRef.current) return;
    let frameHeightPx = imgH * 0.6;
    let frameWidthPx = frameHeightPx / ASPECT;
    if (frameWidthPx > imgW * 0.9) {
      frameWidthPx = imgW * 0.9;
      frameHeightPx = frameWidthPx * ASPECT;
    }
    if (frameWidthPx < MIN_WIDTH_NORM * cw) {
      frameWidthPx = MIN_WIDTH_NORM * cw;
      frameHeightPx = frameWidthPx * ASPECT;
    }
    const left = offsetX + (imgW - frameWidthPx) / 2;
    const top = offsetY + (imgH - frameHeightPx) / 2;
    const initialRect: NormRect = {
      x: left / cw,
      y: top / ch,
      width: frameWidthPx / cw,
      height: frameHeightPx / ch,
    };
    const clamped = clampRectToImage(initialRect);
    setRect(clamped);
    rectRef.current = clamped;
    initializedRef.current = true;
  }, [
    visible,
    containerSize.width,
    containerSize.height,
    intrinsicSize.width,
    intrinsicSize.height,
  ]);
  const changeSize = (factor: number) => {
    const r = rectRef.current;
    const metrics = getImageMetrics();
    if (!r || !metrics) return;
    const { cw, ch, imgW, imgH } = metrics;
    const maxWidthNormByImage = Math.min(imgW / cw, imgH / ch / ASPECT);
    let newWidthNorm = r.width * factor;
    newWidthNorm = clamp(newWidthNorm, MIN_WIDTH_NORM, maxWidthNormByImage);
    const newHeightNorm = newWidthNorm * ASPECT;
    const centerX = r.x + r.width / 2;
    const centerY = r.y + r.height / 2;
    let newRect: NormRect = {
      x: centerX - newWidthNorm / 2,
      y: centerY - newHeightNorm / 2,
      width: newWidthNorm,
      height: newHeightNorm,
    };
    newRect = clampRectToImage(newRect);
    setRect(newRect);
    rectRef.current = newRect;
  };
  const handleZoomIn = () => changeSize(1.12);
  const handleZoomOut = () => changeSize(0.88);
  const panResponder = useRef<PanResponderInstance>(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: (_evt: GestureResponderEvent) => {
        const r = rectRef.current;
        if (!r) {
          modeRef.current = null;
          return;
        }
        modeRef.current = "move";
        moveStartRectRef.current = { ...r };
      },
      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        const metrics = getImageMetrics();
        if (!metrics) return;
        const { cw, ch } = metrics;
        const mode = modeRef.current;
        if (mode !== "move") return;
        const startRect = moveStartRectRef.current;
        if (!startRect) return;
        const dxNorm = gestureState.dx / cw;
        const dyNorm = gestureState.dy / ch;
        let newRect: NormRect = {
          x: startRect.x + dxNorm,
          y: startRect.y + dyNorm,
          width: startRect.width,
          height: startRect.height,
        };
        newRect = clampRectToImage(newRect);
        setRect(newRect);
        rectRef.current = newRect;
      },
      onPanResponderRelease: () => {
        modeRef.current = null;
        moveStartRectRef.current = null;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        modeRef.current = null;
        moveStartRectRef.current = null;
      },
    })
  ).current;
  const handleConfirm = () => {
    const r = rectRef.current;
    const metrics = getImageMetrics();
    if (!r || !metrics) {
      onConfirm({ x: 0, y: 0, width: 1, height: 1 });
      return;
    }
    const { cw, ch, iw, ih, scaleToFit, offsetX, offsetY } = metrics;
    const frameLeftPx = r.x * cw;
    const frameTopPx = r.y * ch;
    const frameWidthPx = r.width * cw;
    const frameHeightPx = r.height * ch;
    const imgDisplayWidth = iw * scaleToFit;
    const imgDisplayHeight = ih * scaleToFit;
    let xInImagePx = frameLeftPx - offsetX;
    let yInImagePx = frameTopPx - offsetY;
    let wInImagePx = frameWidthPx;
    let hInImagePx = frameHeightPx;
    xInImagePx = clamp(xInImagePx, 0, imgDisplayWidth);
    yInImagePx = clamp(yInImagePx, 0, imgDisplayHeight);
    wInImagePx = clamp(wInImagePx, 0, imgDisplayWidth - xInImagePx);
    hInImagePx = clamp(hInImagePx, 0, imgDisplayHeight - yInImagePx);
    const xNorm = clamp(xInImagePx / (scaleToFit * iw), 0, 1);
    const yNorm = clamp(yInImagePx / (scaleToFit * ih), 0, 1);
    const wNorm = clamp(wInImagePx / (scaleToFit * iw), 0, 1 - xNorm);
    const hNorm = clamp(hInImagePx / (scaleToFit * ih), 0, 1 - yNorm);
    const result: Rect = {
      x: xNorm,
      y: yNorm,
      width: wNorm,
      height: hNorm,
    };
    onConfirm(result);
  };
  const renderPreview = () => {
    if (!rect) return null;
    const metrics = getImageMetrics();
    if (!metrics) return null;
    const { cw, ch, iw, ih, scaleToFit, offsetX, offsetY } = metrics;
    const frameLeftPx = rect.x * cw;
    const frameTopPx = rect.y * ch;
    const frameWidthPx = rect.width * cw;
    const frameHeightPx = rect.height * ch;
    const imgDisplayWidth = iw * scaleToFit;
    const imgDisplayHeight = ih * scaleToFit;
    let xInImagePx = frameLeftPx - offsetX;
    let yInImagePx = frameTopPx - offsetY;
    let wInImagePx = frameWidthPx;
    let hInImagePx = frameHeightPx;
    xInImagePx = clamp(xInImagePx, 0, imgDisplayWidth);
    yInImagePx = clamp(yInImagePx, 0, imgDisplayHeight);
    wInImagePx = clamp(wInImagePx, 0, imgDisplayWidth - xInImagePx);
    hInImagePx = clamp(hInImagePx, 0, imgDisplayHeight - yInImagePx);
    if (wInImagePx <= 0 || hInImagePx <= 0) return null;
    const previewWidth = isPortrait ? Math.min(winW * 0.6, 220) : 130;
    const scalePreview = previewWidth / wInImagePx;
    const previewImgW = imgDisplayWidth * scalePreview;
    const previewImgH = imgDisplayHeight * scalePreview;
    const previewOffsetX = -xInImagePx * scalePreview;
    const previewOffsetY = -yInImagePx * scalePreview;
    return (
      <View
        style={[
          styles.previewBox,
          {
            width: previewWidth,
            borderColor: colors.page,
          },
        ]}
      >
        <View style={styles.previewInner}>
          <Image
            source={{ uri: imageUri }}
            style={{
              width: previewImgW,
              height: previewImgH,
              position: "absolute",
              left: previewOffsetX,
              top: previewOffsetY,
            }}
            resizeMode="cover"
          />
        </View>
      </View>
    );
  };
  return (
    <Modal
      visible={visible}
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.title }]}>
          {t("crop.title")}
        </Text>
        <View
          style={[
            styles.workArea,
            { flexDirection: isPortrait ? "column" : "row" },
          ]}
        >
          <View
            style={[
              styles.imageWrapper,
              isPortrait && { flex: 1, width: "100%" },
            ]}
          >
            <View
              style={[styles.imageContainer, { backgroundColor: "#000" }]}
              onLayout={handleContainerLayout}
            >
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="contain"
              />
              {rect && (
                <View
                  style={[
                    styles.cropArea,
                    {
                      left: rect.x * containerSize.width,
                      top: rect.y * containerSize.height,
                      width: rect.width * containerSize.width,
                      height: rect.height * containerSize.height,
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  <View
                    style={[
                      styles.cropBox,
                      {
                        borderColor: colors.accent,
                        backgroundColor: "#00000055",
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          </View>
          <View
            style={[
              styles.previewColumn,
              isPortrait && {
                width: "100%",
                marginTop: 12,
                alignItems: "center",
              },
            ]}
          >
            <Text style={[styles.previewTitle, { color: colors.metaText }]}>
              {t("crop.preview")}
            </Text>
            {renderPreview()}
            <View style={styles.sizeButtonsRow}>
              <Pressable
                style={[
                  styles.sizeButton,
                  {
                    backgroundColor: colors.tagBg,
                    borderColor: colors.page,
                  },
                ]}
                onPress={handleZoomIn}
              >
                <Text
                  style={[styles.sizeButtonText, { color: colors.tagText }]}
                >
                  −
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.sizeButton,
                  {
                    backgroundColor: colors.accent,
                    borderColor: colors.accent,
                  },
                ]}
                onPress={handleZoomOut}
              >
                <Text style={[styles.sizeButtonText, { color: colors.bg }]}>
                  +
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
        <View style={styles.bottomRow}>
          <View
            style={{
              flexDirection: "row",
              flex: 1,
              justifyContent: "flex-end",
            }}
          >
            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.page }]}
              onPress={onCancel}
            >
              <Text style={[styles.actionText, { color: colors.tagText }]}>
                {t("crop.cancel")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.accent }]}
              onPress={handleConfirm}
            >
              <Text style={[styles.actionText, { color: colors.bg }]}>
                {t("crop.accept")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  workArea: {
    flex: 1,
    gap: 8,
  },
  imageWrapper: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  cropArea: {
    position: "absolute",
  },
  cropBox: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
  },
  previewColumn: {
    width: 160,
    paddingLeft: 6,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  previewBox: {
    aspectRatio: 1.4 / 2,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1,
  },
  previewInner: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  sizeButtonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
    gap: 10,
  },
  sizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sizeButtonText: {
    fontSize: 20,
    fontWeight: "700",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  bottomButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  bottomText: {
    fontSize: 14,
    fontWeight: "500",
  },
  actionButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginLeft: 8,
  },
  actionText: {
    fontWeight: "600",
    fontSize: 15,
  },
});
export default CharacterCropModal;
