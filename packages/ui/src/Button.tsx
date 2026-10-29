import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { Icon, type IconName } from "./Icon.tsx";
import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  /**
   * "filled" is the primary action in green, "quiet" a white pill as on the hero, "outline" a
   * secondary action beside a primary one.
   */
  readonly kind?: "filled" | "quiet" | "outline";
  /** A glyph before the label. */
  readonly icon?: IconName;
  readonly busy?: boolean;
  /** Greyed out and not pressable, as "Speichern" until a form is valid. */
  readonly disabled?: boolean;
  /** As wide as its container. */
  readonly block?: boolean;
  /** A shorter pill, for an action inside a card or panel. Its touch target stays 48 points. */
  readonly small?: boolean;
}

/** A pill button. Its label stays bold, a step above the headline token, so it reads as an action. */
export function Button({
  label,
  onPress,
  kind = "filled",
  icon,
  busy = false,
  disabled = false,
  block = false,
  small = false,
}: ButtonProps) {
  const { color, elevation } = Theme.useTheme();

  const look = disabled
    ? { background: color.hairline, foreground: color.inkSoft, shadow: "none", edge: "transparent" }
    : {
        filled: {
          background: color.accent,
          foreground: color.onAccent,
          shadow: "none",
          edge: "transparent",
        },
        quiet: {
          background: color.surface,
          foreground: color.accent,
          shadow: elevation.float,
          edge: color.cardEdge,
        },
        outline: {
          background: "transparent",
          foreground: color.accent,
          shadow: "none",
          edge: color.accent,
        },
      }[kind];

  return (
    <Pressable
      accessibilityRole="button"
      aria-busy={busy}
      disabled={busy || disabled}
      hitSlop={small ? (Tokens.layout.minTarget - smallHeight) / 2 : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small ? styles.small : null,
        block ? styles.block : null,
        disabled ? null : styles.pressable,
        {
          backgroundColor: look.background,
          borderColor: look.edge,
          boxShadow: look.shadow,
          transform: [{ scale: pressed ? Tokens.motion.press.scale : 1 }],
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={look.foreground} />
      ) : icon === undefined ? null : (
        <Icon name={icon} color={look.foreground} size={small ? 18 : 20} />
      )}
      <Text
        variant={small ? "subhead" : "headline"}
        weight="bold"
        style={{ color: look.foreground }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const smallHeight = 40;

const styles = StyleSheet.create({
  button: {
    minHeight: Tokens.layout.minTarget,
    paddingHorizontal: Tokens.space.xl,
    borderRadius: Tokens.radius.pill,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Tokens.space.sm,
  },
  small: { minHeight: smallHeight, paddingHorizontal: Tokens.space.lg, gap: Tokens.space.xs },
  block: { alignSelf: "stretch" },
  pressable: { cursor: "pointer" },
});
