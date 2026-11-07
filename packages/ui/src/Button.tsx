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
   * secondary action beside a primary one, "action" the one blue step forward of a sign-in or
   * setup card (the old web's `brand` button), "secondary" the white way beside it (its `outline`).
   */
  readonly kind?: "filled" | "quiet" | "outline" | "action" | "secondary";
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

  // The old web dimmed its blue button rather than greying it, so "Weiter" keeps its colour.
  const dimmed = disabled && kind === "action";

  const look =
    disabled && !dimmed
      ? {
          background: color.hairline,
          foreground: color.inkSoft,
          shadow: "none",
          edge: "transparent",
        }
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
          action: {
            background: color.action,
            foreground: color.onAction,
            shadow: dimmed ? "none" : elevation.float,
            edge: "transparent",
          },
          secondary: {
            background: color.surface,
            foreground: color.ink,
            shadow: elevation.card,
            edge: color.hairline,
          },
        }[kind];

  return (
    <Pressable
      accessibilityRole="button"
      aria-busy={busy}
      disabled={busy || disabled}
      hitSlop={
        small || kind === "secondary" ? (Tokens.layout.minTarget - smallHeight) / 2 : undefined
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small ? styles.small : null,
        kind === "action" ? styles.action : null,
        kind === "secondary" ? styles.secondary : null,
        block ? styles.block : null,
        disabled ? null : styles.pressable,
        dimmed ? styles.dimmed : null,
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
        variant={small ? "subhead" : kind === "action" ? "callout" : "headline"}
        weight={kind === "action" || kind === "secondary" ? "medium" : "bold"}
        style={[kind === "secondary" ? styles.secondaryLabel : null, { color: look.foreground }]}
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
  // The old web's `xl` size: 48 high, 28 to each side.
  action: { paddingHorizontal: 28 },
  dimmed: { opacity: 0.5 },
  // Its `lg` size: 40 high, 24 to each side, text-sm. The touch target stays 48.
  secondary: { minHeight: smallHeight, borderWidth: 1, paddingHorizontal: Tokens.space.xl },
  secondaryLabel: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  block: { alignSelf: "stretch" },
  pressable: { cursor: "pointer" },
});
