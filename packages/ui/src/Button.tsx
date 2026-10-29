import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  /** "filled" is the primary action in green; "quiet" is a white pill, as on the hero. */
  readonly kind?: "filled" | "quiet";
  readonly busy?: boolean;
}

/** A pill button. Its label stays bold, a step above the headline token, so it reads as an action. */
export function Button({ label, onPress, kind = "filled", busy = false }: ButtonProps) {
  const { color, elevation } = Theme.useTheme();
  const filled = kind === "filled";
  const foreground = filled ? color.onAccent : color.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: filled ? color.accent : color.surface,
          boxShadow: filled ? "none" : elevation.float,
          transform: [{ scale: pressed ? Tokens.motion.press.scale : 1 }],
        },
      ]}
    >
      {busy ? <ActivityIndicator color={foreground} /> : null}
      <Text variant="headline" weight="bold" style={{ color: foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
});
