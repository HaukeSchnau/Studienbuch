import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { StyleSheet, Text, View } from "react-native";

import { Type } from "./Type.ts";

export interface WeekDay {
  readonly id: string;
  /** "Mo" */
  readonly name: string;
  /** "26." */
  readonly date: string;
}

export interface WeekCell {
  readonly id: string;
  readonly day: string;
  /** Index into `periods`. */
  readonly period: number;
  readonly subject: string;
  readonly slot: Tokens.SubjectSlot;
  readonly teacher: string;
  readonly change?: "Vertretung" | "Entfall";
}

const cellHeight = 64;
const rowGap = 6;

/**
 * Stand-in for "Meine Woche" (design-language.md, variant B) until M1 builds it in
 * packages/domain-ui. Today's column is tinted and its date sits in a green pill; `now` draws the
 * line through today at that point of a period.
 */
export function WeekGrid({
  days,
  periods,
  cells,
  today,
  now,
}: {
  days: ReadonlyArray<WeekDay>;
  /** Start times, such as "08:00". */
  periods: ReadonlyArray<string>;
  cells: ReadonlyArray<WeekCell>;
  today: string | undefined;
  now?: { readonly period: number; readonly fraction: number };
}) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: color.surface, borderColor: color.cardEdge, boxShadow: elevation.card },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.times} />
        {days.map((day) => {
          const isToday = day.id === today;

          return (
            <View
              key={day.id}
              style={[styles.dayHeader, isToday && { backgroundColor: color.accent }]}
            >
              <Text
                style={[
                  Type.style("footnote"),
                  { color: isToday ? color.onAccent : color.inkSoft },
                ]}
              >
                {day.name}
              </Text>
              <Text
                style={[Type.style("headline"), { color: isToday ? color.onAccent : color.ink }]}
              >
                {day.date}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        <View style={styles.times}>
          {periods.map((time) => (
            <Text key={time} style={[Type.style("caption"), styles.time, { color: color.inkSoft }]}>
              {time}
            </Text>
          ))}
        </View>
        {days.map((day) => (
          <View
            key={day.id}
            style={[styles.column, day.id === today && { backgroundColor: color.accentTint }]}
          >
            {periods.map((time, period) => {
              const cell = cells.find((each) => each.day === day.id && each.period === period);

              return cell === undefined ? (
                <View key={time} style={styles.empty} />
              ) : (
                <Cell cell={cell} key={time} />
              );
            })}
            {now !== undefined && day.id === today ? (
              <View
                style={[
                  styles.now,
                  {
                    top: now.period * (cellHeight + rowGap) + now.fraction * cellHeight,
                    backgroundColor: color.accent,
                  },
                ]}
              >
                <View style={[styles.nowDot, { backgroundColor: color.accent }]} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Cell({ cell }: { cell: WeekCell }) {
  const { color } = Theme.useTheme();

  if (cell.change === "Entfall") {
    return (
      <View
        style={[
          styles.cell,
          styles.cancelled,
          { backgroundColor: color.dangerTint, borderColor: color.danger },
        ]}
      >
        <Text style={[Type.style("caption"), styles.struck, { color: color.danger }]}>
          {cell.subject}
        </Text>
        <Text style={[Type.style("caption"), { color: color.danger }]}>Entfall</Text>
      </View>
    );
  }

  return (
    <View style={[styles.cell, { backgroundColor: Tokens.subject[cell.slot].fill }]}>
      <Text numberOfLines={1} style={[Type.style("caption"), styles.label]}>
        {cell.subject}
      </Text>
      <Text style={[Type.style("caption"), styles.teacher]}>
        {cell.change === "Vertretung" ? `⇄ ${cell.teacher}` : cell.teacher}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Tokens.radius.card,
    borderWidth: 1,
    padding: Tokens.space.sm,
    paddingTop: Tokens.space.md,
    gap: Tokens.space.sm,
  },
  row: { flexDirection: "row", gap: 4 },
  times: { width: 38, gap: rowGap },
  time: { height: cellHeight, paddingTop: 4 },
  dayHeader: {
    flex: 1,
    alignItems: "center",
    borderRadius: Tokens.radius.cell + 2,
    paddingVertical: Tokens.space.xs,
  },
  column: { flex: 1, gap: rowGap, borderRadius: Tokens.radius.cell },
  empty: { height: cellHeight },
  cell: {
    height: cellHeight,
    borderRadius: Tokens.radius.cell,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  cancelled: { borderWidth: 1.5, borderStyle: "dashed" },
  label: { color: "#FFFFFF" },
  teacher: { color: "#FFFFFF", fontWeight: "600" },
  struck: { textDecorationLine: "line-through" },
  now: { position: "absolute", left: -4, right: 0, height: 2.5 },
  nowDot: { position: "absolute", left: -4, top: -3.5, width: 9, height: 9, borderRadius: 4.5 },
});
