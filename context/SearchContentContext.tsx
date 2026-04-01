import React, { createContext, useCallback, useContext, useState } from "react";

type SearchContentContextValue = {
  showSearchContent: boolean;
  setShowSearchContent: (v: boolean) => void;
};

const SearchContentContext = createContext<SearchContentContextValue | null>(null);

export function SearchContentProvider({ children }: { children: React.ReactNode }) {
  const [showSearchContent, setShowSearchContent] = useState(false);
  const setter = useCallback((v: boolean) => setShowSearchContent(v), []);
  const value = React.useMemo(
    () => ({ showSearchContent, setShowSearchContent: setter }),
    [showSearchContent, setter]
  );
  return (
    <SearchContentContext.Provider value={value}>
      {children}
    </SearchContentContext.Provider>
  );
}

export function useSearchContent(): SearchContentContextValue | null {
  return useContext(SearchContentContext);
}
