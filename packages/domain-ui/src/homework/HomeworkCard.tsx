import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { TickBox } from "@stu/ui/TickBox";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, View } from "react-native";

import { SubjectMark } from "../subject/SubjectMark.tsx";
import type { HomeworkItem } from "./HomeworkItem.ts";

export interface HomeworkCardProps {
  readonly item: HomeworkItem.Item;
  /** Ticks the homework done, or opens it again. */
  readonly onToggle: () => void;
}

/**
 * One homework as the Flutter app's navy card: the subject's marker and name, the title in the
 * panel's green, and the due date, red once it has passed. The box at the top right ticks it done
 * with a pen stroke that draws itself, and a second tap opens it again. Done homework and homework
 * more than a week late are greyed, as legacy greyed them.
 */
export function HomeworkCard({ item, onToggle }: HomeworkCardProps) {
  const { color } = Theme.useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: color.panelCard },
        item.dimmed ? styles.dimmed : null,
      ]}
    >
      <View style={styles.top}>
        <SubjectMark look={item.look} size={34} />
        <Pressable
          accessibilityRole="checkbox"
          aria-checked={item.done}
          accessibilityLabel={`${item.title} erledigt`}
          onPress={onToggle}
          style={({ pressed }) => [styles.tick, pressed ? styles.pressed : null]}
        >
          <TickBox checked={item.done} color={onCard} />
        </Pressable>
      </View>
      <Text
        variant="footnote"
        weight="bold"
        numberOfLines={1}
        style={[styles.subject, { color: color.panelSoft }]}
      >
        {item.subject}
      </Text>
      <Text
        variant="headline"
        weight="bold"
        numberOfLines={3}
        style={item.done ? styles.struck : { color: color.panelTitle }}
      >
        {item.title}
      </Text>
      <Text
        variant="footnote"
        weight="bold"
        style={[styles.due, { color: item.overdue ? color.panelDue : onCard }]}
      >
        {item.due}
      </Text>
    </View>
  );
}

// The card is navy in both schemes, so the pen and the plain text on it are white.
const onCard = "#FFFFFF";

// The box sits this far inside its touch target, which reaches the card's top right corner.
const inset = (Tokens.layout.minTarget - 30) / 2;

const styles = StyleSheet.create({
  // As wide as legacy's, so a phone cuts the second card off and the row shows that it scrolls.
  card: {
    width: 190,
    minHeight: 178,
    borderRadius: 26,
    paddingTop: Tokens.space.md + Tokens.space.xxs,
    paddingBottom: Tokens.space.md + Tokens.space.xxs,
    paddingLeft: Tokens.space.lg,
    paddingRight: Tokens.space.md + Tokens.space.xxs,
  },
  dimmed: { opacity: 0.55 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tick: {
    width: Tokens.layout.minTarget,
    height: Tokens.layout.minTarget,
    margin: -inset,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  pressed: { transform: [{ scale: 0.9 }] },
  subject: { marginTop: Tokens.space.sm + Tokens.space.xxs },
  struck: { color: onCard, textDecorationLine: "line-through" },
  due: { marginTop: "auto", paddingTop: Tokens.space.sm + Tokens.space.xxs },
});
