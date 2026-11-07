import { SubjectColor } from "@stu/domain-ui/subject/SubjectColor";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { Pressable, StyleSheet, View } from "react-native";

import { Onboarding } from "./Onboarding.ts";

export interface PillChoiceProps<A extends string | number> {
  readonly label: string;
  readonly options: ReadonlyArray<{ readonly value: A; readonly label: string }>;
  readonly value: Option.Option<A>;
  readonly onChange: (value: A) => void;
}

/**
 * One of a few values, such as the Jahrgang or the Klasse: the old web's grey pills in a row, the
 * chosen one green. With at most a dozen options, every one stays in view.
 */
export function PillChoice<A extends string | number>({
  label,
  options,
  value,
  onChange,
}: PillChoiceProps<A>) {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.field} accessibilityRole="radiogroup" aria-label={label}>
      <Text variant="subhead" weight="medium" style={[styles.label, { color: color.ink }]}>
        {label}
      </Text>
      <View style={styles.pills}>
        {options.map((option) => {
          const chosen = Option.contains(value, option.value);

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              aria-checked={chosen}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: chosen ? color.accent : color.fieldFill },
                pressed ? styles.pressed : null,
              ]}
            >
              <Text
                variant="callout"
                weight={chosen ? "semibold" : "regular"}
                style={{ color: chosen ? color.onAccent : color.ink }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export interface CourseTilesProps {
  readonly electives: ReadonlyArray<Onboarding.Elective>;
  readonly chosen: ReadonlySet<string>;
  readonly onToggle: (elective: Onboarding.Elective) => void;
}

/**
 * The elective courses as the Flutter app's subject tiles, two to a row: green with the course's
 * name once chosen, grey with "(nicht belegt)" otherwise.
 */
export function CourseTiles({ electives, chosen, onToggle }: CourseTilesProps) {
  const { color, subject } = Theme.useTheme();

  return (
    <View style={styles.tiles}>
      {electives.map((elective) => {
        const on = chosen.has(elective.courseId);

        const slot = Option.match(elective.subject, {
          onNone: () => SubjectColor.ofCourse(elective.course),
          onSome: SubjectColor.ofSubject,
        });

        const short = Option.match(elective.subject, {
          onNone: () => elective.course.slice(0, 2).toUpperCase(),
          onSome: (each) => each.shortName,
        });

        return (
          <Pressable
            key={elective.courseId}
            accessibilityRole="checkbox"
            aria-checked={on}
            onPress={() => onToggle(elective)}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: on ? color.accent : color.fieldFill },
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={[styles.badge, { backgroundColor: subject[slot].fill }]}>
              <Text variant="caption" style={styles.badgeText}>
                {short}
              </Text>
            </View>
            <View style={styles.tileText}>
              <Text
                variant="subhead"
                weight="semibold"
                numberOfLines={1}
                style={{ color: on ? color.onAccent : color.ink }}
              >
                {Onboarding.label(elective)}
              </Text>
              <Text
                variant="footnote"
                weight="regular"
                numberOfLines={2}
                style={[styles.course, { color: on ? color.onAccent : color.inkSoft }]}
              >
                {on ? elective.course : "(nicht belegt)"}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Tokens.space.sm },
  label: { fontSize: 14, lineHeight: 20 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: Tokens.space.sm },
  pill: {
    minWidth: Tokens.layout.minTarget,
    minHeight: Tokens.layout.minTarget,
    paddingHorizontal: 20,
    borderRadius: Tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  // The Flutter app's grid: two columns 16 apart, each tile half as high as it is wide.
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: Tokens.space.lg },
  tile: {
    flexBasis: "45%",
    flexGrow: 1,
    minHeight: 64,
    borderRadius: 24,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.sm,
    cursor: "pointer",
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: Tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF" },
  tileText: { flex: 1 },
  // The Flutter tile's small second line: the course, or that it isn't taken.
  course: { fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.7 },
});
