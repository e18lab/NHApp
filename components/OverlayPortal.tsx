import React, { createContext, ReactNode, useContext, useState } from "react";
import { StyleSheet, View } from "react-native";
type Ctx = { show: (node: ReactNode) => void; hide: () => void };
const OverlayCtx = createContext<Ctx>({ show: () => {}, hide: () => {} });
export const OverlayPortalProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [node, setNode] = useState<ReactNode | null>(null);
  return (
    <OverlayCtx.Provider value={{ show: setNode, hide: () => setNode(null) }}>
      <View style={{ flex: 1, position: "relative" }}>
        {children}
        {node ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
            {node}
          </View>
        ) : null}
      </View>
    </OverlayCtx.Provider>
  );
};
export const useOverlayPortal = () => useContext(OverlayCtx);
