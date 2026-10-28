import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "./Card.tsx";
import { Icon } from "./Icon.tsx";
import { Type } from "./Type.ts";

export interface Homework {
  readonly id: string;
  readonly subject: string;
  readonly slot: Tokens.SubjectSlot;
  readonly title: string;
  readonly due: string;
  readonly done: boolean;
  /** Saved on the device and waiting for the server, as every change is while offline. */
  readonly pending: boolean;
}

/**
 * Stand-in for the app's homework list until M1 builds it in packages/domain-ui: a white card with
 * rows shaped like the Übersicht's lessons, and the sync status as a line under the title, where
 * the app shows "Stand". Ticking calls `onToggle`; the caller owns the state. The legacy app drew
 * homework on a blue panel with navy cards; whether the app keeps that is M1's call.
 */
export function HomeworkCard({
  items,
  status,
  onToggle,
}: {
  items: ReadonlyArray<Homework>;
  /** The sync status line, such as "Kein Netz". */
  status: ReactNode;
  onToggle: (id: string) => void;
}) {
  const { color } = Theme.useTheme();

  return (
    <Card>
      <View style={styles.header}>
        <Text style={[Type.style("cardTitle"), { color: color.accent }]}>Hausaufgaben</Text>
        <View accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </View>
      </View>
      {items.map((item) => (
        <HomeworkRow item={item} key={item.id} onToggle={onToggle} />
      ))}
    </Card>
  );
}

function HomeworkRow({ item, onToggle }: { item: Homework; onToggle: (id: string) => void }) {
  const { color } = Theme.useTheme();

  return (
    <Pressable
      accessibilityLabel={`${item.subject}: ${item.title}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.done }}
      onPress={() => onToggle(item.id)}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: color.hairline },
        pressed && { backgroundColor: color.accentTint },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: Tokens.subject[item.slot].fill }]} />
      <View style={styles.text}>
        {/* Only the task dims when it is done; the waiting badge keeps its full contrast. */}
        <View style={styles.meta}>
          <Text style={[Type.style("label"), { color: color.inkSoft }, item.done && styles.done]}>
            {item.due}
          </Text>
          {item.pending ? (
            <Text
              style={[
                Type.style("status"),
                styles.pending,
                { backgroundColor: color.warningTint, color: color.warning },
              ]}
            >
              Wartet auf Netz
            </Text>
          ) : null}
        </View>
        <Text style={[Type.style("rowTitle"), { color: color.accent }, item.done && styles.done]}>
          {item.subject}
        </Text>
        <Text
          style={[
            Type.style("detail"),
            { color: color.inkSoft },
            item.done && [styles.done, styles.struck],
          ]}
        >
          {item.title}
        </Text>
      </View>
      <View
        style={[
          styles.tick,
          item.done
            ? { backgroundColor: color.accent, borderColor: color.accent }
            : { borderColor: color.inkSoft },
        ]}
      >
        {item.done ? <Icon color={color.onAccent} name="check" size={18} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Tokens.space.lg,
    paddingBottom: Tokens.space.md,
    paddingHorizontal: Tokens.layout.cardPadding,
    gap: Tokens.space.xs,
  },
  status: { flexDirection: "row", alignItems: "center", gap: Tokens.space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    minHeight: 64,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Tokens.space.md,
    paddingLeft: Tokens.space.xl,
    paddingRight: Tokens.space.lg,
    cursor: "pointer",
  },
  bar: {
    position: "absolute",
    left: 10,
    top: Tokens.space.lg,
    bottom: Tokens.space.lg,
    width: 4,
    borderRadius: 2,
  },
  text: { flex: 1, gap: Tokens.space.xxs },
  done: { opacity: 0.55 },
  meta: { flexDirection: "row", alignItems: "center", gap: Tokens.space.sm },
  pending: {
    overflow: "hidden",
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.sm,
    paddingVertical: 1,
  },
  struck: { textDecorationLine: "line-through" },
  tick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
