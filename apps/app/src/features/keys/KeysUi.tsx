import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Vector } from "@stu/ui/Vector";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { NotebookKeys } from "./NotebookKeys.ts";

// What the key screens share: a method's icon in its tile, a row that names a method, and the
// sentence for a refused key operation.

export type Glyph = "passkey" | "code" | "device";

// A card with dots for a code, and a phone, in the stroke of @stu/ui's glyphs. They move into its
// Icon if another screen needs them.
const strokes: Record<Exclude<Glyph, "passkey">, string> = {
  code: "M4 6.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5zM7 12h.01M10.33 12h.01M13.67 12h.01M17 12h.01",
  device:
    "M8.5 2.5h7A1.5 1.5 0 0 1 17 4v16a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20V4a1.5 1.5 0 0 1 1.5-1.5zM11 18.5h2",
};

/** A method's glyph in its green tile. */
export function MethodTile({ glyph }: { readonly glyph: Glyph }) {
  const { color } = Theme.useTheme();

  return (
    <View style={[styles.tile, { backgroundColor: color.accentTint }]}>
      {glyph === "passkey" ? (
        <Icon name="passkey" color={color.accent} />
      ) : (
        <Vector
          width={24}
          height={24}
          viewBox="0 0 24 24"
          paths={[{ d: strokes[glyph], stroke: color.accent, strokeWidth: 2.4 }]}
        />
      )}
    </View>
  );
}

export interface MethodRowProps {
  readonly glyph: Glyph;
  readonly title: string;
  readonly detail: string;
  /** A row that opens something shows a chevron. */
  readonly onPress?: () => void;
  readonly busy?: boolean;
  readonly children?: ReactNode;
}

/** One way into the notebook: its tile, its name and a line about it. */
export function MethodRow({ glyph, title, detail, onPress, busy = false }: MethodRowProps) {
  const { color } = Theme.useTheme();

  const content = (
    <>
      <MethodTile glyph={glyph} />
      <View style={styles.grow}>
        <Text variant="headline">{title}</Text>
        <Text variant="subhead" style={{ color: color.inkSoft }}>
          {detail}
        </Text>
      </View>
      {onPress === undefined ? null : <Icon name="chevron" color={color.inkSoft} size={20} />}
    </>
  );

  return onPress === undefined ? (
    <View style={styles.row}>{content}</View>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed || busy ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const isProblem = Schema.is(NotebookKeys.Problem);

/** Why the last run of a key action failed, if a key operation said why. */
export const keyReasonOf = (result: AsyncResult.AsyncResult<unknown, unknown>) =>
  Option.flatMap(AsyncResult.error(result), (error) =>
    isProblem(error) ? Option.some(error.reason) : Option.none(),
  );

/** The reason inside a failed run's exit, if a key operation said why. */
export const keyReasonOfExit = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit)
    ? Option.flatMap(Cause.findErrorOption(exit.cause), (error) =>
        isProblem(error) ? Option.some(error.reason) : Option.none(),
      )
    : Option.none();

/** Why a key operation didn't happen, read out as soon as it shows. */
export function KeyProblem({ reason }: { readonly reason: Option.Option<NotebookKeys.Reason> }) {
  const { color } = Theme.useTheme();

  return Option.match(reason, {
    onNone: () => null,
    onSome: (found) => (
      <Text
        variant="subhead"
        role="alert"
        accessibilityLiveRegion="polite"
        style={{ color: color.danger }}
      >
        {NotebookKeys.sentence[found]}
      </Text>
    ),
  });
}

const styles = StyleSheet.create({
  tile: {
    width: 40,
    height: 40,
    borderRadius: Tokens.radius.field,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.lg,
    minHeight: Tokens.layout.minTarget,
    paddingVertical: Tokens.space.md,
  },
  grow: { flex: 1, gap: 2 },
});
