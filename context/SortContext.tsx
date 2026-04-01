import { requestStoragePush, subscribeToStorageApplied } from "@/api/nhappApi/cloudStorage"
import AsyncStorage from "@react-native-async-storage/async-storage"
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"
export type SortKey =
  | "popular"
  | "popular-week"
  | "popular-today"
  | "popular-month"
  | "date"
const STORAGE_KEY = "searchSortPref"
interface ISortCtx {
  sort: SortKey
  setSort: (s: SortKey) => void
}
const SortContext = createContext<ISortCtx | undefined>(undefined)
export const SortProvider = ({ children }: { children: React.ReactNode }) => {
  const [sort, setSortState] = useState<SortKey>("date") 
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const load = () =>
      AsyncStorage.getItem(STORAGE_KEY).then((s) => {
        if (s) setSortState(s as SortKey)
        setReady(true)
      })
    load()
    const unsub = subscribeToStorageApplied(load)
    return unsub
  }, [])
  const setSort = useCallback((s: SortKey) => {
    setSortState(s)
    AsyncStorage.setItem(STORAGE_KEY, s).catch(() => {})
    requestStoragePush()
  }, [])
  const value = useMemo(() => ({ sort, setSort }), [sort, setSort])
  if (!ready) return null
  return <SortContext.Provider value={value}>{children}</SortContext.Provider>
}
export const useSort = () => {
  const ctx = useContext(SortContext)
  if (!ctx) throw new Error("useSort must be used inside SortProvider")
  return ctx
}
