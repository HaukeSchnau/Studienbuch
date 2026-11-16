import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { TickBox } from "@stu/ui/TickBox";
import { Tokens } from "@stu/ui/Tokens";
import { useKeptFocus } from "@stu/ui/useKeptFocus";
import { Pressable, StyleSheet, View } from "react-native";

import { SubjectMarker } from "../subject/SubjectMarker.tsx";
import type { HomeworkItem } from "./HomeworkItem.ts";

export interface HomeworkRowProps {
  readonly item: HomeworkItem.Item;
  readonly onToggle: (id: string, done: boolean) => void;
  readonly onOpen: (id: string) => void;
  /** Draws the hairline above the row, which the first row of a part leaves out. */
  readonly divided: boolean;
}

/**
 * One homework in the full list: the subject's blob and name in its colour, the title, and when it
 * is due. The box at the right ticks it done; the rest of the row opens the homework.
 */
export function HomeworkRow({ item, onToggle, onOpen, divided }: HomeworkRowProps) {
  const { color, subject } = Theme.useTheme();
  const { control, item: row } = useKeptFocus(item.id);

  return (
    <View
      ref={row}
      style={[styles.row, divided ? { borderTopWidth: 1, borderColor: color.hairline } : null]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.subject}: ${item.title}, ${item.due}`}
        onPress={() => onOpen(item.id)}
        style={({ pressed }) => [styles.open, pressed ? styles.pressed : null]}
      >
        <View style={item.dimmed ? styles.dimmed : null}>
          <SubjectMarker mark={item.mark} size={40} />
        </View>
        <View style={[styles.text, item.dimmed ? styles.dimmed : null]}>
          <Text
            variant="footnote"
            weight="semibold"
            numberOfLines={1}
            style={{ color: subject[item.mark.slot].text }}
          >
            {item.subject}
          </Text>
          <Text variant="headline" style={item.done ? styles.struck : null}>
            {item.title}
          </Text>
          <View style={styles.due}>
            <Text
              variant="subhead"
              weight={item.overdue ? "semibold" : undefined}
              style={{ color: item.overdue ? color.danger : color.inkSoft }}
            >
              {item.due}
            </Text>
            {item.waiting ? (
              <View style={[styles.waiting, { backgroundColor: color.warningTint }]}>
                <Icon name="cloudUp" color={color.warning} size={16} />
                <Text variant="footnote" weight="semibold" style={{ color: color.warning }}>
                  Wartet auf Netz
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={[styles.tick, item.dimmed ? styles.dimmed : null]}>
        <TickBox
          checked={item.done}
          onChange={(done) => onToggle(item.id, done)}
          label={`${item.subject}: ${item.title}`}
          color={color.ink}
          kept={control}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  open: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    paddingVertical: Tokens.space.md,
    paddingRight: Tokens.space.sm,
    cursor: "pointer",
  },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: Tokens.space.xxs },
  struck: { textDecorationLine: "line-through" },
  due: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Tokens.space.sm },
  waiting: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.xxs,
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.sm,
    paddingVertical: Tokens.space.xxs,
  },
  // As the Flutter app greyed done and long-forgotten homework.
  dimmed: { opacity: 0.55 },
  tick: { paddingHorizontal: Tokens.space.sm },
});
