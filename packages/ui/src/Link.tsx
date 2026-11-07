import { Pressable, StyleSheet, type PressableProps } from "react-native";

import { Icon, type IconName } from "./Icon.tsx";
import { Text, type Variant } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

declare module "react-native" {
  interface PressableProps {
    /** react-native-web renders a pressable with `href` as an anchor. Native ignores it. */
    readonly href?: string | undefined;
  }
}

export interface LinkProps extends Omit<PressableProps, "children" | "style"> {
  readonly label: string;
  /** "action" in the link blue leads somewhere; "danger" in red removes something, as "Abmelden". */
  readonly tone?: "action" | "danger";
  /** A glyph before the label. */
  readonly icon?: IconName;
  /** While its action runs, such as sending a code again. */
  readonly busy?: boolean;
  /** The size of the text around it, such as "subhead" after "Noch kein Konto?". */
  readonly variant?: Variant;
}

/**
 * A text button, such as "Konto anlegen" under a form or "Hausaufgabe löschen" under a detail. With
 * `href` it is a link, an anchor on the web, as expo-router's `<Link href asChild>` passes it;
 * without, a button. The parent places it.
 */
export function Link({
  label,
  tone = "action",
  icon,
  busy = false,
  variant = "headline",
  disabled,
  ...pressable
}: LinkProps) {
  const { color } = Theme.useTheme();
  const foreground = tone === "danger" ? color.danger : color.action;

  return (
    <Pressable
      role={pressable.href === undefined ? "button" : "link"}
      aria-busy={busy}
      {...pressable}
      disabled={busy || disabled === true}
      style={({ pressed }) => [styles.link, pressed || busy ? styles.pressed : null]}
    >
      {icon === undefined ? null : (
        <Icon name={icon} color={foreground} size={Tokens.type[variant].size + 3} />
      )}
      <Text variant={variant} weight="bold" style={{ color: foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.xs,
    minHeight: Tokens.layout.minTarget,
    cursor: "pointer",
  },
  pressed: { opacity: 0.6 },
});
