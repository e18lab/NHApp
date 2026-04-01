import { createContext, useContext } from "react";
export type DrawerContextType = {
  openDrawer: () => void;
};
export const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
});
export const useDrawer = () => useContext(DrawerContext);
