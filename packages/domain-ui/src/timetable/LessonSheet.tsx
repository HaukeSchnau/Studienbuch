import { Button } from "@stu/ui/Button";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { useLingeringOrder } from "@stu/ui/useLingeringOrder";
import { Pressable, StyleSheet, View } from "react-native";

import { HomeworkItem } from "../homework/HomeworkItem.ts";
import { HomeworkRow } from "../homework/HomeworkRow.tsx";
import { SubjectMarker } from "../subject/SubjectMarker.tsx";
import { AgendaItem } from "./AgendaItem.ts";
import { ChangeNote } from "./ChangeNote.tsx";
import { NamedText } from "./NamedText.tsx";

export interface LessonSheetProps {
  readonly lesson: AgendaItem.Detail;
  /** The course's homework as the panel shows it. `undefined` while the notebook is locked. */
  readonly homework: ReadonlyArray<HomeworkItem.Item> | undefined;
  readonly onToggle: (id: string, done: boolean) => void;
  readonly onOpenHomework: (id: string) => void;
  /** "Hausaufgabe eintragen", due at the next lesson. Absent while the notebook is locked. */
  readonly onAdd?: (() => void) | undefined;
  readonly onClose: () => void;
}

/**
 * The lesson sheet, a tap on a lesson away: when it is, what changed with the school's phrase for
 * it, who teaches it where, the course's homework as the list's rows, and "Hausaufgabe eintragen"
 * due at the course's next lesson. It stands in for legacy's course page until Noten (M4).
 */
export function LessonSheet({
  lesson,
  homework,
  onToggle,
  onOpenHomework,
  onAdd,
  onClose,
}: LessonSheetProps) {
  const { color } = Theme.useTheme();
  const shown = useLingeringOrder(homework ?? [], (item) => item.id, HomeworkItem.linger);

  return (
    <View style={styles.sheet}>
      <View style={styles.head}>
        <SubjectMarker mark={lesson.mark} size={44} />
        <Text variant="title2" accessibilityRole="header" style={styles.title}>
          <Text
            variant="title2"
            style={
              lesson.off === undefined
                ? undefined
                : [styles.struck, { textDecorationColor: color.danger }]
            }
          >
            {lesson.subject}
          </Text>
          {lesson.off === undefined ? null : (
            <Text variant="headline" weight="bold" style={{ color: color.danger }}>
              {`  ${lesson.off}`}
            </Text>
          )}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Schließen"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
        >
          <Icon name="cross" color={color.inkSoft} />
        </Pressable>
      </View>
      <Text variant="callout" style={{ color: color.inkSoft }}>
        {lesson.when}
      </Text>
      {lesson.note === undefined ? null : <ChangeNote text={lesson.note} style={styles.note} />}
      {lesson.phrase === undefined ? null : <Text variant="callout">{lesson.phrase}</Text>}
      <View>
        <Fact label="Lehrkraft" named={lesson.teacher} />
        <Fact label="Raum" named={lesson.room} />
      </View>
      <View>
        <Text
          variant="headline"
          weight="bold"
          accessibilityRole="header"
          aria-level={2}
          style={styles.section}
        >
          {`Hausaufgaben in ${lesson.subject}`}
        </Text>
        {homework === undefined ? (
          <Text variant="subhead" style={{ color: color.inkSoft }}>
            {HomeworkItem.locked.text}
          </Text>
        ) : shown.length === 0 ? (
          <Text variant="subhead" style={{ color: color.inkSoft }}>
            Keine Hausaufgaben offen.
          </Text>
        ) : (
          shown.map((item, index) => (
            <HomeworkRow
              key={item.id}
              item={item}
              onToggle={onToggle}
              onOpen={onOpenHomework}
              divided={index > 0}
            />
          ))
        )}
      </View>
      {onAdd === undefined ? null : (
        <View style={styles.add}>
          <Button block icon="plus" label="Hausaufgabe eintragen" onPress={onAdd} />
          <Text variant="footnote" style={[styles.due, { color: color.inkSoft }]}>
            {lesson.due}
          </Text>
        </View>
      )}
    </View>
  );
}

/** "Lehrkraft" with the teacher, the one before a change struck through. Absent without one. */
function Fact({
  label,
  named,
}: {
  readonly label: string;
  readonly named: AgendaItem.Named | undefined;
}) {
  const { color } = Theme.useTheme();

  if (named === undefined) return null;

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${AgendaItem.spoken(named)}`}
      style={[styles.fact, { borderTopColor: color.hairline }]}
    >
      <Text variant="callout" style={{ color: color.inkSoft }}>
        {label}
      </Text>
      <Text variant="callout" style={styles.factValue}>
        <NamedText named={named} variant="callout" />
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: Tokens.space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: Tokens.space.md },
  title: { flex: 1, minWidth: 0 },
  struck: { textDecorationLine: "line-through", textDecorationStyle: "solid" },
  close: {
    width: 44,
    height: 44,
    marginRight: -Tokens.space.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Tokens.radius.pill,
    cursor: "pointer",
  },
  pressed: { opacity: 0.6 },
  note: {
    alignSelf: "flex-start",
    marginVertical: Tokens.space.xs,
    transform: [{ rotate: "-1.5deg" }],
  },
  fact: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Tokens.space.md,
    paddingVertical: Tokens.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  factValue: { flexShrink: 1, textAlign: "right" },
  section: { marginTop: Tokens.space.md, marginBottom: Tokens.space.xs },
  add: { gap: Tokens.space.xs, marginTop: Tokens.space.lg },
  due: { textAlign: "center" },
});
