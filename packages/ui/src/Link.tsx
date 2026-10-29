import { Pressable, StyleSheet } from "react-native";

import { Icon, type IconName } from "./Icon.tsx";
import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface LinkProps {
  readonly label: string;
  readonly onPress: () => void;
  /** "action" in the link blue leads somewhere; "danger" in red removes something, as "Abmelden". */
  readonly tone?: "action" | "danger";
  /** A glyph before the label. */
  readonly icon?: IconName;
  /** While its action runs, such as sending a code again. */
  readonly busy?: boolean;
}

/** A text button, such as "Konto anlegen" under a form or "Hausaufgabe löschen" under a detail. */
export function Link({ label, onPress, tone = "action", icon, busy = false }: LinkProps) {
  const { color } = Theme.useTheme();
  const foreground = tone === "danger" ? color.danger : color.action;

  return (
    <Pressable
      accessibilityRole="button"
      aria-busy={busy}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed || busy ? styles.pressed : null]}
    >
      {icon === undefined ? null : <Icon name={icon} color={foreground} size={20} />}
      <Text variant="headline" weight="bold" style={{ color: foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: Tokens.space.xs,
    minHeight: Tokens.layout.minTarget,
    paddingHorizontal: Tokens.space.sm,
    cursor: "pointer",
  },
  pressed: { opacity: 0.6 },
});
