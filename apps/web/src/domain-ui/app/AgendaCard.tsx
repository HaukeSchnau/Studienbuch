import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Check, Chevron } from "./Glyph.tsx";
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
 * Stand-in for the app's day agenda ("Übersicht", design-language.md variant B) until M1 builds it
 * in packages/domain-ui. Lessons open their course through `onOpen`; without it they are not
 * pressable and show no chevron.
 */
export function AgendaCard({
  rows,
  onOpen,
}: {
  rows: ReadonlyArray<AgendaRow>;
  onOpen?: (id: string) => void;
}) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: color.surface, borderColor: color.cardEdge, boxShadow: elevation.card },
      ]}
    >
      {rows.map((row, index) => (
        <View
          key={row.id}
          style={index === 0 ? undefined : [styles.divider, { borderTopColor: color.hairline }]}
        >
          {row.kind === "free" ? (
            <View style={styles.row}>
              <View style={styles.grow}>
                <Text style={[Type.style("footnote"), { color: color.inkSoft }]}>
                  {row.time} Uhr
                </Text>
                <Text style={[Type.style("title3"), styles.free, { color: color.inkSoft }]}>
                  Freistunde
                </Text>
              </View>
            </View>
          ) : (
            <Lesson lesson={row} onOpen={onOpen} />
          )}
        </View>
      ))}
    </View>
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

  const content = (
    <>
      <View style={[styles.bar, { backgroundColor: Tokens.subject[lesson.slot].fill }]} />
      <View style={styles.grow}>
        {lesson.phase === "now" && lesson.remaining !== undefined ? (
          <View style={styles.now}>
            <View style={[styles.dot, { backgroundColor: color.accent }]} />
            <Text style={[Type.style("footnote"), { color: color.ink }]}>{lesson.remaining}</Text>
          </View>
        ) : (
          <Text style={[Type.style("footnote"), { color: color.inkSoft }]}>{lesson.time} Uhr</Text>
        )}
        <Text
          style={[
            Type.style("title3"),
            cancelled
              ? [styles.struck, { color: color.inkSoft, textDecorationColor: color.danger }]
              : { color: color.accent },
          ]}
        >
          {lesson.subject}
        </Text>
        {cancelled ? (
          <Text style={[Type.style("callout"), styles.change, { color: color.danger }]}>
            Entfall
          </Text>
        ) : (
          <Text style={[Type.style("callout"), { color: color.inkSoft }]}>
            {lesson.detail}
            {lesson.change === "Vertretung" ? (
              <Text style={[styles.change, { color: color.danger }]}> (Vertretung)</Text>
            ) : null}
          </Text>
        )}
      </View>
      {lesson.phase === "past" ? (
        <Check color={color.accent} />
      ) : onOpen === undefined ? null : (
        <Chevron color={color.inkSoft} />
      )}
    </>
  );

  return onOpen === undefined || lesson.phase === "past" ? (
    <View style={[styles.row, lesson.phase === "past" && styles.past]}>{content}</View>
  ) : (
    <Pressable
      accessibilityLabel={`${lesson.subject} öffnen`}
      accessibilityRole="button"
      onPress={() => onOpen(lesson.id)}
      style={({ pressed }) => [
        styles.row,
        styles.pressable,
        lesson.phase === "now" && { backgroundColor: color.accentTint },
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Tokens.radius.card,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: Tokens.space.xs,
  },
  divider: { borderTopWidth: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    minHeight: 62,
    paddingVertical: 7,
    paddingLeft: 24,
    paddingRight: 18,
  },
  pressable: { cursor: "pointer" },
  past: { opacity: 0.55 },
  pressed: { transform: [{ scale: Tokens.motion.press.scale }] },
  bar: { position: "absolute", left: 10, top: 16, bottom: 16, width: 4, borderRadius: 2 },
  grow: { flex: 1 },
  now: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  free: { fontStyle: "italic", fontWeight: "600" },
  struck: { textDecorationLine: "line-through", textDecorationStyle: "solid" },
  change: { fontWeight: "800" },
});
