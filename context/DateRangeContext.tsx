import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type NullableDate = Date | null;

type Ctx = {
  from: NullableDate;
  to: NullableDate;
  isHydrated: boolean;
  setRange: (from: NullableDate, to: NullableDate) => void;
  setFrom: (d: NullableDate) => void;
  setTo: (d: NullableDate) => void;
  clearRange: () => void;
};

const DateRangeContext = createContext<Ctx>({
  from: null,
  to: null,
  isHydrated: false,
  setRange: () => {},
  setFrom: () => {},
  setTo: () => {},
  clearRange: () => {},
});

const STORAGE_KEY = "dateRange:v2";

// утилиты
const toISODate = (d: NullableDate) =>
  d ? new Date(d).toISOString().slice(0, 10) : null;
const fromISODate = (s: string | null | undefined): NullableDate =>
  s ? new Date(s + "T00:00:00.000Z") : null;

export function DateRangeProvider({ children }: PropsWithChildren) {
  const [from, setFromState] = useState<NullableDate>(null);
  const [to, setToState] = useState<NullableDate>(null);
  const [isHydrated, setHydrated] = useState(false);

  const persist = useCallback(async (f: NullableDate, t: NullableDate) => {
    try {
      const payload = JSON.stringify({ from: toISODate(f), to: toISODate(t) });
      await AsyncStorage.setItem(STORAGE_KEY, payload); // хранение KV (см. доки). 
    } catch {
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { from?: string | null; to?: string | null };
          const f = fromISODate(parsed?.from || null);
          const t = fromISODate(parsed?.to || null);
          setFromState(f);
          setToState(t);
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setRange = useCallback(
    (f: NullableDate, t: NullableDate) => {
      setFromState(f);
      setToState(t);
      void persist(f, t);
    },
    [persist]
  );

  const setFrom = useCallback(
    (d: NullableDate) => {
      setFromState(d);
      void persist(d, to);
    },
    [to, persist]
  );

  const setTo = useCallback(
    (d: NullableDate) => {
      setToState(d);
      void persist(from, d);
    },
    [from, persist]
  );

  const clearRange = useCallback(() => setRange(null, null), [setRange]);

  const value = useMemo(
    () => ({ from, to, isHydrated, setRange, setFrom, setTo, clearRange }),
    [from, to, isHydrated, setRange, setFrom, setTo, clearRange]
  );

  return (
    <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
  );
}

export const useDateRange = () => useContext(DateRangeContext);
