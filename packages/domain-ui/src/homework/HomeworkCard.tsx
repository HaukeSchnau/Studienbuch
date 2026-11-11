import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { TickBox } from "@stu/ui/TickBox";
import { Tokens } from "@stu/ui/Tokens";
import { useLaggedToggle } from "@stu/ui/useLaggedToggle";
import { useReducedMotion } from "@stu/ui/useReducedMotion";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { SubjectMarker } from "../subject/SubjectMarker.tsx";
import type { HomeworkItem } from "./HomeworkItem.ts";

export interface HomeworkCardProps {
  readonly item: HomeworkItem.Item;
  /** Ticks the homework done, or opens it again. */
  readonly onToggle: (id: string, done: boolean) => void;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * One homework as the Flutter app's navy card on the blue panel: the subject with its blob, the
 * title in green, and when it is due. The box at the top right ticks it done with a pen stroke.
 */
export function HomeworkCard({ item, onToggle, style }: HomeworkCardProps) {
  const { color } = Theme.useTheme();
  const still = useReducedMotion();

  // The tick draws in place before the card moves to the done ones.
  const done = useLaggedToggle(item.done, (checked) => onToggle(item.id, checked), still ? 0 : 450);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: color.panelCard },
        done.checked || (item.dimmed && !item.done) ? styles.dimmed : null,
        style,
      ]}
    >
      <View style={styles.top}>
        <SubjectMarker mark={item.mark} size={34} />
        <TickBox
          checked={done.checked}
          onChange={done.toggle}
          label={`${item.subject}: ${item.title}`}
          color={onPanel}
        />
      </View>
      <Text variant="footnote" weight="semibold" numberOfLines={1} style={styles.subject}>
        {item.subject}
      </Text>
      <Text
        variant="headline"
        weight="bold"
        numberOfLines={3}
        style={[styles.title, { color: color.panelTitle }, done.checked ? styles.struck : null]}
      >
        {item.title}
      </Text>
      <View style={styles.bottom}>
        <Text
          variant="subhead"
          weight="bold"
          style={[styles.due, item.overdue ? { color: color.panelDue } : null]}
        >
          {item.due}
        </Text>
        {item.waiting ? (
          <View style={styles.waiting}>
            <Icon name="cloudUp" color={onPanelSoft} size={16} />
            <Text variant="footnote" weight="bold" style={styles.soft}>
              wartet
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// The panel is dark in both schemes, so its text is white.
const onPanel = "#FFFFFF";
const onPanelSoft = "rgba(255, 255, 255, 0.78)";

const styles = StyleSheet.create({
  card: {
    width: 180,
    minHeight: 184,
    borderRadius: Tokens.radius.tile + 6,
    paddingTop: Tokens.space.md + Tokens.space.xxs,
    paddingBottom: Tokens.space.md + Tokens.space.xxs,
    paddingLeft: Tokens.space.lg,
    paddingRight: Tokens.space.md + Tokens.space.xxs,
  },
  // As the Flutter app greyed done and long-forgotten homework.
  dimmed: { opacity: 0.6 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subject: { marginTop: Tokens.space.sm, color: onPanelSoft },
  title: { marginTop: Tokens.space.xxs },
  struck: { textDecorationLine: "line-through" },
  bottom: {
    marginTop: "auto",
    paddingTop: Tokens.space.sm,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: Tokens.space.xs,
  },
  due: { flexShrink: 1, color: onPanel },
  waiting: { flexDirection: "row", alignItems: "center", gap: Tokens.space.xxs },
  soft: { color: onPanelSoft },
});
