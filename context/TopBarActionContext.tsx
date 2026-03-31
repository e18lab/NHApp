import React from "react";

export type TopBarAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: "primary" | "default";
};

type Ctx = {
  action: TopBarAction | null;
  setAction: (a: TopBarAction | null) => void;
};

const TopBarActionContext = React.createContext<Ctx | null>(null);

export function TopBarActionProvider({ children }: { children: React.ReactNode }) {
  const [action, setActionState] = React.useState<TopBarAction | null>(null);
  const setAction = React.useCallback((a: TopBarAction | null) => setActionState(a), []);
  const value = React.useMemo(() => ({ action, setAction }), [action, setAction]);
  return (
    <TopBarActionContext.Provider value={value}>
      {children}
    </TopBarActionContext.Provider>
  );
}

export function useTopBarAction(): Ctx {
  const ctx = React.useContext(TopBarActionContext);
  if (!ctx) throw new Error("useTopBarAction must be used within TopBarActionProvider");
  return ctx;
}

