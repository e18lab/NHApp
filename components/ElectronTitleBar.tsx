import { isElectron, windowControls } from "@/electron/bridge";
import { useTheme } from "@/lib/ThemeContext";
import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
export const ELECTRON_TITLE_BAR_HEIGHT = 32;
export function ElectronTitleBar() {
  const { colors } = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);
  const containerRef = useRef<View>(null);
  const dragAreaRef = useRef<View>(null);
  const controlsRef = useRef<View>(null);
  const minimizeButtonRef = useRef<TouchableOpacity>(null);
  const maximizeButtonRef = useRef<TouchableOpacity>(null);
  const closeButtonRef = useRef<TouchableOpacity>(null);
  useEffect(() => {
    if (!isElectron() || Platform.OS !== "web") return;
    windowControls.isMaximized().then(setIsMaximized);
    const handleMaximizeChange = (maximized: boolean) => {
      setIsMaximized(maximized);
    };
    let unsubscribe: (() => void) | null = null;
    if (typeof window !== "undefined" && (window as any).electron) {
      const electron = (window as any).electron;
      if (electron.onWindowMaximizeChanged) {
        unsubscribe = electron.onWindowMaximizeChanged(handleMaximizeChange);
      }
    }
    const interval = setInterval(async () => {
      const maximized = await windowControls.isMaximized();
      setIsMaximized(maximized);
    }, 1000);
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web" || !isElectron() || typeof document === "undefined") return;
    const styleId = "electron-title-bar-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        [data-electron-title-bar] {
          -webkit-app-region: drag !important;
          cursor: default !important;
          user-select: none !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          z-index: 1000 !important;
          height: ${ELECTRON_TITLE_BAR_HEIGHT}px !important;
        }
        [data-electron-drag-area] {
          -webkit-app-region: drag !important;
        }
        [data-electron-controls] {
          -webkit-app-region: no-drag !important;
        }
        [data-electron-button] {
          -webkit-app-region: no-drag !important;
          cursor: pointer !important;
        }
        [data-electron-button]:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
        }
        [data-electron-button-close]:hover {
          background-color: #e81123 !important;
        }
        [data-electron-button-close]:hover svg path {
          stroke: #fff !important;
        }
      `;
      document.head.appendChild(style);
    }
    const setStylesAndAttributes = () => {
      const getDOMNode = (ref: any) => {
        const element = ref?.current as any;
        return element?._domNode || element?.base || element;
      };
      const containerNode = getDOMNode(containerRef);
      if (containerNode) {
        if (containerNode.setAttribute) {
          containerNode.setAttribute("data-electron-title-bar", "true");
        }
        if (containerNode.style) {
          containerNode.style.webkitAppRegion = "drag";
          containerNode.style.cursor = "default";
          containerNode.style.userSelect = "none";
          containerNode.style.position = "fixed";
          containerNode.style.top = "0";
          containerNode.style.left = "0";
          containerNode.style.right = "0";
          containerNode.style.width = "100%";
          containerNode.style.zIndex = "1000";
        }
      }
      const dragAreaNode = getDOMNode(dragAreaRef);
      if (dragAreaNode && dragAreaNode.style) {
        dragAreaNode.style.webkitAppRegion = "drag";
      }
      const controlsNode = getDOMNode(controlsRef);
      if (controlsNode && controlsNode.style) {
        controlsNode.style.webkitAppRegion = "no-drag";
      }
      const buttonRefs = [minimizeButtonRef, maximizeButtonRef, closeButtonRef];
      buttonRefs.forEach((buttonRef) => {
        const buttonNode = getDOMNode(buttonRef);
        if (buttonNode && buttonNode.style) {
          buttonNode.style.webkitAppRegion = "no-drag";
          buttonNode.style.cursor = "pointer";
        }
      });
      const minimizeNode = getDOMNode(minimizeButtonRef);
      const maximizeNode = getDOMNode(maximizeButtonRef);
      const closeNode = getDOMNode(closeButtonRef);
      if (minimizeNode && minimizeNode.setAttribute) {
        minimizeNode.setAttribute("data-electron-button", "true");
      }
      if (maximizeNode && maximizeNode.setAttribute) {
        maximizeNode.setAttribute("data-electron-button", "true");
      }
      if (closeNode && closeNode.setAttribute) {
        closeNode.setAttribute("data-electron-button", "true");
        closeNode.setAttribute("data-electron-button-close", "true");
      }
    };
    const timeout = setTimeout(setStylesAndAttributes, 100);
    return () => clearTimeout(timeout);
  }, []); 
  if (!isElectron() || Platform.OS !== "web") {
    return null;
  }
  const handleMinimize = () => {
    windowControls.minimize();
  };
  const handleMaximize = () => {
    windowControls.maximize();
  };
  const handleClose = () => {
    windowControls.close();
  };
  return (
    <View
      ref={containerRef}
      data-electron-title-bar
      style={[
        styles.container,
        {
          backgroundColor: colors.searchBg,
          borderBottomColor: colors.page,
        },
      ]}
    >
      <View
        ref={dragAreaRef}
        data-electron-drag-area
        style={styles.dragArea}
      >
        <View style={styles.leftSection}>
          <Text style={[styles.appTitle, { color: colors.txt }]}>NHApp</Text>
        </View>
      </View>
      <View
        ref={controlsRef}
        data-electron-controls
        style={styles.controls}
      >
        <TouchableOpacity
          ref={minimizeButtonRef}
          onPress={handleMinimize}
          style={[styles.button, styles.minimizeButton]}
          activeOpacity={0.7}
        >
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <Path
              d="M2 8h12"
              stroke={colors.txt}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
        <TouchableOpacity
          ref={maximizeButtonRef}
          onPress={handleMaximize}
          style={[styles.button, styles.maximizeButton]}
          activeOpacity={0.7}
        >
          {isMaximized ? (
            <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
              <Rect
                x="2"
                y="2"
                width="8"
                height="8"
                stroke={colors.txt}
                strokeWidth={1.5}
                fill="none"
              />
              <Path
                d="M4 4h4v4H4z"
                stroke={colors.txt}
                strokeWidth={1}
                fill="none"
              />
            </Svg>
          ) : (
            <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <Rect
                x="1"
                y="1"
                width="12"
                height="12"
                stroke={colors.txt}
                strokeWidth={1.5}
                fill="none"
              />
            </Svg>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          ref={closeButtonRef}
          onPress={handleClose}
          style={[styles.button, styles.closeButton]}
          activeOpacity={0.7}
        >
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <Path
              d="M4 4l8 8M12 4l-8 8"
              stroke={colors.txt}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    height: ELECTRON_TITLE_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  dragArea: {
    flex: 1,
    height: "100%",
  },
  leftSection: {
    flex: 1,
    height: "100%",
    paddingLeft: 12,
    justifyContent: "center",
  },
  appTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  controls: {
    flexDirection: "row",
    height: "100%",
    alignItems: "center",
  },
  button: {
    width: 46,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  minimizeButton: {
  },
  maximizeButton: {
  },
  closeButton: {
  },
});
