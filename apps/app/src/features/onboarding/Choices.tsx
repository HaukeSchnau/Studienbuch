import { SubjectMark } from "@stu/domain-ui/subject/SubjectMark";
import { Checkable } from "@stu/ui/Checkable";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { StyleSheet, View } from "react-native";

import { Onboarding } from "./Onboarding.ts";

export interface CourseTilesProps {
  readonly groups: ReadonlyArray<Onboarding.ElectiveGroup>;
  readonly chosen: ReadonlySet<string>;
  readonly onPress: (group: Onboarding.ElectiveGroup, elective: Onboarding.Elective) => void;
}

/**
 * The elective courses as the Flutter app's subject tiles, two to a row: green with the course's
 * name once chosen, grey with "(nicht belegt)" otherwise. A course of its own is a box to tick. A
 * group of several, such as Kunst and Musik, is one choice under its name ("Kunst oder Musik").
 */
export function CourseTiles({ groups, chosen, onPress }: CourseTilesProps) {
  const { color } = Theme.useTheme();
  const single = groups.filter((group) => group.electives.length === 1);
  const several = groups.filter((group) => group.electives.length > 1);

  const tile = (group: Onboarding.ElectiveGroup, elective: Onboarding.Elective) => (
    <CourseTile
      key={elective.courseId}
      kind={group.electives.length === 1 ? "checkbox" : "radio"}
      elective={elective}
      on={chosen.has(elective.courseId)}
      onPress={() => onPress(group, elective)}
    />
  );

  return (
    <>
      {single.length === 0 ? null : (
        <View style={styles.tiles}>
          {single.flatMap((group) => group.electives.map((elective) => tile(group, elective)))}
        </View>
      )}
      {several.map((group) => (
        <View
          key={group.key}
          style={styles.group}
          accessibilityRole="radiogroup"
          aria-label={Onboarding.groupLabel(group)}
        >
          <View>
            <Text variant="subhead" weight="medium" style={[styles.label, { color: color.ink }]}>
              {Onboarding.groupLabel(group)}
            </Text>
            <Text variant="footnote" style={{ color: color.inkSoft }}>
              {hint(group)}
            </Text>
          </View>
          <View style={styles.tiles}>
            {group.electives.map((elective) => tile(group, elective))}
          </View>
        </View>
      ))}
    </>
  );
}

const hint = (group: Onboarding.ElectiveGroup) =>
  `Wähle ${group.required ? "" : "höchstens "}eins ${group.electives.length === 2 ? "der beiden" : "dieser"} Fächer.`;

function CourseTile({
  kind,
  elective,
  on,
  onPress,
}: {
  readonly kind: "checkbox" | "radio";
  readonly elective: Onboarding.Elective;
  readonly on: boolean;
  readonly onPress: () => void;
}) {
  const { color, subject } = Theme.useTheme();

  const { slot } = Option.match(elective.subject, {
    onNone: () => SubjectMark.ofCourse(elective.course),
    onSome: SubjectMark.ofSubject,
  });

  const short = Option.match(elective.subject, {
    onNone: () => elective.course.slice(0, 2).toUpperCase(),
    onSome: (each) => each.shortName,
  });

  return (
    <Checkable
      kind={kind}
      checked={on}
      onPress={onPress}
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
    </Checkable>
  );
}

const styles = StyleSheet.create({
  group: { gap: Tokens.space.sm },
  label: { fontSize: 14, lineHeight: 20 },
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
