import { Card } from "@stu/ui/Card";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, View } from "react-native";

import { SubjectMarker } from "../subject/SubjectMarker.tsx";
import { AgendaItem } from "./AgendaItem.ts";
import { ChangeNote } from "./ChangeNote.tsx";
import { NamedText } from "./NamedText.tsx";

export interface AgendaCardProps {
  readonly items: ReadonlyArray<AgendaItem.Item>;
  /** In place of the rows, such as when school resumes after the holidays. */
  readonly notice?: AgendaItem.Notice | undefined;
  /** The Stand in the card's foot, once it is old. */
  readonly stand?: AgendaItem.Stand | undefined;
  /** Opens a lesson. Without it, rows open nothing and show no chevron. */
  readonly onOpen?: ((id: string) => void) | undefined;
}

/**
 * Legacy's "Das steht heute an:" card: a row per lesson with its subject's marker, past lessons
 * dimmed with a tick, the running one green with the minutes left, a yellow note on a change,
 * Entfall struck through in red (D76), and a navy pill on a lesson with homework due.
 */
export function AgendaCard({ items, notice, stand, onOpen }: AgendaCardProps) {
  const { color } = Theme.useTheme();

  return (
    <Card>
      {items.map((item, index) => (
        <View
          key={item.id}
          style={index === 0 ? undefined : [styles.divider, { borderTopColor: color.hairline }]}
        >
          {item.kind === "free" ? (
            <View accessible style={[styles.row, styles.free]}>
              <Text variant="footnote" style={{ color: color.inkSoft }}>
                {item.time}
              </Text>
              <Text
                variant="title3"
                weight="medium"
                style={[styles.italic, { color: color.inkSoft }]}
              >
                Freistunde
              </Text>
            </View>
          ) : (
            <Lesson lesson={item} onOpen={onOpen} />
          )}
        </View>
      ))}
      {notice === undefined ? null : (
        <View accessible style={styles.notice}>
          {notice.title === undefined ? null : (
            <Text variant="headline" weight="bold" style={{ color: color.ink }}>
              {notice.title}
            </Text>
          )}
          {notice.lines.map((line) => (
            <Text key={line} variant="callout" style={{ color: color.inkSoft }}>
              {line}
            </Text>
          ))}
        </View>
      )}
      {stand === undefined ? null : (
        <View
          accessible
          accessibilityLiveRegion="polite"
          style={[styles.stand, { backgroundColor: color.warningTint }]}
        >
          <Icon name="clock" color={color.warning} size={18} />
          <View style={styles.grow}>
            <Text variant="footnote" weight="bold" style={{ color: color.warning }}>
              {stand.title}
            </Text>
            <Text variant="footnote" style={{ color: color.ink }}>
              {stand.hint}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}

type LessonItem = Extract<AgendaItem.Item, { readonly kind: "lesson" }>;

const homeworkOpen = "Hausaufgabe offen";

const labelOf = (lesson: LessonItem) =>
  [
    lesson.subject,
    lesson.time.replace("–", " bis "),
    ...(lesson.off === undefined ? [] : [lesson.off]),
    ...(lesson.note === undefined ? [] : [lesson.note]),
    ...[lesson.teacher, lesson.room].flatMap((named) =>
      named === undefined ? [] : [AgendaItem.spoken(named)],
    ),
    ...(lesson.homework === true ? [homeworkOpen] : []),
    ...(lesson.phase === "past" ? ["vorbei"] : []),
    ...(lesson.remaining === undefined ? [] : [lesson.remaining]),
  ].join(", ");

function Lesson({
  lesson,
  onOpen,
}: {
  readonly lesson: LessonItem;
  readonly onOpen: ((id: string) => void) | undefined;
}) {
  const { color } = Theme.useTheme();
  const past = lesson.phase === "past";
  const running = lesson.phase === "now";

  const details = [lesson.teacher, lesson.room].flatMap((named) =>
    named === undefined ? [] : [named],
  );

  const content = (
    <>
      <View style={past ? styles.dim : undefined}>
        <SubjectMarker mark={lesson.mark} size={40} />
      </View>
      <View style={[styles.text, past ? styles.dim : null]}>
        {running && lesson.remaining !== undefined ? (
          <View style={styles.running}>
            <View style={[styles.dot, { backgroundColor: color.accent }]} />
            <Text variant="footnote" style={{ color: color.ink }}>
              {lesson.remaining}
            </Text>
          </View>
        ) : (
          <Text variant="footnote" style={{ color: color.inkSoft }}>
            {lesson.time}
          </Text>
        )}
        <Text variant="title3" style={{ color: color.accent }}>
          <Text
            variant="title3"
            style={
              lesson.off === undefined
                ? undefined
                : [styles.struck, { textDecorationColor: color.danger }]
            }
          >
            {lesson.subject}
          </Text>
          {lesson.off === undefined ? null : (
            <Text variant="subhead" weight="bold" style={{ color: color.danger }}>
              {`  ${lesson.off}`}
            </Text>
          )}
        </Text>
        {details.length === 0 ? null : (
          <Text variant="subhead" style={{ color: color.inkSoft }}>
            {details.map((named, index) => (
              <Text key={index === 0 ? "teacher" : "room"} variant="subhead">
                {index === 0 ? null : " · "}
                <NamedText named={named} />
              </Text>
            ))}
          </Text>
        )}
        {lesson.homework === true ? (
          <View style={[styles.pill, { backgroundColor: color.homework }]}>
            <Icon name="book" color={color.onHomework} size={14} />
            <Text variant="caption" weight="bold" style={{ color: color.onHomework }}>
              {homeworkOpen}
            </Text>
          </View>
        ) : null}
      </View>
      {past ? (
        <Icon color={color.accent} name="check" />
      ) : onOpen === undefined ? null : (
        <Icon color={color.inkSoft} name="chevron" />
      )}
      {lesson.note === undefined ? null : <ChangeNote text={lesson.note} style={styles.note} />}
    </>
  );

  const tint = running ? { backgroundColor: color.accentTint } : null;

  return onOpen === undefined ? (
    <View accessible accessibilityLabel={labelOf(lesson)} style={[styles.row, tint]}>
      {content}
    </View>
  ) : (
    <Pressable
      accessibilityLabel={labelOf(lesson)}
      accessibilityRole="button"
      onPress={() => onOpen(lesson.id)}
      style={({ pressed }) => [
        styles.row,
        styles.pressable,
        tint,
        pressed ? { backgroundColor: color.accentTint } : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    minHeight: 76,
    paddingVertical: Tokens.space.md,
    paddingLeft: 14,
    paddingRight: Tokens.space.lg,
  },
  // Lined up with the lessons' text, past their markers.
  free: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 0,
    minHeight: 64,
    paddingLeft: 66,
  },
  italic: { fontStyle: "italic" },
  pressable: { cursor: "pointer" },
  text: { flex: 1, minWidth: 0, gap: 1 },
  dim: { opacity: 0.5 },
  running: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  struck: { textDecorationLine: "line-through", textDecorationStyle: "solid" },
  note: {
    position: "absolute",
    top: Tokens.space.sm,
    right: 46,
    transform: [{ rotate: "-3deg" }],
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: Tokens.space.xs,
    paddingLeft: 7,
    paddingRight: 9,
    paddingVertical: 3,
    borderRadius: Tokens.radius.pill,
  },
  notice: {
    gap: Tokens.space.xs,
    paddingHorizontal: Tokens.layout.cardPadding,
    paddingVertical: Tokens.space.lg,
  },
  stand: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Tokens.space.sm,
    paddingHorizontal: Tokens.layout.cardPadding,
    paddingTop: 10,
    paddingBottom: Tokens.space.md,
  },
  grow: { flex: 1 },
});
