import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "./Card.tsx";
import { Icon } from "./Icon.tsx";
import { Type } from "./Type.ts";

export type AgendaRow =
  | {
      readonly kind: "lesson";
      readonly id: string;
      readonly time: string;
      readonly subject: string;
      readonly slot: Tokens.SubjectSlot;
      /** Teacher and room, as the school writes them. */
      readonly detail: string;
      readonly phase: "past" | "now" | "later";
      /** Shown on the lesson running now, such as "Noch 34 Minuten". */
      readonly remaining?: string;
      readonly change?: "Vertretung" | "Entfall";
    }
  | { readonly kind: "free"; readonly id: string; readonly time: string };

/**
 * Stand-in for the app's day agenda ("Übersicht", variant B) until M1 builds it in
 * packages/domain-ui. Rows have the geometry of the app's `StatusRow`. Lessons open their course
 * through `onOpen`; without it they are not pressable and show no chevron.
 */
export function AgendaCard({
  rows,
  onOpen,
}: {
  rows: ReadonlyArray<AgendaRow>;
  onOpen?: (id: string) => void;
}) {
  const { color } = Theme.useTheme();

  return (
    <Card>
      {rows.map((row, index) => (
        <View
          key={row.id}
          style={index === 0 ? undefined : [styles.divider, { borderTopColor: color.hairline }]}
        >
          {row.kind === "free" ? (
            <View style={styles.row}>
              <View style={styles.text}>
                <Text style={[Type.style("label"), { color: color.inkSoft }]}>{row.time} Uhr</Text>
                <Text style={[Type.style("rowTitle"), styles.free, { color: color.inkSoft }]}>
                  Freistunde
                </Text>
              </View>
            </View>
          ) : (
            <Lesson lesson={row} onOpen={onOpen} />
          )}
        </View>
      ))}
    </Card>
  );
}

function Lesson({
  lesson,
  onOpen,
}: {
  lesson: Extract<AgendaRow, { kind: "lesson" }>;
  onOpen: ((id: string) => void) | undefined;
}) {
  const { color } = Theme.useTheme();
  const cancelled = lesson.change === "Entfall";
  const past = lesson.phase === "past";
  const pressable = onOpen !== undefined && !past;

  const content = (
    <>
      <View
        style={[
          styles.bar,
          { backgroundColor: Tokens.subject[lesson.slot].fill },
          past && styles.dim,
        ]}
      />
      <View style={[styles.text, past && styles.dim]}>
        {lesson.phase === "now" && lesson.remaining !== undefined ? (
          <View style={styles.now}>
            <View style={[styles.dot, { backgroundColor: color.accent }]} />
            <Text style={[Type.style("status"), { color: color.ink }]}>{lesson.remaining}</Text>
          </View>
        ) : (
          <Text style={[Type.style("label"), { color: color.inkSoft }]}>{lesson.time} Uhr</Text>
        )}
        <Text
          style={[
            Type.style("rowTitle"),
            cancelled
              ? [styles.struck, { color: color.inkSoft, textDecorationColor: color.danger }]
              : { color: color.accent },
          ]}
        >
          {lesson.subject}
        </Text>
        {cancelled ? (
          <Text style={[Type.style("status"), { color: color.danger }]}>Entfall</Text>
        ) : (
          <Text style={[Type.style("detail"), { color: color.inkSoft }]}>
            {lesson.detail}
            {lesson.change === "Vertretung" ? (
              <Text style={[styles.change, { color: color.danger }]}> (Vertretung)</Text>
            ) : null}
          </Text>
        )}
      </View>
      {past ? (
        <Icon color={color.accent} name="check" />
      ) : pressable ? (
        <Icon color={color.inkSoft} name="chevron" />
      ) : null}
    </>
  );

  return pressable ? (
    <Pressable
      accessibilityLabel={`${lesson.subject} öffnen`}
      accessibilityRole="button"
      onPress={() => onOpen(lesson.id)}
      style={({ pressed }) => [
        styles.row,
        styles.pressable,
        lesson.phase === "now" && { backgroundColor: color.accentTint },
        pressed && { backgroundColor: color.accentTint },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.row, lesson.phase === "now" && { backgroundColor: color.accentTint }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    minHeight: 64,
    paddingVertical: Tokens.space.md,
    paddingLeft: Tokens.space.xl,
    paddingRight: Tokens.space.lg,
  },
  pressable: { cursor: "pointer" },
  bar: {
    position: "absolute",
    left: 10,
    top: Tokens.space.lg,
    bottom: Tokens.space.lg,
    width: 4,
    borderRadius: 2,
  },
  text: { flex: 1, gap: Tokens.space.xxs },
  dim: { opacity: 0.5 },
  now: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  free: { fontStyle: "italic", fontWeight: "500" },
  struck: { textDecorationLine: "line-through" },
  change: { fontWeight: "600" },
});
