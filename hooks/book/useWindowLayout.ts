import { useEffect, useState } from "react";
import { Dimensions } from "react-native";
export const useWindowLayout = () => {
  const { width: INIT_W, height: INIT_H } = Dimensions.get("window");
  const [win, setWin] = useState({ w: INIT_W, h: INIT_H });
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) =>
      setWin({ w: window.width, h: window.height })
    );
    return () => sub.remove();
  }, []);
  const shortest = Math.min(win.w, win.h);
  const isTablet = shortest >= 600;
  const isLandscape = win.w > win.h;
  const wide = isTablet || (isLandscape && win.w >= 400);
  const innerPadding = wide ? 16 : 12;
  return { win, isTablet, isLandscape, wide, innerPadding };
};
