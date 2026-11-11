import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { TickBox } from "@stu/ui/TickBox";
import { Tokens } from "@stu/ui/Tokens";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { SubjectMarker } from "../subject/SubjectMarker.tsx";
import type { HomeworkItem } from "./HomeworkItem.ts";

export interface HomeworkCardProps {
  readonly item: HomeworkItem.Item;
  /** Ticks the homework done, or opens it again. */
  readonly onToggle: (id: string, done: boolean) => void;
  /** Set by the panel, so that on a phone the next card peeks in at the screen's edge. */
  readonly width: number;
}

/**
 * One homework as the Flutter app's navy card on the blue panel: the subject with its blob, the
 * title in green, and when it is due. The box at the top right ticks it done with a pen stroke.
 */
export function HomeworkCard({ item, onToggle, width }: HomeworkCardProps) {
  const { color } = Theme.useTheme();
  const { fontScale } = useWindowDimensions();
  const size = titleSize(item.title, width - padding.left - padding.right, fontScale);

  return (
    <View
      style={[
        styles.card,
        { width, backgroundColor: color.panelCard },
        item.dimmed ? styles.dimmed : null,
      ]}
    >
      <View style={styles.top}>
        <SubjectMarker mark={item.mark} size={34} />
        <TickBox
          checked={item.done}
          onChange={(done) => onToggle(item.id, done)}
          label={`${item.subject}: ${item.title}`}
          color={onPanel}
        />
      </View>
      <Text
        variant="footnote"
        weight="semibold"
        numberOfLines={1}
        style={[styles.subject, { color: color.panelSoft }]}
      >
        {item.subject}
      </Text>
      <Text
        variant="headline"
        weight="bold"
        numberOfLines={3}
        style={[
          styles.title,
          { color: color.panelTitle, fontSize: size, lineHeight: Math.round(size * 1.3) },
          item.done ? styles.struck : null,
        ]}
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
            <Icon name="cloudUp" color={color.panelSoft} size={16} />
            <Text variant="footnote" weight="bold" style={{ color: color.panelSoft }}>
              wartet
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Nunito Bold sets German words at about 0.55 em a letter ("Reaktionsgleichungen" measures 0.51),
// so a title with a long word gets smaller until that word fits on a line, instead of breaking
// inside it. `fontScale` is the platform's text size setting, which enlarges the size set here.
const titleSize = (title: string, width: number, fontScale: number) => {
  const longest = Math.max(...title.split(/\s+/u).map((word) => word.length));
  const fits = Math.floor(width / (longest * 0.55 * fontScale));

  return Math.max(13, Math.min(Tokens.type.headline.size, fits));
};

// The panel is dark in both schemes, so its text is white.
const onPanel = "#FFFFFF";

const padding = { left: Tokens.space.lg, right: Tokens.space.md + Tokens.space.xxs };

const styles = StyleSheet.create({
  card: {
    minHeight: 184,
    borderRadius: Tokens.radius.tile + 6,
    paddingTop: Tokens.space.md + Tokens.space.xxs,
    paddingBottom: Tokens.space.md + Tokens.space.xxs,
    paddingLeft: padding.left,
    paddingRight: padding.right,
  },
  // As the Flutter app greyed done and long-forgotten homework.
  dimmed: { opacity: 0.6 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subject: { marginTop: Tokens.space.sm },
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
});
