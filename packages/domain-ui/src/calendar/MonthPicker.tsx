import type { CivilTime } from "@stu/core";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Arr from "effect/Array";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";

import { DateText } from "./DateText.ts";
import { Pickable } from "./Pickable.ts";

declare module "react-native" {
  // react-native-web writes them to the DOM; native ignores them.
  interface AccessibilityProps {
    readonly "aria-pressed"?: boolean | undefined;
    readonly "aria-current"?: "date" | undefined;
  }
}

export interface MonthPickerProps {
  readonly value: CivilTime.PlainDate | null;
  readonly onChange: (date: CivilTime.PlainDate) => void;
  /** The days that can be picked. The others show greyed out. */
  readonly days: Pickable.Days;
  readonly today: CivilTime.PlainDate;
}

/**
 * A month of days to pick one from, Monday first, as the Flutter app's date picker showed it. Our
 * own on every platform, so the sheet looks and behaves the same on iOS, Android and the web.
 */
export function MonthPicker({ value, onChange, days, today }: MonthPickerProps) {
  const { color } = Theme.useTheme();
  const { month, previous, next } = useShownMonth(value ?? days.range.start, Pickable.reach(days));

  return (
    <View style={styles.picker}>
      <View style={styles.head}>
        <Step label="Voriger Monat" icon="back" onPress={previous} />
        <Text variant="headline" weight="bold" accessibilityLiveRegion="polite">
          {`${DateText.month(month)} ${String(month.year)}`}
        </Text>
        <Step label="Nächster Monat" icon="chevron" onPress={next} />
      </View>
      <View style={styles.week}>
        {weekdays.map((day) => (
          <Text key={day} variant="footnote" style={[styles.weekday, { color: color.inkSoft }]}>
            {day}
          </Text>
        ))}
      </View>
      {weeks(month).map((week) => (
        <View key={PlainDateFns.toString(week[0])} style={styles.week}>
          {week.map((day) => {
            const key = PlainDateFns.toString(day);

            if (day.month !== month.month) return <View key={key} style={styles.cell} />;

            const enabled = Pickable.contains(days, day);
            const selected = value !== null && PlainDateFns.equals(day, value);
            const isToday = PlainDateFns.equals(day, today);

            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={DateText.full(day, today)}
                // The browser announces a pressed button and today's date; VoiceOver and TalkBack
                // read `aria-selected`, which the browser ignores on a button.
                aria-pressed={selected}
                aria-current={isToday ? "date" : undefined}
                aria-selected={selected}
                disabled={!enabled}
                onPress={() => onChange(day)}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.day,
                    selected
                      ? { backgroundColor: color.accent }
                      : isToday
                        ? { borderWidth: 1.5, borderColor: color.accent }
                        : null,
                  ]}
                >
                  <Text
                    variant="callout"
                    weight={selected || isToday ? "bold" : undefined}
                    style={{
                      color: selected ? color.onAccent : enabled ? color.ink : color.inkSoft,
                      opacity: enabled ? 1 : 0.45,
                    }}
                  >
                    {String(day.day)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * The month the picker shows, from the one holding `start`, and the steps to the months before and
 * after it as far as `range` reaches. It doesn't follow `start` once shown, so picking a day keeps
 * the month in place.
 */
export function useShownMonth(start: CivilTime.PlainDate, range: CivilTime.DateRange) {
  const [month, setMonth] = useState(() => PlainDateFns.startOfMonth(start));
  const first = PlainDateFns.startOfMonth(range.start);
  const last = PlainDateFns.startOfMonth(range.end);

  return {
    month,
    previous:
      PlainDateFns.compare(month, first) > 0
        ? () => setMonth(PlainDateFns.subtractMonths(month, 1))
        : undefined,
    next:
      PlainDateFns.compare(month, last) < 0
        ? () => setMonth(PlainDateFns.addMonths(month, 1))
        : undefined,
  };
}

const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** The weeks that touch the month, Monday to Sunday. Days of the months around it fill the edges. */
const weeks = (month: CivilTime.PlainDate) => {
  const start = PlainDateFns.startOfWeek(month);
  const end = PlainDateFns.endOfMonth(month);
  const count = Math.ceil((PlainDateFns.diffDays(start, end) + 1) / 7);

  return Arr.makeBy(count, (week) =>
    Arr.makeBy(7, (day) => PlainDateFns.addDays(start, week * 7 + day)),
  );
};

function Step({
  label,
  icon,
  onPress,
}: {
  readonly label: string;
  readonly icon: "back" | "chevron";
  /** Absent at the edge of the range. */
  readonly onPress: (() => void) | undefined;
}) {
  const { color } = Theme.useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        { opacity: onPress === undefined ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      <Icon name={icon} color={color.ink} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  picker: { gap: Tokens.space.xxs },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Tokens.space.xs,
  },
  step: {
    width: Tokens.layout.minTarget,
    height: Tokens.layout.minTarget,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  week: { flexDirection: "row" },
  cell: { flex: 1, height: 44, alignItems: "center", justifyContent: "center" },
  weekday: { flex: 1, textAlign: "center" },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
