import { Button } from "@stu/ui/Button";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, View } from "react-native";

import { SubjectMarker } from "../subject/SubjectMarker.tsx";
import type { HomeworkItem } from "./HomeworkItem.ts";

export interface HomeworkDetailProps {
  readonly detail: HomeworkItem.Detail;
  readonly onToggle: (done: boolean) => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

/**
 * One homework on its page, as the Flutter app's TaskPage: the title in green, the course, the
 * text, and whether it is done with the one button that changes it. The pencil beside the title
 * edits it, and deleting sits at the bottom.
 */
export function HomeworkDetail({ detail, onToggle, onEdit, onDelete }: HomeworkDetailProps) {
  const { color } = Theme.useTheme();
  const stateColor = detail.done ? color.accent : color.danger;

  return (
    <View style={styles.detail}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text
            variant="title2"
            accessibilityRole="header"
            style={[styles.grow, { color: color.accent }]}
          >
            {detail.title}
          </Text>
          {/* Where the Flutter app had its bin. Deleting moved to the page's foot. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bearbeiten"
            onPress={onEdit}
            style={({ pressed }) => [styles.edit, pressed ? styles.pressed : null]}
          >
            <Icon name="edit" color={color.ink} size={24} />
          </Pressable>
        </View>
        <View style={styles.line}>
          <SubjectMarker mark={detail.mark} size={28} />
          <Text variant="headline" weight="bold" style={styles.shrink}>
            {detail.subject}
          </Text>
        </View>
        <View style={styles.line}>
          <Icon name="calendar" color={color.inkSoft} size={20} />
          <Text variant="callout" style={[styles.shrink, { color: color.inkSoft }]}>
            Abgabe: {detail.dueDate}
          </Text>
        </View>
        {detail.waiting ? (
          <View style={styles.line}>
            <Icon name="cloudUp" color={color.warning} size={20} />
            <Text variant="callout" weight="semibold" style={{ color: color.warning }}>
              Wartet auf Netz
            </Text>
          </View>
        ) : null}
      </View>
      {detail.description === undefined ? null : (
        <Text variant="body" style={{ color: color.inkSoft }}>
          {detail.description}
        </Text>
      )}
      <View style={styles.state}>
        <View style={styles.line} accessibilityLiveRegion="polite">
          <Text variant="callout" weight="semibold" style={{ color: stateColor }}>
            {detail.state}
          </Text>
          <Icon name={detail.done ? "check" : "cross"} color={stateColor} size={20} />
        </View>
        <View style={styles.actions}>
          <Button
            small
            kind="action"
            label={detail.done ? "Wieder öffnen" : "Als erledigt markieren"}
            onPress={() => onToggle(!detail.done)}
          />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onDelete}
        style={({ pressed }) => [styles.delete, pressed ? styles.pressed : null]}
      >
        <Icon name="delete" color={color.danger} size={22} />
        <Text variant="callout" weight="bold" style={{ color: color.danger }}>
          Hausaufgabe löschen
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { gap: Tokens.space.xl },
  head: { gap: Tokens.space.sm },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: Tokens.space.sm },
  edit: {
    width: Tokens.layout.minTarget,
    height: Tokens.layout.minTarget,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -Tokens.space.md,
    borderRadius: Tokens.radius.pill,
    cursor: "pointer",
  },
  line: { flexDirection: "row", alignItems: "center", gap: Tokens.space.sm },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  state: { gap: Tokens.space.md },
  actions: { flexDirection: "row", justifyContent: "flex-end" },
  delete: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: Tokens.space.sm,
    minHeight: Tokens.layout.minTarget,
    marginTop: Tokens.space.lg,
    cursor: "pointer",
  },
  pressed: { opacity: 0.6 },
});
