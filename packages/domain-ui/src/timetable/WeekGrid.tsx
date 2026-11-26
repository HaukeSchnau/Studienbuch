import { Card } from "@stu/ui/Card";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import type { AgendaItem } from "./AgendaItem.ts";
import { Spoken } from "./Spoken.ts";
import { StandFoot } from "./StandFoot.tsx";
import type { WeekItem } from "./WeekItem.ts";

export interface WeekGridProps {
  readonly week: WeekItem.Week;
  /**
   * Full subject names, and teacher and room on one line with the change's note under them. Phones
   * get short names and a line each (D105), which is what fits about 55 points.
   */
  readonly wide: boolean;
  /** The Stand in the card's foot, once it is old. */
  readonly stand?: AgendaItem.Stand | undefined;
  /** Opens a lesson. Without it, cells open nothing. */
  readonly onOpen?: ((id: string) => void) | undefined;
}

const minute = 60_000;

// Cells grow with the text size up to this, as their text does, so a single period keeps two lines.
const { maxScale } = Tokens.type.caption;

// A cell's lines under its top padding: the subject, then teacher and room.
const cellTop = 3;
const nameLine = Tokens.type.caption.line;
const detailLine = Tokens.type.caption2.line;

// A week without lessons still draws its closures and unpublished days this tall.
const emptyHeight = 280;

// Room above the first start and below the last end, for the first label and the cells' shadows.
const edge = 6;

// Between the card's edge and the columns.
const inset = Tokens.space.sm;

/**
 * Legacy's week: a column per day with time running down in proportion, a coloured cell per lesson,
 * today's column tinted with the line at now, and what legacy never had: the changes as notes,
 * Entfall struck in red, the school's closures and the days it hasn't published yet.
 */
export function WeekGrid({ week, wide, stand, onOpen }: WeekGridProps) {
  const { color } = Theme.useTheme();
  const scale = Math.min(Math.max(useWindowDimensions().fontScale, 1), maxScale);
  const columns = week.days.length;
  const gutter = wide ? 52 : 36;
  const hours = week.hours;

  const y = (time: number) => (hours === undefined ? 0 : ((time - hours.start) / minute) * scale);

  const height =
    hours === undefined ? emptyHeight : ((hours.end - hours.start) / minute) * scale + 2 * edge;

  const across = (from: number, to: number) => ({
    left: `${String((from / columns) * 100)}%` as const,
    width: `${String(((to - from + 1) / columns) * 100)}%` as const,
  });

  return (
    <Card>
      <View style={[styles.head, { paddingLeft: gutter + inset }]}>
        {week.days.map((day) => (
          <View
            key={day.id}
            style={[styles.day, day.today ? { backgroundColor: color.accent } : null]}
          >
            <Text
              variant="footnote"
              style={{ color: day.today ? color.onAccent : color.inkSoft }}
              numberOfLines={1}
            >
              {wide ? day.long : day.short}
            </Text>
            <Text variant="headline" style={{ color: day.today ? color.onAccent : color.ink }}>
              {day.date}
            </Text>
          </View>
        ))}
      </View>
      <View style={[styles.body, { height }]}>
        <View style={{ width: gutter }}>
          {labels(hours?.labels ?? [], y).map((time) => (
            <Text
              key={time}
              variant="caption"
              weight="semibold"
              style={[styles.label, { top: edge + y(time) - 8, color: color.inkSoft }]}
            >
              {clock(time)}
            </Text>
          ))}
        </View>
        <View style={styles.columns}>
          {(hours?.labels ?? []).map((time) => (
            <View
              key={time}
              style={[styles.line, { top: edge + y(time), backgroundColor: color.hairline }]}
            />
          ))}
          {week.days.map((day, index) =>
            day.today ? (
              <View
                key={day.id}
                style={[styles.today, across(index, index), { backgroundColor: color.accentTint }]}
              />
            ) : null,
          )}
          {week.cells.map((cell) => (
            <View
              key={cell.id}
              style={[
                styles.slot,
                {
                  top: edge + y(cell.start),
                  height: y(cell.end) - y(cell.start),
                  left: `${String(((cell.day + cell.lane / cell.lanes) / columns) * 100)}%`,
                  width: `${String((1 / columns / cell.lanes) * 100)}%`,
                },
              ]}
            >
              <LessonCell
                cell={cell}
                day={week.days[cell.day]?.long ?? ""}
                wide={wide}
                tall={y(cell.end) - y(cell.start) >= 56 * scale}
                onOpen={onOpen}
              />
            </View>
          ))}
          {week.spans.map((span) => (
            <View
              key={`${span.kind}-${String(span.from)}`}
              style={[styles.spanSlot, across(span.from, span.to)]}
            >
              <View
                accessible
                style={[
                  styles.span,
                  span.kind === "closure"
                    ? { backgroundColor: color.accentTint, borderColor: color.hairline }
                    : [styles.unpublished, { borderColor: color.inkSoft }],
                ]}
              >
                <SpanText span={span} upright={!wide && span.from === span.to} length={height} />
              </View>
            </View>
          ))}
          {week.now === undefined ? null : (
            <View
              style={[
                styles.now,
                across(week.now.day, week.now.day),
                { top: edge + y(week.now.time) - 1 },
              ]}
            >
              <View style={[styles.nowLine, { backgroundColor: color.accent }]} />
              <View style={[styles.nowDot, { backgroundColor: color.accent }]} />
            </View>
          )}
        </View>
      </View>
      {stand === undefined ? null : <StandFoot stand={stand} />}
    </Card>
  );
}

/** "08:00" */
const clock = (time: number) => {
  const minutes = Math.floor(time / minute);

  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

/** The labels that don't run into the one above, when a lesson starts minutes after another. */
const labels = (times: ReadonlyArray<number>, y: (time: number) => number) => {
  const kept: Array<number> = [];

  for (const time of times) {
    const last = kept.at(-1);

    if (last === undefined || y(time) - y(last) >= 16) kept.push(time);
  }

  return kept;
};

function LessonCell({
  cell,
  day,
  wide,
  tall,
  onOpen,
}: {
  readonly cell: WeekItem.Cell;
  readonly day: string;
  readonly wide: boolean;
  /** Room for three lines on a phone: the name, the teacher and the room. */
  readonly tall: boolean;
  readonly onOpen: ((id: string) => void) | undefined;
}) {
  const { color, subject } = Theme.useTheme();
  const off = cell.off !== undefined;
  const label = `${day}, ${Spoken.lesson(cell)}`;
  const ink = off ? color.danger : "#FFFFFF";
  const name = wide ? cell.subject : cell.short;

  // On a phone, the note covers the line that changed and says its new value.
  const changed =
    cell.teacher?.was === undefined
      ? cell.room?.was === undefined
        ? undefined
        : "room"
      : "teacher";

  const lines: ReadonlyArray<{ readonly key: string; readonly text: string }> = off
    ? [{ key: "off", text: cell.off ?? "" }]
    : wide
      ? []
      : tall
        ? [
            { key: "teacher", text: changed === "teacher" ? "" : (cell.teacher?.now ?? "") },
            { key: "room", text: changed === "room" ? "" : (cell.room?.now ?? "") },
          ]
        : [
            changed === "teacher"
              ? { key: "teacher", text: "" }
              : { key: "room", text: changed === "room" ? "" : (cell.room?.now ?? "") },
          ];

  const note =
    cell.note === undefined
      ? undefined
      : wide || changed === undefined
        ? { text: cell.note, line: undefined }
        : {
            text: (changed === "teacher" ? cell.teacher?.now : cell.room?.now) ?? cell.note,
            line: lines.findIndex(({ key }) => key === changed) + 1,
          };

  const content = (
    <>
      <View
        style={[
          styles.fill,
          off
            ? [styles.off, { backgroundColor: color.dangerTint, borderColor: color.danger }]
            : { backgroundColor: subject[cell.mark.slot].fill },
        ]}
      >
        <Text
          variant={wide ? "subhead" : "caption"}
          weight="bold"
          maxFontSizeMultiplier={maxScale}
          numberOfLines={1}
          ellipsizeMode="clip"
          style={[
            { color: ink },
            off ? [styles.struck, { textDecorationColor: color.danger }] : null,
          ]}
        >
          {name}
        </Text>
        {wide && !off ? <WideDetails cell={cell} /> : null}
        {lines.map((line) => (
          <Text
            key={line.key}
            variant="caption2"
            maxFontSizeMultiplier={maxScale}
            numberOfLines={1}
            ellipsizeMode="clip"
            style={[styles.soft, { color: ink }]}
          >
            {line.text === "" ? " " : line.text}
          </Text>
        ))}
      </View>
      {note === undefined ? null : (
        <View
          style={[
            styles.note,
            note.line === undefined
              ? styles.noteLow
              : [styles.noteOn, { top: cellTop + nameLine + (note.line - 1) * detailLine - 1 }],
            { backgroundColor: color.note },
          ]}
        >
          <Text
            variant="caption"
            maxFontSizeMultiplier={maxScale}
            numberOfLines={1}
            style={{ color: color.noteInk }}
          >
            {note.text}
          </Text>
        </View>
      )}
      {cell.homework === true ? (
        <View
          style={[styles.homework, { backgroundColor: color.action, borderColor: color.surface }]}
        />
      ) : null}
    </>
  );

  return onOpen === undefined ? (
    <View accessible accessibilityLabel={label} style={styles.cell}>
      {content}
    </View>
  ) : (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => onOpen(cell.id)}
      style={({ pressed }) => [styles.cell, styles.pressable, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

/** "Voss Brandt · A101" with the old values struck, on one line from 768 points on. */
function WideDetails({ cell }: { readonly cell: WeekItem.Cell }) {
  const parts = [cell.teacher, cell.room].flatMap((named, index) =>
    named === undefined ? [] : [{ named, key: index === 0 ? "teacher" : "room" }],
  );

  return (
    <Text
      variant="footnote"
      maxFontSizeMultiplier={maxScale}
      numberOfLines={1}
      ellipsizeMode="clip"
      style={[styles.soft, styles.onFill]}
    >
      {parts.map(({ named, key }, index) => (
        <Text key={key} variant="footnote" maxFontSizeMultiplier={maxScale} style={styles.onFill}>
          {index === 0 ? null : " · "}
          {named.was === undefined ? (
            named.now
          ) : (
            <>
              <Text
                variant="footnote"
                maxFontSizeMultiplier={maxScale}
                style={[styles.onFill, styles.struck, styles.was]}
              >
                {named.was}
              </Text>
              {named.now === "" ? null : (
                <Text
                  variant="footnote"
                  weight="bold"
                  maxFontSizeMultiplier={maxScale}
                  style={styles.onFill}
                >
                  {` ${named.now}`}
                </Text>
              )}
            </>
          )}
        </Text>
      ))}
    </Text>
  );
}

/**
 * A closure's name and last day, or "Noch nicht veröffentlicht". In a single column of a phone it
 * runs upwards along the column, which is `length` tall.
 */
function SpanText({
  span,
  upright,
  length,
}: {
  readonly span: WeekItem.Span;
  readonly upright: boolean;
  readonly length: number;
}) {
  const { color } = Theme.useTheme();

  const text =
    span.kind === "closure" ? (
      <>
        <Text variant="headline" weight="bold" style={[styles.centred, { color: color.ink }]}>
          {span.name}
        </Text>
        <Text variant="footnote" style={[styles.centred, { color: color.inkSoft }]}>
          {span.until}
        </Text>
      </>
    ) : (
      <Text variant="footnote" style={[styles.centred, { color: color.inkSoft }]}>
        Noch nicht veröffentlicht
      </Text>
    );

  // Laid out as wide as the column is tall, then turned: a turn moves nothing in the layout.
  return upright ? (
    <View style={[styles.upright, { width: length - 2 * Tokens.space.md }]}>{text}</View>
  ) : (
    text
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    paddingTop: Tokens.space.sm,
    paddingRight: inset,
    paddingBottom: Tokens.space.xs,
  },
  day: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 2,
    paddingTop: Tokens.space.xs,
    paddingBottom: 5,
    borderRadius: 14,
  },
  body: { flexDirection: "row", marginHorizontal: inset, marginBottom: Tokens.space.sm },
  label: { position: "absolute", left: 0 },
  columns: { flex: 1 },
  line: { position: "absolute", left: -4, right: 0, height: StyleSheet.hairlineWidth },
  today: { position: "absolute", top: 0, bottom: 0, borderRadius: Tokens.radius.cell },
  slot: { position: "absolute", padding: 1.5 },
  cell: { flex: 1 },
  pressable: { cursor: "pointer" },
  pressed: { opacity: 0.8 },
  fill: {
    flex: 1,
    borderRadius: Tokens.radius.cell,
    paddingTop: cellTop,
    paddingLeft: 4,
    paddingRight: 1,
    overflow: "hidden",
  },
  off: { borderWidth: 1.5, borderStyle: "dashed" },
  struck: { textDecorationLine: "line-through", textDecorationStyle: "solid" },
  soft: { opacity: 0.92 },
  onFill: { color: "#FFFFFF" },
  was: { opacity: 0.75 },
  note: {
    position: "absolute",
    paddingHorizontal: 6,
    paddingBottom: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 7,
    transform: [{ rotate: "-4deg" }],
    boxShadow: "0 2px 5px rgba(32, 55, 85, 0.22)",
  },
  noteOn: { left: 1 },
  noteLow: { right: -4, bottom: 6 },
  homework: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  spanSlot: { position: "absolute", top: 0, bottom: 0, padding: 2 },
  span: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    padding: Tokens.space.sm,
    overflow: "hidden",
  },
  unpublished: { borderStyle: "dashed" },
  centred: { textAlign: "center" },
  upright: { alignItems: "center", transform: [{ rotate: "-90deg" }] },
  now: { position: "absolute", height: 2, paddingHorizontal: 2 },
  nowLine: { flex: 1 },
  nowDot: { position: "absolute", left: -2, top: -4, width: 10, height: 10, borderRadius: 5 },
});
