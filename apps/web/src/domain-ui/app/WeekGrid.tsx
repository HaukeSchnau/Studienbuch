import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Card } from "@stu/ui/Card";
import { Text } from "@stu/ui/Text";
import { StyleSheet, View } from "react-native";

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

const cellHeight = 58;
const rowGap = Tokens.space.sm;
const columnGap = 6;

/**
 * Stand-in for "Meine Woche" (variant B) until M1 builds it in packages/domain-ui. Today's column
 * is tinted and its date sits in a green pill; `now` draws the line through today at that point of
 * a period.
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
  const { color } = Theme.useTheme();

  return (
    <Card style={styles.card}>
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
                variant="footnote"
                weight="medium"
                style={{ color: isToday ? color.onAccent : color.inkSoft }}
              >
                {day.name}
              </Text>
              <Text variant="headline" style={{ color: isToday ? color.onAccent : color.ink }}>
                {day.date}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        <View style={[styles.times, styles.column]}>
          {periods.map((time) => (
            <Text
              key={time}
              variant="caption"
              weight="medium"
              style={[styles.time, { color: color.inkSoft }]}
            >
              {time}
            </Text>
          ))}
        </View>
        {days.map((day) => (
          <View
            key={day.id}
            style={[
              styles.column,
              styles.grow,
              day.id === today && { backgroundColor: color.accentTint },
            ]}
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
    </Card>
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
        <Text variant="caption" weight="medium" style={[styles.struck, { color: color.danger }]}>
          {cell.subject}
        </Text>
        <Text variant="caption" style={{ color: color.danger }}>
          Entfall
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.cell, { backgroundColor: Tokens.subject[cell.slot].fill }]}>
      <Text numberOfLines={1} variant="caption" style={styles.onFill}>
        {cell.subject}
      </Text>
      <Text variant="caption" weight="medium" style={styles.onFillSoft}>
        {cell.change === "Vertretung" ? `⇄ ${cell.teacher}` : cell.teacher}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Tokens.space.sm, paddingTop: Tokens.space.md, gap: Tokens.space.sm },
  row: { flexDirection: "row", gap: columnGap },
  times: { width: 36 },
  column: { gap: rowGap, borderRadius: Tokens.radius.cell },
  grow: { flex: 1 },
  time: { height: cellHeight, paddingTop: Tokens.space.xs, textAlign: "right", paddingRight: 2 },
  dayHeader: {
    flex: 1,
    alignItems: "center",
    borderRadius: Tokens.radius.cell + 2,
    paddingVertical: Tokens.space.xs,
  },
  empty: { height: cellHeight },
  cell: {
    height: cellHeight,
    borderRadius: Tokens.radius.cell,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    gap: 1,
  },
  cancelled: { borderWidth: 1.5, borderStyle: "dashed" },
  onFill: { color: "#FFFFFF" },
  onFillSoft: { color: "rgba(255, 255, 255, 0.88)" },
  struck: { textDecorationLine: "line-through" },
  now: { position: "absolute", left: -3, right: 0, height: 2 },
  nowDot: { position: "absolute", left: -3, top: -3.5, width: 9, height: 9, borderRadius: 4.5 },
});
