import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  format,
  addMonths,
  subMonths,
  setMonth,
  setYear,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isAfter,
  startOfDay,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "@/lib/ThemeContext";

const MIN_DATE = new Date("2014-06-28");
MIN_DATE.setHours(0, 0, 0, 0);

function getToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const CELL_SIZE = 40;
const CELL_GAP = 4;
const MIN_YEAR = 2014;
const MAX_YEAR = new Date().getFullYear();

function parseISODate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

type Props = {
  onApply: (from: Date, to: Date) => void;
  onClose: () => void;
  onReset?: () => void;
  openSubmenu: (
    title: string,
    items: { value: string; label: string }[]
  ) => Promise<string | null>;
  initialFrom?: string | null;
  initialTo?: string | null;
};

export function CalendarRangePicker({
  onApply,
  onClose,
  onReset,
  openSubmenu,
  initialFrom,
  initialTo,
}: Props) {
  const { colors } = useTheme();
  const today = getToday();
  const [viewMonth, setViewMonth] = useState(() => {
    const to = parseISODate(initialTo);
    if (to) return startOfMonth(to);
    const from = parseISODate(initialFrom);
    if (from) return startOfMonth(from);
    return new Date();
  });
  const [fromDate, setFromDate] = useState<Date | null>(
    () => parseISODate(initialFrom) ?? null
  );
  const [toDate, setToDate] = useState<Date | null>(
    () => parseISODate(initialTo) ?? null
  );
  const [error, setError] = useState("");

  // When a saved custom range exists, show the month of "До" (initialTo); otherwise current month
  useEffect(() => {
    const to = parseISODate(initialTo);
    const from = parseISODate(initialFrom);
    if (to) {
      setViewMonth(startOfMonth(to));
    } else if (from) {
      setViewMonth(startOfMonth(from));
    } else {
      setViewMonth(startOfMonth(new Date()));
    }
    setFromDate(from ?? null);
    setToDate(to ?? null);
  }, [initialFrom, initialTo]);

  const dayMs = 24 * 60 * 60 * 1000;
  const apply = () => {
    if (!fromDate || !toDate) {
      setError("Выберите обе даты");
      return;
    }
    const fromNorm = new Date(fromDate.getTime());
    fromNorm.setHours(0, 0, 0, 0);
    const toNorm = new Date(toDate.getTime());
    toNorm.setHours(0, 0, 0, 0);
    if (fromNorm > toNorm) {
      setError("Дата «от» не может быть позже «до»");
      return;
    }
    if (fromNorm < MIN_DATE || toNorm < MIN_DATE) {
      setError("Мин. дата: 28.06.2014");
      return;
    }
    setError("");
    onApply(fromDate, toDate);
    onClose();
  };

  const handleDayPress = (d: Date) => {
    const norm = new Date(d.getTime());
    norm.setHours(0, 0, 0, 0);
    if (norm < MIN_DATE || isAfter(norm, today)) return;
    if (!fromDate || (fromDate && toDate)) {
      setFromDate(norm);
      setToDate(null);
      setError("");
    } else {
      if (norm < fromDate) {
        setFromDate(norm);
        setToDate(new Date(fromDate.getTime()));
      } else {
        setToDate(norm);
      }
      setError("");
    }
  };

  const monthWeeks = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const calStart = startOfWeek(start, { weekStartsOn: 1 });
    const calEnd = endOfWeek(end, { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = calStart;
    while (d <= calEnd) {
      days.push(d);
      d = addDays(d, 1);
    }
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [viewMonth]);

  const isInRange = (d: Date) => {
    if (!fromDate || !toDate) return false;
    const a = fromDate.getTime();
    const b = toDate.getTime();
    const t = d.getTime();
    return t >= Math.min(a, b) && t <= Math.max(a, b);
  };
  const isStartOrEnd = (d: Date) =>
    (fromDate && isSameDay(d, fromDate)) || (toDate && isSameDay(d, toDate));
  const isToday = (d: Date) => isSameDay(d, today);

  const viewYear = viewMonth.getFullYear();
  const viewMonthNum = viewMonth.getMonth();
  const canPrevMonth =
    viewYear > MIN_YEAR || (viewYear === MIN_YEAR && viewMonthNum > 5); // June = 5
  const canNextMonth =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonthNum < today.getMonth());

  const monthItems = useMemo(() => {
    const y = viewMonth.getFullYear();
    let from = 0;
    let to = 11;
    if (y === MIN_YEAR) from = 5;
    if (y === today.getFullYear()) to = today.getMonth();
    return Array.from({ length: to - from + 1 }, (_, i) => {
      const idx = from + i;
      return { value: String(idx), label: MONTHS_RU[idx] };
    });
  }, [viewMonth.getFullYear(), today]);

  const yearItems = useMemo(
    () =>
      Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => {
        const y = MAX_YEAR - i;
        return { value: String(y), label: String(y) };
      }),
    []
  );

  const handleMonthPress = async () => {
    const val = await openSubmenu("Выберите месяц", monthItems);
    if (val != null)
      setViewMonth(setMonth(new Date(viewYear, 0), parseInt(val, 10)));
  };

  const handleYearPress = async () => {
    const val = await openSubmenu("Выберите год", yearItems);
    if (val != null)
      setViewMonth(setYear(new Date(viewMonth), parseInt(val, 10)));
  };

  return (
    <View
      style={[
        s.wrap,
        { backgroundColor: colors.surfaceElevated },
        Platform.OS === "android" && s.wrapAndroid,
      ]}
    >
      <View style={s.header}>
        <Pressable
          onPress={() => canPrevMonth && setViewMonth((m) => subMonths(m, 1))}
          disabled={!canPrevMonth}
          style={({ pressed }) => [
            s.navBtn,
            pressed && { opacity: 0.7 },
            !canPrevMonth && { opacity: 0.35 },
          ]}
        >
          <Feather name="chevron-left" size={24} color={colors.accent} />
        </Pressable>
        <View style={s.headerCenter}>
          <Pressable
            onPress={handleMonthPress}
            style={({ pressed }) => [s.headerPart, pressed && { opacity: 0.8 }]}
          >
            <Text style={[s.monthTitle, { color: colors.txt }]}>
              {format(viewMonth, "LLLL", { locale: ru })}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleYearPress}
            style={({ pressed }) => [s.headerPart, pressed && { opacity: 0.8 }]}
          >
            <Text style={[s.monthTitle, { color: colors.txt }]}>
              {viewMonth.getFullYear()}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => canNextMonth && setViewMonth((m) => addMonths(m, 1))}
          disabled={!canNextMonth}
          style={({ pressed }) => [
            s.navBtn,
            pressed && { opacity: 0.7 },
            !canNextMonth && { opacity: 0.35 },
          ]}
        >
          <Feather name="chevron-right" size={24} color={colors.accent} />
        </Pressable>
      </View>

      <View style={s.weekdayRow}>
        {WEEKDAYS.map((wd) => (
          <Text key={wd} style={[s.weekday, { color: colors.sub }]}>
            {wd}
          </Text>
        ))}
      </View>

      <ScrollView
        style={s.calendarScroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {monthWeeks.map((row, ri) => (
          <View key={ri} style={s.row}>
            {row.map((d) => {
              const inMonth = isSameMonth(d, viewMonth);
              const dNorm = startOfDay(d);
              const disabled =
                dNorm < MIN_DATE || isAfter(dNorm, today);
              const selected = isStartOrEnd(d);
              const inRange = isInRange(d);
              const todayCell = isToday(d);
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => handleDayPress(d)}
                  disabled={disabled}
                  style={[
                    s.cell,
                    {
                      backgroundColor: selected
                        ? colors.accent
                        : inRange
                          ? colors.accent + "30"
                          : "transparent",
                      opacity: inMonth ? 1 : 0.35,
                      borderWidth: todayCell ? 2 : 0,
                      borderColor: todayCell ? colors.accent : "transparent",
                    },
                    disabled && s.cellDisabled,
                  ]}
                >
                  <Text
                    style={[
                      s.cellText,
                      {
                        color: selected ? colors.bg : colors.txt,
                        fontWeight: selected ? "700" : "400",
                      },
                    ]}
                  >
                    {format(d, "d")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={s.summary}>
        <Text style={[s.summaryLabel, { color: colors.sub }]}>
          От: {fromDate ? format(fromDate, "dd.MM.yyyy") : "—"}
        </Text>
        <Text style={[s.summaryLabel, { color: colors.sub }]}>
          До: {toDate ? format(toDate, "dd.MM.yyyy") : "—"}
        </Text>
      </View>
      {error ? (
        <Text style={[s.error, { color: colors.accent }]}>{error}</Text>
      ) : null}
      <View style={s.actions}>
        <Pressable
          onPress={() => {
            setViewMonth(startOfMonth(new Date()));
            setFromDate(null);
            setToDate(null);
            setError("");
            onReset?.();
            onClose();
          }}
          style={[s.btn, s.btnSecondary, { borderColor: colors.sub + "60" }]}
        >
          <Text style={[s.btnText, { color: colors.txt }]}>Сбросить</Text>
        </Pressable>
        <Pressable
          onPress={apply}
          style={[s.btn, s.btnPrimary, { backgroundColor: colors.accent }]}
        >
          <Text style={[s.btnText, { color: colors.bg }]}>Применить</Text>
        </Pressable>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    padding: 12,
    minHeight: 280,
  },
  wrapAndroid: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navBtn: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerPart: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  monthCell: {
    width: "30%",
    minWidth: 90,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  monthCellText: {
    fontSize: 14,
    fontWeight: "600",
  },
  yearList: {
    flex: 1,
    maxHeight: 260,
    marginBottom: 12,
  },
  yearRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  yearRowText: {
    fontSize: 16,
    fontWeight: "600",
  },
  backLink: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
  },
  backLinkTop: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  backLinkText: {
    fontSize: 15,
    fontWeight: "600",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  calendarScroll: {
    flex: 1,
    minHeight: 200,
  },
  row: {
    flexDirection: "row",
    marginBottom: CELL_GAP,
  },
  cell: {
    flex: 1,
    height: CELL_SIZE - 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 1,
  },
  cellDisabled: {
    opacity: 0.25,
  },
  cellText: {
    fontSize: 15,
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  error: {
    fontSize: 13,
    marginBottom: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnPrimary: {},
  btnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
