import { useTheme } from "@/lib/ThemeContext";
import { useI18n } from "@/lib/i18n/I18nContext";
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
type Strings = {
  weekShort: string[];
  months: string[];
  todayDot?: string;
  actions: { reset: string; apply: string; cancel: string; done: string };
  titles: { monthYear: string; range: string; single: string };
  labels: { select: string };
};
type Dateish = Date | null;
const dayStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const addMonths = (d: Date, m: number) =>
  new Date(d.getFullYear(), d.getMonth() + m, 1);
const clampMonth = (d: Date, minM: Date, maxM: Date) =>
  new Date(
    Math.max(
      monthStart(minM).getTime(),
      Math.min(monthStart(maxM).getTime(), monthStart(d).getTime())
    )
  );
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
type MonthViewProps = {
  y: number;
  m: number;
  CELL: number;
  strings: Strings;
  today: Date;
  minDate: Date;
  maxDate: Date;
  range: { start: Dateish; end: Dateish };
  selectingSecond: boolean;
  onPick: (d: Date) => void;
};
function MonthView({
  y,
  m,
  CELL,
  strings,
  today,
  minDate,
  maxDate,
  range,
  selectingSecond,
  onPick,
}: MonthViewProps) {
  const { colors } = useTheme();
  const cells = useMemo(() => daysMatrix(y, m), [y, m]);
  const isOutOfBounds = (d: Date) =>
    d.getTime() < dayStart(minDate).getTime() ||
    d.getTime() > dayStart(maxDate).getTime();
  const isStart = (d: Date) =>
    !!range.start && isSameDay(d, range.start as Date);
  const isEnd = (d: Date) => !!range.end && isSameDay(d, range.end as Date);
  const isInside = (d: Date) =>
    !!range.start &&
    !!range.end &&
    d.getTime() > (range.start as Date).getTime() &&
    d.getTime() < (range.end as Date).getTime();
  const bothSelected = !!range.start && !!range.end;
  const isValidRange =
    bothSelected && !isSameDay(range.start as Date, range.end as Date);
  const isToday = (d: Date) => isSameDay(d, today);
  return (
    <View>
      <View
        style={[
          styles.weekRow,
          { width: CELL * 7, alignSelf: "center", marginBottom: 6 },
        ]}
      >
        {strings.weekShort.map((w) => (
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
          const disabledBase = !inMonth || isOutOfBounds(date);
          const disabledSame =
            selectingSecond &&
            range.start &&
            isSameDay(date, range.start as Date);
          const disabled = disabledBase || disabledSame;
          const start = isStart(date);
          const end = isEnd(date);
          const inside = isInside(date);
          const todayHit = isToday(date);
          const circleSize = CELL - 10;
          const circleR = Math.round(circleSize / 2);
          return (
            <Pressable
              key={idx}
              onPress={() => !disabled && onPick(date)}
              disabled={disabled}
              style={[
                styles.dayCell,
                { width: CELL, height: CELL, marginVertical: 3 },
                !inMonth && { opacity: 0.35 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${date.getDate()}.${m + 1}.${y}`}
            >
              {(inside || start || end) && isValidRange && (
                <View
                  style={[
                    styles.rangeBg,
                    { backgroundColor: colors.accent + "22" },
                    start && {
                      borderTopLeftRadius: 216,
                      borderBottomLeftRadius: 216,
                    },
                    end && {
                      borderTopRightRadius: 216,
                      borderBottomRightRadius: 216,
                    },
                    start && end && { borderRadius: 216 },
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
                    { fontSize: 15, fontWeight: "700" },
                    disabled && !start && !end && { opacity: 0.35 },
                  ]}
                >
                  {date.getDate()}
                </Text>
                {todayHit && !(start || end) && (
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
    </View>
  );
}
export default function DateRangePicker({
  initialFrom,
  initialTo,
  minDate: minDateProp = new Date(2014, 5, 28),
  maxDate: maxDateProp,
  strings: stringsProp,
  onApply,
  onClear,
}: {
  initialFrom?: Dateish;
  initialTo?: Dateish;
  minDate?: Date;
  maxDate?: Date;
  strings?: Partial<Strings>;
  onApply: (range: DateRangeValue) => void;
  onClear?: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const strings: Strings = useMemo(() => {
    const base: Strings = {
      weekShort: [
        t("date.weekShort.sun"),
        t("date.weekShort.mon"),
        t("date.weekShort.tue"),
        t("date.weekShort.wed"),
        t("date.weekShort.thu"),
        t("date.weekShort.fri"),
        t("date.weekShort.sat"),
      ],
      months: [
        t("date.month.1"),
        t("date.month.2"),
        t("date.month.3"),
        t("date.month.4"),
        t("date.month.5"),
        t("date.month.6"),
        t("date.month.7"),
        t("date.month.8"),
        t("date.month.9"),
        t("date.month.10"),
        t("date.month.11"),
        t("date.month.12"),
      ],
      actions: {
        reset: t("date.actions.reset"),
        apply: t("date.actions.apply"),
        cancel: t("date.actions.cancel"),
        done: t("date.actions.done"),
      },
      titles: {
        monthYear: t("date.title.monthYear"),
        range: t("date.title.range"),
        single: t("date.title.single"),
      },
      labels: {
        select: t("date.label.select"),
      },
    };
    if (!stringsProp) return base;
    const override = stringsProp;
    return {
      ...base,
      ...override,
      actions: { ...base.actions, ...(override.actions || {}) },
      titles: { ...base.titles, ...(override.titles || {}) },
      labels: { ...base.labels, ...(override.labels || {}) },
    };
  }, [t, stringsProp]);
  const today = dayStart(new Date());
  const MAX_DATE = dayStart(maxDateProp ?? today);
  const MIN_DATE = dayStart(minDateProp);
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 720;
  const dualMode = isLandscape || isTablet;
  const GAP = 16;
  const H_PAD = 10;
  const availWidthPerMonth = dualMode
    ? Math.floor((width - H_PAD * 2 - GAP) / 2)
    : Math.floor(width - H_PAD * 2);
  const headerH = 48 + 26;
  const footerH = 52;
  const availHeightForGrid = Math.max(220, height - headerH - footerH - 80);
  const cellByWidth = Math.floor(availWidthPerMonth / 7) - 2;
  const cellByHeight = Math.floor(availHeightForGrid / 7) - 2;
  const CELL = Math.max(34, Math.min(64, Math.min(cellByWidth, cellByHeight)));
  const initBase = monthStart((initialTo ?? initialFrom ?? today) as Date);
  const [cursor, setCursor] = useState<Date>(() =>
    clampMonth(initBase, MIN_DATE, MAX_DATE)
  );
  const [from, setFrom] = useState<Dateish>(
    initialFrom ? dayStart(initialFrom as Date) : null
  );
  const [to, setTo] = useState<Dateish>(
    initialTo ? dayStart(initialTo as Date) : null
  );
  const range = useMemo((): { start: Dateish; end: Dateish } => {
    const a = from ? (from as Date) : null;
    const b = to ? (to as Date) : null;
    if (a && b)
      return a.getTime() <= b.getTime()
        ? { start: a, end: b }
        : { start: b, end: a };
    if (a && !b) return { start: a, end: null };
    return { start: null, end: null };
  }, [from, to]);
  const selectingSecond = !!from && !to;
  const clampForDual = (base: Date) => {
    const left = clampMonth(base, MIN_DATE, MAX_DATE);
    if (!dualMode) return left;
    const right = addMonths(left, 1);
    if (right.getTime() > monthStart(MAX_DATE).getTime()) {
      return clampMonth(
        addMonths(monthStart(MAX_DATE), -1),
        MIN_DATE,
        MAX_DATE
      );
    }
    if (left.getTime() < monthStart(MIN_DATE).getTime()) {
      return monthStart(MIN_DATE);
    }
    return left;
  };
  const goPrev = () => setCursor((c) => clampForDual(addMonths(c, -1)));
  const goNext = () => setCursor((c) => clampForDual(addMonths(c, +1)));
  const goPrevYear = () => setCursor((c) => clampForDual(addMonths(c, -12)));
  const goNextYear = () => setCursor((c) => clampForDual(addMonths(c, +12)));
  const canPrev = () => {
    const left = monthStart(cursor);
    return left.getTime() > monthStart(MIN_DATE).getTime();
  };
  const canNext = () => {
    const right = dualMode ? addMonths(cursor, 1) : cursor;
    return right.getTime() < monthStart(MAX_DATE).getTime();
  };
  const pick = (d0: Date) => {
    const d = dayStart(d0);
    if (d.getTime() < MIN_DATE.getTime() || d.getTime() > MAX_DATE.getTime())
      return;
    if (!from || (from && to)) {
      setFrom(d);
      setTo(null);
      return;
    }
    if (from && !to && isSameDay(d, from)) return;
    setTo(d);
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tmpMonth, setTmpMonth] = useState(cursor.getMonth());
  const [tmpYear, setTmpYear] = useState(cursor.getFullYear());
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = MIN_DATE.getFullYear(); y <= MAX_DATE.getFullYear(); y++) {
      arr.push(y);
    }
    return arr;
  }, [MIN_DATE, MAX_DATE]);
  const openYearMonthPicker = () => {
    setTmpMonth(cursor.getMonth());
    setTmpYear(cursor.getFullYear());
    setPickerOpen(true);
  };
  const isMonthDisabledForYear = (year: number, monthIdx: number) => {
    const candidate = new Date(year, monthIdx, 1);
    const min = monthStart(MIN_DATE);
    const max = monthStart(MAX_DATE);
    return (
      candidate.getTime() < min.getTime() || candidate.getTime() > max.getTime()
    );
  };
  const applyYearMonth = () => {
    let y = tmpYear;
    let m = tmpMonth;
    if (isMonthDisabledForYear(y, m)) {
      const minY = MIN_DATE.getFullYear();
      const minM = MIN_DATE.getMonth();
      const maxY = MAX_DATE.getFullYear();
      const maxM = MAX_DATE.getMonth();
      if (y < minY) y = minY;
      if (y > maxY) y = maxY;
      if (y === minY && m < minM) m = minM;
      if (y === maxY && m > maxM) m = maxM;
    }
    const base = new Date(y, m, 1);
    setCursor(clampForDual(base));
    setPickerOpen(false);
  };
  const onYearPress = (year: number) => {
    setTmpYear(year);
    const minY = MIN_DATE.getFullYear();
    const minM = MIN_DATE.getMonth();
    const maxY = MAX_DATE.getFullYear();
    const maxM = MAX_DATE.getMonth();
    let m = tmpMonth;
    if (year === minY && m < minM) m = minM;
    if (year === maxY && m > maxM) m = maxM;
    setTmpMonth(m);
  };
  const titleSingle = `${
    strings.months[cursor.getMonth()]
  } ${cursor.getFullYear()}`;
  const rightMonth = addMonths(cursor, 1);
  const titleDual = (() => {
    const lY = cursor.getFullYear();
    const rY = rightMonth.getFullYear();
    const l = strings.months[cursor.getMonth()];
    const r = strings.months[rightMonth.getMonth()];
    return lY === rY ? `${l} — ${r} ${lY}` : `${l} ${lY} — ${r} ${rY}`;
  })();
  const fmt = (d?: any) => (d ? new Date(d).toLocaleDateString() : "—");
  const rangeLabel = `${fmt(range.start)} • ${fmt(range.end)}`;
  const canApply =
    !!range.start &&
    !!range.end &&
    !isSameDay(range.start as Date, range.end as Date);
  return (
    <View style={{ paddingHorizontal: H_PAD, paddingBottom: 8 }}>
      {}
      <View style={styles.header}>
        <Pressable
          onPress={() => canPrev() && goPrev()}
          onLongPress={() => canPrev() && goPrevYear()}
          style={[styles.navBtn, !canPrev() && { opacity: 0.4 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Prev"
        >
          <Feather name="chevron-left" size={24} color={colors.searchTxt} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Pressable
            style={[
              styles.headerChip,
              { backgroundColor: colors.searchBg, borderRadius: 999 },
            ]}
            onPress={openYearMonthPicker}
            accessibilityRole="button"
          >
            <Text style={[styles.headerTitle, { color: colors.searchTxt }]}>
              {dualMode ? titleDual : titleSingle}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.sub} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => canNext() && goNext()}
          onLongPress={() => canNext() && goNextYear()}
          style={[styles.navBtn, !canNext() && { opacity: 0.4 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next"
        >
          <Feather name="chevron-right" size={24} color={colors.searchTxt} />
        </Pressable>
      </View>
      <View style={[styles.dualWrap, dualMode && { gap: GAP }]}>
        <View style={{ alignItems: "center" }}>
          <MonthView
            y={cursor.getFullYear()}
            m={cursor.getMonth()}
            CELL={CELL}
            strings={strings}
            today={today}
            minDate={MIN_DATE}
            maxDate={MAX_DATE}
            range={range}
            selectingSecond={selectingSecond}
            onPick={pick}
          />
        </View>
        {dualMode && (
          <View style={{ alignItems: "center" }}>
            <MonthView
              y={rightMonth.getFullYear()}
              m={rightMonth.getMonth()}
              CELL={CELL}
              strings={strings}
              today={today}
              minDate={MIN_DATE}
              maxDate={MAX_DATE}
              range={range}
              selectingSecond={selectingSecond}
              onPick={pick}
            />
          </View>
        )}
      </View>
      <View style={[styles.footer, { marginTop: 12 }]}>
        <Text
          style={{ flex: 1, color: colors.sub, fontSize: 12 }}
          numberOfLines={1}
          accessibilityLabel="selected-range"
        >
          {range.start || range.end ? rangeLabel : strings.titles.range}
        </Text>
        <Pressable
          style={[styles.btn, { borderColor: colors.page }]}
          onPress={() => {
            setFrom(null);
            setTo(null);
            onClear && onClear();
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.btnTxt, { color: colors.searchTxt }]}>
            {strings.actions.reset}
          </Text>
        </Pressable>
        <View style={{ width: 10 }} />
        <Pressable
          disabled={!canApply}
          style={[
            styles.btn,
            { backgroundColor: canApply ? colors.accent : colors.sub + "55" },
          ]}
          onPress={() => {
            if (!canApply) return;
            const A = dayStart(range.start as Date);
            const B = dayStart(range.end as Date);
            const lo = B.getTime() < A.getTime() ? B : A;
            const hi = B.getTime() < A.getTime() ? A : B;
            onApply({ from: lo, to: hi });
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.btnTxt, { color: colors.bg }]}>
            {strings.actions.apply}
          </Text>
        </Pressable>
      </View>
      {pickerOpen && (
        <View style={[styles.sheetBackdrop, { backgroundColor: "#00000066" }]}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.page,
                borderTopColor: colors.page,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.searchTxt }]}>
              {strings.titles.monthYear}
            </Text>
            <View style={styles.ymRow}>
              <View style={{ flex: 1, maxHeight: 260 }}>
                <Text
                  style={[
                    styles.ymLabel,
                    { color: colors.sub, marginBottom: 4 },
                  ]}
                >
                  {t("date.label.year")}
                </Text>
                <FlatList
                  data={years}
                  keyExtractor={(y) => String(y)}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const selected = item === tmpYear;
                    return (
                      <Pressable
                        onPress={() => onYearPress(item)}
                        style={[
                          styles.yearItem,
                          selected && {
                            backgroundColor: colors.accent + "22",
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: selected ? "800" : "500",
                            color: selected ? colors.accent : colors.searchTxt,
                          }}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
              <View style={{ width: 14 }} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.ymLabel,
                    { color: colors.sub, marginBottom: 4 },
                  ]}
                >
                  {t("date.label.month")}
                </Text>
                <View style={styles.monthGrid}>
                  {strings.months.map((mLabel, idx) => {
                    const disabled = isMonthDisabledForYear(tmpYear, idx);
                    const selected = idx === tmpMonth && !disabled;
                    return (
                      <Pressable
                        key={idx}
                        disabled={disabled}
                        onPress={() => !disabled && setTmpMonth(idx)}
                        style={[
                          styles.monthChip,
                          {
                            borderColor: colors.page,
                            backgroundColor: colors.searchBg,
                          },
                          selected && {
                            backgroundColor: colors.accent,
                            borderColor: colors.accent,
                          },
                          disabled && { opacity: 0.35 },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: selected ? "800" : "500",
                            textAlign: "center",
                            color: selected ? colors.bg : colors.searchTxt,
                          }}
                        >
                          {mLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
            <View style={styles.sheetBtns}>
              <Pressable
                style={[styles.sheetBtn, { borderColor: colors.page }]}
                onPress={() => setPickerOpen(false)}
              >
                <Text style={{ color: colors.searchTxt, fontWeight: "700" }}>
                  {strings.actions.cancel}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.sheetBtn,
                  { backgroundColor: colors.accent, marginLeft: 10 },
                ]}
                onPress={applyYearMonth}
              >
                <Text style={{ color: colors.bg, fontWeight: "800" }}>
                  {strings.actions.done}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
  },
  headerTitle: { fontWeight: "900", fontSize: 16, letterSpacing: 0.2 },
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
  dualWrap: { flexDirection: "row", justifyContent: "center" },
  footer: { flexDirection: "row", alignItems: "center" },
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
  ymRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 8,
  },
  ymLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  yearItem: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginTop: 4,
  },
  monthChip: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
    marginVertical: 4,
    flexBasis: "45%",
  },
});
