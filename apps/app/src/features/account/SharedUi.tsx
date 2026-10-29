import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import type { ComponentRef, ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { Card } from "../../ui/Card.tsx";
import { Text } from "../../ui/Text.tsx";
import { useFocused } from "./CodeField.tsx";

// Copies of what WP-4 adds to packages/ui after #44: Card with a title, Field, Button with
// `disabled` and `block`, Link, and the passkey icon. Delete this file and import those instead.

export interface SectionProps {
  readonly title?: string;
  readonly children: ReactNode;
}

/** A card with an optional heading in the accent colour. */
export function Section({ title, children }: SectionProps) {
  const { color } = Theme.useTheme();

  return (
    <Card style={styles.section}>
      {title === undefined ? null : (
        <Text variant="title2" accessibilityRole="header" style={{ color: color.accent }}>
          {title}
        </Text>
      )}
      {children}
    </Card>
  );
}

export interface FieldProps extends Omit<TextInputProps, "style"> {
  readonly label: string;
  readonly hint?: string;
  /** At the hint's right, such as "6/10". */
  readonly count?: string;
  /** The hint and the field's edge turn red. */
  readonly bad?: boolean;
  readonly ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** A labelled text field. Editing, autofill and keyboards stay native. */
export function Field({ label, hint, count, bad = false, onFocus, onBlur, ...input }: FieldProps) {
  const { color } = Theme.useTheme();
  const focus = useFocused();
  const edge = bad ? color.danger : focus.focused ? color.accent : color.hairline;
  const hintColor = bad ? color.danger : color.inkSoft;

  return (
    <View style={styles.field}>
      <Text variant="subhead" style={{ color: color.inkSoft }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={color.inkSoft}
        selectionColor={color.accent}
        onFocus={(event) => {
          focus.set(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          focus.set(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            backgroundColor: color.canvas,
            borderColor: edge,
            borderWidth: edge === color.hairline ? 1 : 2,
            paddingHorizontal: edge === color.hairline ? Tokens.space.lg : Tokens.space.lg - 1,
            color: color.ink,
          },
        ]}
        {...input}
      />
      {hint === undefined && count === undefined ? null : (
        <View style={styles.hint}>
          <Text variant="footnote" style={{ color: hintColor }}>
            {hint}
          </Text>
          {count === undefined ? null : (
            <Text variant="footnote" style={{ color: hintColor, fontVariant: ["tabular-nums"] }}>
              {count}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  /** "filled" is the primary action in green; "quiet" is a white pill. */
  readonly kind?: "filled" | "quiet";
  readonly busy?: boolean;
  /** Greyed out, until a form is complete. */
  readonly disabled?: boolean;
  /** As wide as its card. */
  readonly block?: boolean;
}

/** A pill button. */
export function Button({
  label,
  onPress,
  kind = "filled",
  busy = false,
  disabled = false,
  block = false,
}: ButtonProps) {
  const { color, elevation } = Theme.useTheme();
  const filled = kind === "filled";
  const foreground = disabled ? color.inkSoft : filled ? color.onAccent : color.accent;
  const background = disabled ? color.hairline : filled ? color.accent : color.surface;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        block ? styles.block : null,
        {
          backgroundColor: background,
          boxShadow: filled || disabled ? "none" : elevation.float,
          transform: [{ scale: pressed ? Tokens.motion.press.scale : 1 }],
        },
      ]}
    >
      {busy ? <ActivityIndicator color={foreground} /> : null}
      <Text variant="headline" style={{ color: foreground, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface LinkProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly busy?: boolean;
}

/** A text button in the link colour. */
export function Link({ label, onPress, busy = false }: LinkProps) {
  const { color } = Theme.useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={styles.link}
    >
      <Text variant="subhead" style={{ color: color.action, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Material Symbols Rounded "passkey" (Apache 2.0), on a 24-point grid. */
export function PasskeyIcon({
  color,
  size = 24,
}: {
  readonly color: string;
  readonly size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        fill={color}
        d="M5 20Q4.17 20 3.59 19.41Q3 18.82 3 18V17.2Q3 16.35 3.44 15.64Q3.88 14.92 4.6 14.55Q6.15 13.77 7.75 13.39Q9.35 13 11 13Q11.35 13 11.7 13.01Q12.05 13.02 12.4 13.07Q12.68 13.1 12.84 13.29Q13 13.47 13 13.75Q13.05 14.92 13.58 15.96Q14.1 17 14.98 17.73Q15.15 17.85 15.25 18.04Q15.35 18.23 15.35 18.45V19Q15.35 19.43 15.06 19.71Q14.78 20 14.35 20ZM11 12Q9.35 12 8.18 10.82Q7 9.65 7 8Q7 6.35 8.18 5.17Q9.35 4 11 4Q12.65 4 13.82 5.17Q15 6.35 15 8Q15 9.65 13.82 10.82Q12.65 12 11 12ZM18.5 14Q18.93 14 19.21 13.71Q19.5 13.42 19.5 13Q19.5 12.57 19.21 12.29Q18.93 12 18.5 12Q18.07 12 17.79 12.29Q17.5 12.57 17.5 13Q17.5 13.42 17.79 13.71Q18.07 14 18.5 14ZM18.65 22.65 17.65 21.65Q17.6 21.6 17.5 21.3V16.85Q16.4 16.52 15.7 15.61Q15 14.7 15 13.5Q15 12.05 16.02 11.02Q17.05 10 18.5 10Q19.95 10 20.98 11.02Q22 12.05 22 13.5Q22 14.62 21.36 15.5Q20.73 16.38 19.75 16.75L20.65 17.65Q20.8 17.8 20.8 18Q20.8 18.2 20.65 18.35L19.85 19.15Q19.7 19.3 19.7 19.5Q19.7 19.7 19.85 19.85L20.65 20.65Q20.8 20.8 20.8 21Q20.8 21.2 20.65 21.35L19.35 22.65Q19.2 22.8 19 22.8Q18.8 22.8 18.65 22.65Z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  section: { padding: Tokens.layout.cardPadding, gap: Tokens.space.lg },
  field: { gap: Tokens.space.xs + 2 },
  input: {
    // The edge shows the focus, so the browser's own ring would only cover it.
    outlineStyle: "solid",
    outlineWidth: 0,
    minHeight: 52,
    borderRadius: Tokens.radius.field,
    fontFamily: Theme.fontFamily,
    fontSize: Tokens.type.body.size,
    fontWeight: "400",
  },
  hint: { flexDirection: "row", justifyContent: "space-between", gap: Tokens.space.md },
  button: {
    minHeight: Tokens.layout.minTarget,
    paddingHorizontal: Tokens.space.xl,
    borderRadius: Tokens.radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Tokens.space.sm,
    cursor: "pointer",
  },
  block: { alignSelf: "stretch" },
  link: {
    minHeight: Tokens.layout.minTarget,
    paddingHorizontal: Tokens.space.sm,
    justifyContent: "center",
    cursor: "pointer",
  },
});
