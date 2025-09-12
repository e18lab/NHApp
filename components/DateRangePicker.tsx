import { useTheme } from "@/lib/ThemeContext";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

type Dateish = Date | null;

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const dayStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const addMonths = (d: Date, m: number) =>
  new Date(d.getFullYear(), d.getMonth() + m, 1);

const daysMatrix = (year: number, month: number) => {
  const first = new Date(year, month, 1);
  const startWeekDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < startWeekDay; i++) {
    const d = new Date(year, month - 1, prevDays - (startWeekDay - 1 - i));
    cells.push({ date: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const nextIdx = cells.length - (startWeekDay + daysInMonth) + 1;
    cells.push({ date: new Date(year, month + 1, nextIdx), inMonth: false });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }
  return cells;
};

export type DateRangeValue = { from: Dateish; to: Dateish };

export default function DateRangePicker({
  initialFrom,
  initialTo,
  minDate: minDateProp = new Date(2014, 5, 28),
  onApply,
  onClear,
}: {
  initialFrom?: Dateish;
  initialTo?: Dateish;
  minDate?: Date;
  onApply: (range: DateRangeValue) => void;
  onCancel?: () => void;
  onClear?: () => void;
}) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 720;

  const today = dayStart(new Date());
  const MIN_DATE = dayStart(minDateProp);
  const minYear = MIN_DATE.getFullYear();
  const minMonth = MIN_DATE.getMonth();

  const clampToBounds = (d: Date) => {
    const t0 = new Date(minYear, minMonth, 1).getTime();
    const t1 = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const t = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const clamped = Math.max(t0, Math.min(t1, t));
    const cd = new Date(clamped);
    return new Date(cd.getFullYear(), cd.getMonth(), 1);
  };

  const H_PAD = isTablet ? 24 : 10;
  const GRID_W = Math.max(300, Math.min(680, width - H_PAD * 2));
  const CELL = useMemo(() => {
    const cw = Math.floor(GRID_W / 7);
    const clampMin = isTablet ? 54 : 42;
    const clampMax = isTablet ? 68 : 50;
    return Math.max(clampMin, Math.min(clampMax, cw));
  }, [GRID_W, isTablet]);

  const [cursor, setCursor] = useState<Date>(() => {
    const base =
      initialTo ??
      initialFrom ??
      new Date(today.getFullYear(), today.getMonth(), 1);
    const b = new Date(
      Math.max(
        new Date(minYear, minMonth, 1).getTime(),
        new Date(
          (base as Date).getFullYear(),
          (base as Date).getMonth(),
          1
        ).getTime()
      )
    );
    return b;
  });

  const [from, setFrom] = useState<Dateish>(
    initialFrom ? dayStart(initialFrom as Date) : null
  );
  const [to, setTo] = useState<Dateish>(
    initialTo ? dayStart(initialTo as Date) : null
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => daysMatrix(year, month), [year, month]);

  const allowNextMonth =
    year < today.getFullYear() ||
    (year === today.getFullYear() && month < today.getMonth());

  const allowPrevMonth =
    year > minYear || (year === minYear && month > minMonth);

  const norm = useMemo((): { start: Dateish; end: Dateish } => {
    const a = from ? (from as Date) : null;
    const b = to ? (to as Date) : null;
    if (a && b) {
      return a.getTime() <= b.getTime()
        ? { start: a, end: b }
        : { start: b, end: a };
    }
    if (a && !b) return { start: a, end: null };
    return { start: null, end: null };
  }, [from, to]);

  const isFuture = (d: Date) => d.getTime() > today.getTime();
  const isBeforeMin = (d: Date) => d.getTime() < MIN_DATE.getTime();

  const isStart = (d: Date) => !!norm.start && isSameDay(d, norm.start as Date);
  const isEnd = (d: Date) => !!norm.end && isSameDay(d, norm.end as Date);
  const isInside = (d: Date) =>
    !!norm.start &&
    !!norm.end &&
    d.getTime() > (norm.start as Date).getTime() &&
    d.getTime() < (norm.end as Date).getTime();

  const pick = (d0: Date) => {
    const d = dayStart(d0);
    if (isFuture(d) || isBeforeMin(d)) return;
    if (!from || (from && to)) {
      setFrom(d);
      setTo(null);
      return;
    }
    if (from && !to && isSameDay(d, from)) return;
    setTo(d);
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [tmpMonth, setTmpMonth] = useState(month);
  const [tmpYear, setTmpYear] = useState(year);
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = today.getFullYear(); y >= minYear; y--) arr.push(y);
    return arr;
  }, [minYear, today]);

  const openWheel = () => {
    setTmpMonth(month);
    setTmpYear(year);
    setPickerOpen(true);
  };
  const applyWheel = () => {
    let y = tmpYear;
    let m = tmpMonth;
    if (y < minYear) y = minYear;
    if (y === minYear && m < minMonth) m = minMonth;
    if (y > today.getFullYear()) y = today.getFullYear();
    if (y === today.getFullYear() && m > today.getMonth()) m = today.getMonth();
    setCursor(new Date(y, m, 1));
    setPickerOpen(false);
  };

  const canApply = !!from && !!to && !isSameDay(from as Date, to as Date);

  const selectingSecond = !!from && !to;

  return (
    <View style={{ paddingHorizontal: H_PAD, paddingBottom: 8 }}>
      <View style={styles.header}>
        <Pressable
          onPress={() => allowPrevMonth && setCursor(addMonths(cursor, -1))}
          onLongPress={() =>
            allowPrevMonth && setCursor(clampToBounds(addMonths(cursor, -12)))
          }
          style={[styles.navBtn, !allowPrevMonth && { opacity: 0.4 }]}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={24} color={colors.searchTxt} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Pressable style={styles.headerChip} onPress={openWheel}>
            <Text style={[styles.chipTxt, { color: colors.searchTxt }]}>
              {MONTH_NAMES[month]}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.sub} />
          </Pressable>
          <Pressable style={styles.headerChip} onPress={openWheel}>
            <Text style={[styles.chipTxt, { color: colors.searchTxt }]}>
              {year}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.sub} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => allowNextMonth && setCursor(addMonths(cursor, +1))}
          onLongPress={() =>
            allowNextMonth && setCursor(clampToBounds(addMonths(cursor, +12)))
          }
          style={[styles.navBtn, !allowNextMonth && { opacity: 0.4 }]}
          hitSlop={8}
        >
          <Feather name="chevron-right" size={24} color={colors.searchTxt} />
        </Pressable>
      </View>

      <View
        style={[
          styles.weekRow,
          { width: CELL * 7, alignSelf: "center", marginBottom: 6 },
        ]}
      >
        {WEEK.map((w) => (
          <Text
            key={w}
            style={[styles.weekCell, { width: CELL, color: colors.sub }]}
          >
            {w}
          </Text>
        ))}
      </View>

      <View style={[styles.grid, { width: CELL * 7, alignSelf: "center" }]}>
        {cells.map(({ date, inMonth }, idx) => {
          const disabledBase = isFuture(date) || isBeforeMin(date) || !inMonth;
          const disabledSame =
            selectingSecond && from && isSameDay(date, from as Date);
          const disabled = disabledBase || disabledSame;
          const start = isStart(date);
          const end = isEnd(date);
          const inside = isInside(date);
          const isToday = isSameDay(date, today);
          const circleSize = CELL - (isTablet ? 12 : 10);
          const circleR = Math.round(circleSize / 2);

          return (
            <Pressable
              key={idx}
              onPress={() => !disabled && pick(date)}
              disabled={disabled}
              style={[
                styles.dayCell,
                { width: CELL, height: CELL, marginVertical: 3 },
                !inMonth && { opacity: 0.35 },
              ]}
            >
              {(inside || start || end) && (
                <View
                  style={[
                    styles.rangeBg,
                    { backgroundColor: colors.accent + "22" },
                    start && {
                      borderTopLeftRadius: 16,
                      borderBottomLeftRadius: 16,
                    },
                    end && {
                      borderTopRightRadius: 16,
                      borderBottomRightRadius: 16,
                    },
                    start && end && { borderRadius: 16 },
                  ]}
                />
              )}

              {(start || end) && (
                <View
                  style={{
                    position: "absolute",
                    width: circleSize,
                    height: circleSize,
                    borderRadius: circleR,
                    backgroundColor: colors.accent,
                    zIndex: 2,
                  }}
                />
              )}

              <View
                style={{
                  width: circleSize,
                  height: circleSize,
                  borderRadius: circleR,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 3,
                }}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: start || end ? colors.bg : colors.searchTxt },
                    isTablet && { fontSize: 17 },
                    disabled && !start && !end && { opacity: 0.35 },
                  ]}
                >
                  {date.getDate()}
                </Text>
                {isToday && !(start || end) && (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: colors.accent,
                      marginTop: 3,
                      opacity: disabled ? 0.35 : 1,
                    }}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.footer, { marginTop: isTablet ? 14 : 10 }]}>
        <Pressable
          style={[styles.btn, { borderColor: colors.page }]}
          onPress={() => {
            setFrom(null);
            setTo(null);
            onClear && onClear();
          }}
        >
          <Text style={[styles.btnTxt, { color: colors.searchTxt }]}>
            Сбросить
          </Text>
        </Pressable>
        <View style={{ width: 10 }} />
        <Pressable
          disabled={!canApply}
          style={[
            styles.btn,
            {
              backgroundColor: canApply ? colors.accent : colors.sub + "55",
            },
          ]}
          onPress={() => {
            if (!canApply) return;
            const A = dayStart(from as Date);
            const B = dayStart(to as Date);
            const lo = B.getTime() < A.getTime() ? B : A;
            const hi = B.getTime() < A.getTime() ? A : B;
            onApply({ from: lo, to: hi });
          }}
        >
          <Text style={[styles.btnTxt, { color: colors.bg }]}>Применить</Text>
        </Pressable>
      </View>

      {pickerOpen && (
        <View style={[styles.sheetBackdrop, { backgroundColor: "#00000066" }]}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.page, borderTopColor: colors.page },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.searchTxt }]}>
              Месяц и год
            </Text>

            <View style={styles.wheelRow}>
              <WheelPicker
                items={MONTH_NAMES}
                selectedIndex={tmpMonth}
                onChange={(i) => {
                  if (tmpYear === minYear && i < minMonth)
                    setTmpMonth(minMonth);
                  else setTmpMonth(i);
                }}
              />
              <WheelPicker
                items={years.map(String)}
                selectedIndex={years.indexOf(tmpYear)}
                onChange={(i) => {
                  const y = years[i];
                  setTmpYear(y);
                  if (y === minYear && tmpMonth < minMonth)
                    setTmpMonth(minMonth);
                  if (y === today.getFullYear() && tmpMonth > today.getMonth())
                    setTmpMonth(today.getMonth());
                }}
              />
            </View>

            <View style={styles.sheetBtns}>
              <Pressable
                style={[styles.sheetBtn, { borderColor: colors.page }]}
                onPress={() => setPickerOpen(false)}
              >
                <Text style={{ color: colors.searchTxt, fontWeight: "700" }}>
                  Отмена
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.sheetBtn,
                  { backgroundColor: colors.accent, marginLeft: 10 },
                ]}
                onPress={applyWheel}
              >
                <Text style={{ color: colors.bg, fontWeight: "800" }}>
                  Готово
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function WheelPicker({
  items,
  selectedIndex,
  onChange,
  itemHeight = 40,
  visibleCount = 5,
}: {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  itemHeight?: number;
  visibleCount?: number;
}) {
  const { colors } = useTheme();
  const snap = itemHeight;
  const halfPad = Math.floor(visibleCount / 2) * itemHeight;

  return (
    <View
      style={[
        styles.wheelWrap,
        { height: visibleCount * itemHeight, width: 140 },
      ]}
    >
      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        initialScrollIndex={selectedIndex}
        getItemLayout={(_, i) => ({
          length: itemHeight,
          offset: i * itemHeight,
          index: i,
        })}
        snapToInterval={snap}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: halfPad }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.y / itemHeight);
          const clamped = Math.max(0, Math.min(items.length - 1, i));
          onChange(clamped);
        }}
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.wheelItem,
              { height: itemHeight, justifyContent: "center" },
            ]}
          >
            <Text
              style={{
                textAlign: "center",
                fontSize: 16,
                color: index === selectedIndex ? colors.searchTxt : colors.sub,
                fontWeight: index === selectedIndex ? "800" : "600",
              }}
            >
              {item}
            </Text>
          </View>
        )}
      />
      <View
        pointerEvents="none"
        style={[
          styles.wheelHighlight,
          {
            top: (visibleCount * itemHeight) / 2 - itemHeight / 2,
            height: itemHeight,
            borderColor: colors.accent + "55",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingBottom: 6,
    paddingTop: 4,
  },
  navBtn: { padding: 8 },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    alignItems: "center",
  },
  headerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  chipTxt: { fontWeight: "800", fontSize: 15 },
  weekRow: { flexDirection: "row" },
  weekCell: { textAlign: "center", fontSize: 11, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  rangeBg: { ...StyleSheet.absoluteFillObject },
  dayText: { fontSize: 15, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "flex-end" },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnTxt: { fontSize: 14, fontWeight: "800" },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  sheetTitle: { textAlign: "center", fontSize: 16, fontWeight: "800" },
  wheelRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 6,
    marginBottom: 10,
  },
  sheetBtns: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 4,
  },
  sheetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  wheelWrap: { position: "relative", overflow: "hidden", borderRadius: 14 },
  wheelItem: { paddingHorizontal: 8 },
  wheelHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
