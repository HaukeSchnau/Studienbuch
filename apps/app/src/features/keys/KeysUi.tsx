import { Field, type FieldProps } from "@stu/ui/Field";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Vector } from "@stu/ui/Vector";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ProblemBox } from "../account/AccountForm.tsx";
import { NotebookKeys } from "./NotebookKeys.ts";

// What the key screens share: a method's icon in its tile, a row that names a method, a
// Notfallkarte's code as it shows once, and the sentence for a refused key operation.

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

/** The sentence for a refused key operation in the sign-in card's error box. */
export function KeyProblemBox({ reason }: { readonly reason: Option.Option<NotebookKeys.Reason> }) {
  return Option.match(reason, {
    onNone: () => null,
    onSome: (found) => <ProblemBox>{NotebookKeys.sentence[found]}</ProblemBox>,
  });
}

/**
 * Where the student types a Notfallkarte's code: 28 characters in a type small enough to show
 * whole at 390 px. Case, spaces and dashes don't matter (`RecoveryCode.parse`).
 */
export function CardCodeField(
  props: Omit<FieldProps, "label" | "placeholder" | "inputStyle"> & { readonly label?: string },
) {
  return (
    <Field
      label="Code von deiner Notfallkarte"
      placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
      autoCapitalize="characters"
      autoCorrect={false}
      autoComplete="off"
      spellCheck={false}
      returnKeyType="go"
      {...props}
      inputStyle={styles.typed}
    />
  );
}

/**
 * A Notfallkarte's code as its seven groups of four, which wrap between groups and never inside
 * one, however wide the phone's monospaced font is. Screen readers read the groups one by one.
 */
export function CardCode({ text }: { readonly text: Redacted.Redacted }) {
  const { color } = Theme.useTheme();
  const groups = Redacted.value(text).split("-");

  return (
    <View style={[styles.card, { backgroundColor: color.accentTint }]}>
      <Text variant="footnote" style={{ color: color.accent }}>
        Studienbuch Notfallkarte
      </Text>
      <View accessible accessibilityLabel={`Code: ${groups.join(", ")}`} style={styles.groups}>
        {groups.map((group, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- a group's place in the code is its identity, and two groups can read alike.
          <Text key={index} variant="title2" selectable style={styles.code}>
            {group}
          </Text>
        ))}
      </View>
      <Text variant="footnote" style={{ color: color.inkSoft }}>
        Studienbuch fragt nie nach diesem Code. Gib ihn nur in der Studienbuch-App ein.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Tokens.space.sm,
    borderRadius: Tokens.radius.field,
    padding: Tokens.space.lg,
  },
  groups: { flexDirection: "row", flexWrap: "wrap", columnGap: Tokens.space.md, rowGap: 2 },
  code: { letterSpacing: 1, fontVariant: ["tabular-nums"], fontFamily: Theme.codeFontFamily },
  typed: { fontFamily: Theme.codeFontFamily, fontSize: 15, letterSpacing: 0 },
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
