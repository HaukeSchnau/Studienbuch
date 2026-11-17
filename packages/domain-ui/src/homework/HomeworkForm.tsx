import { Homework, type CivilTime } from "@stu/core";
import { Button } from "@stu/ui/Button";
import { Checkable } from "@stu/ui/Checkable";
import { Field } from "@stu/ui/Field";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { useRefocus } from "@stu/ui/useRefocus";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { DateText } from "../calendar/DateText.ts";
import { MonthPicker } from "../calendar/MonthPicker.tsx";
import type { Pickable } from "../calendar/Pickable.ts";
import { SubjectMarker } from "../subject/SubjectMarker.tsx";
import type { SubjectMark } from "../subject/SubjectMark.ts";

/** What the student has typed and picked so far. */
export interface Values {
  readonly courseId: string | null;
  readonly title: string;
  readonly description: string;
  readonly dueOn: CivilTime.PlainDate | null;
}

/** What one input changes. A field once picked is never emptied again, so no value is `null`. */
export type Change = Partial<{
  readonly courseId: string;
  readonly title: string;
  readonly description: string;
  readonly dueOn: CivilTime.PlainDate;
}>;

/** A course to pick as Fach, named and marked by its subject. */
export interface CourseChoice {
  readonly id: string;
  readonly subject: string;
  readonly mark: SubjectMark.Mark;
}

export interface HomeworkFormProps {
  /** "Hausaufgabe hinzufügen" or "Hausaufgabe bearbeiten". */
  readonly heading: string;
  readonly values: Values;
  /** The fields the student just changed. */
  readonly onChange: (changes: Change) => void;
  readonly choices: ReadonlyArray<CourseChoice>;
  /** The due dates the calendar offers. */
  readonly days: Pickable.Days;
  readonly today: CivilTime.PlainDate;
  /** "Speichern" stays disabled until the values decode. */
  readonly canSave: boolean;
  /** Why this device refused the last save, as a sentence. */
  readonly problem?: string | undefined;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

/**
 * The Flutter app's add sheet: Fach, Titel, Beschreibung, Abgabetermin and "Speichern". Fach is a
 * chip per course in its subject's colours rather than legacy's dropdown (D73).
 */
export function HomeworkForm({
  heading,
  values,
  onChange,
  choices,
  days,
  today,
  canSave,
  problem,
  onSave,
  onCancel,
}: HomeworkFormProps) {
  const { color } = Theme.useTheme();
  const calendar = useCalendarOpen();
  const { ref: dateButton, refocus: backToDate } = useRefocus();
  const set = onChange;

  return (
    <View style={styles.form}>
      <Text variant="title2" accessibilityRole="header" style={{ color: color.accent }}>
        {heading}
      </Text>
      <View style={styles.part}>
        <Text variant="subhead" weight="bold" nativeID="homework-course">
          Fach:
        </Text>
        {choices.length === 0 ? (
          <Text variant="callout" style={{ color: color.inkSoft }}>
            Du hast in diesem Halbjahr noch keine Kurse gewählt.
          </Text>
        ) : (
          <View
            style={styles.chips}
            accessibilityRole="radiogroup"
            aria-labelledby="homework-course"
          >
            {choices.map((choice) => (
              <Chip
                key={choice.id}
                choice={choice}
                selected={choice.id === values.courseId}
                onPress={() => set({ courseId: choice.id })}
              />
            ))}
          </View>
        )}
      </View>
      <Field
        pill
        label="Titel"
        value={values.title}
        onChangeText={(title) => set({ title })}
        maxLength={Homework.titleMaxLength}
        returnKeyType="next"
      />
      <Field
        pill
        multiline
        label="Beschreibung"
        value={values.description}
        onChangeText={(description) => set({ description })}
        // A longer text from another device still opens whole; the form counts to legacy's 500.
        maxLength={Math.max(descriptionLimit, values.description.length)}
        counter={{ count: values.description.length, limit: descriptionLimit }}
        inputStyle={styles.description}
      />
      <View style={[styles.part, styles.divided, { borderColor: color.hairline }]}>
        <View style={styles.due}>
          <Text variant="callout">Abgabetermin:</Text>
          <Pressable
            ref={dateButton}
            accessibilityRole="button"
            accessibilityLabel={
              values.dueOn === null
                ? "Abgabetermin wählen"
                : `Abgabetermin: ${DateText.full(values.dueOn, today)}`
            }
            aria-expanded={calendar.open}
            onPress={calendar.toggle}
            style={({ pressed }) => [
              styles.date,
              { borderColor: color.accent },
              pressed ? styles.pressed : null,
            ]}
          >
            <Icon name="calendar" color={color.accent} size={20} />
            <Text variant="callout" weight="bold" style={{ color: color.accent }}>
              {values.dueOn === null ? "Datum wählen" : short(values.dueOn)}
            </Text>
          </Pressable>
        </View>
        {calendar.open ? (
          <MonthPicker
            value={values.dueOn}
            onChange={(dueOn) => {
              set({ dueOn });
              // The picked day unmounts with the calendar, and its focus would fall to the page.
              backToDate();
              calendar.close();
            }}
            days={days}
            today={today}
          />
        ) : null}
      </View>
      {problem === undefined ? null : (
        <View role="alert" style={[styles.problem, { backgroundColor: color.dangerTint }]}>
          <Icon name="alertCircle" color={color.danger} size={22} />
          <Text variant="callout" style={[styles.shrink, { color: color.danger }]}>
            {problem}
          </Text>
        </View>
      )}
      <View style={styles.actions}>
        <Button small kind="secondary" label="Abbrechen" onPress={onCancel} />
        <Button small kind="action" label="Speichern" disabled={!canSave} onPress={onSave} />
      </View>
    </View>
  );
}

/**
 * Whether the calendar under "Abgabetermin" shows. It starts closed, as legacy's button did, and a
 * picked day closes it.
 */
export function useCalendarOpen() {
  const [open, setOpen] = useState(false);

  return { open, toggle: () => setOpen(!open), close: () => setOpen(false) };
}

// Legacy's count. Core takes up to 4,000, so a longer text from elsewhere still saves (m1-screens.md).
const descriptionLimit = 500;

/** "Fr, 20.11.2026", as legacy's button showed the date. */
const short = (date: CivilTime.PlainDate) =>
  `${DateText.shortWeekday(date)}, ${String(date.day).padStart(2, "0")}.${String(date.month).padStart(2, "0")}.${String(date.year)}`;

function Chip({
  choice,
  selected,
  onPress,
}: {
  readonly choice: CourseChoice;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const { subject } = Theme.useTheme();
  const colors = subject[choice.mark.slot];

  return (
    <Checkable
      kind="radio"
      checked={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.fill : colors.tint,
          borderColor: selected ? colors.fill : "transparent",
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <SubjectMarker mark={choice.mark} size={26} />
      <Text variant="callout" weight="bold" style={{ color: selected ? "#FFFFFF" : colors.text }}>
        {choice.subject}
      </Text>
      {selected ? <Icon name="check" color="#FFFFFF" size={18} /> : null}
    </Checkable>
  );
}

const styles = StyleSheet.create({
  form: { gap: Tokens.space.lg },
  part: { gap: Tokens.space.sm },
  divided: { borderTopWidth: 1, paddingTop: Tokens.space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Tokens.space.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.xs,
    borderRadius: Tokens.radius.pill,
    borderWidth: 2,
    paddingLeft: Tokens.space.xs,
    paddingRight: Tokens.space.md,
    cursor: "pointer",
  },
  pressed: { opacity: 0.7 },
  description: { borderRadius: Tokens.radius.card },
  due: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Tokens.space.md },
  date: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.sm,
    minHeight: Tokens.layout.minTarget,
    borderWidth: 1.5,
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.lg,
    cursor: "pointer",
  },
  problem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.sm,
    borderRadius: Tokens.radius.field,
    padding: Tokens.space.md,
  },
  shrink: { flexShrink: 1 },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Tokens.space.sm,
    marginTop: Tokens.space.xs,
  },
});
