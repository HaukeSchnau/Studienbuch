import { Pressable, StyleSheet } from "react-native";

import { Icon, type IconName } from "./Icon.tsx";
import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface PillProps {
  /** Shown, or with `iconOnly` read out only, such as "Vorige Woche". */
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: IconName;
  /** A round button with the glyph alone. */
  readonly iconOnly?: boolean;
  readonly disabled?: boolean;
}

/**
 * A white pill in the hero's toolbar row, where the web's own chrome puts its buttons: "Neu", the
 * way back, the week arrows. The phones use their native toolbar buttons instead.
 */
export function Pill({ label, onPress, icon, iconOnly = false, disabled = false }: PillProps) {
  const { color, elevation } = Theme.useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        icon === undefined ? styles.text : styles.withIcon,
        iconOnly ? styles.round : null,
        { backgroundColor: color.surface, boxShadow: elevation.float },
        disabled ? styles.disabled : styles.pressable,
        pressed ? styles.pressed : null,
      ]}
    >
      {icon === undefined ? null : (
        <Icon name={icon} color={color.accent} size={iconOnly ? 22 : 20} />
      )}
      {iconOnly ? null : (
        <Text variant="subhead" weight="bold" style={{ color: color.accent }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.xxs,
    height: 40,
    borderRadius: Tokens.radius.pill,
  },
  text: { paddingHorizontal: Tokens.space.lg },
  withIcon: { paddingLeft: Tokens.space.sm, paddingRight: Tokens.space.md + Tokens.space.xxs },
  round: { width: 40, paddingLeft: 0, paddingRight: 0, justifyContent: "center" },
  pressable: { cursor: "pointer" },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: Tokens.motion.press.scale }] },
});
