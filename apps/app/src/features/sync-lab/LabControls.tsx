import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

// The Lab's own controls: a two-way switch, small action chips and labelled sections, drawn from
// the design tokens. They belong to this developer screen only.

/** Online or offline, with the active side filled. Offline fills in the warning colour. */
export function OnlineSwitch({
  offline,
  onChange,
}: {
  readonly offline: boolean;
  readonly onChange: (offline: boolean) => void;
}) {
  const { color } = Theme.useTheme();

  const side = (label: string, active: boolean, fill: string, next: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => onChange(next)}
      style={[styles.side, { backgroundColor: active ? fill : "transparent" }]}
    >
      <Text
        variant="subhead"
        weight="bold"
        style={{ color: active ? color.onAccent : color.inkSoft }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.switch, { borderColor: color.hairline }]}>
      {side("Online", !offline, color.accent, false)}
      {side("Offline", offline, color.warning, true)}
    </View>
  );
}

export type ChipTone = "plain" | "armed" | "danger";

/** A small action. "armed" marks a fault that waits for its moment, "danger" a forged command. */
export function Chip({
  label,
  tone = "plain",
  onPress,
}: {
  readonly label: string;
  readonly tone?: ChipTone;
  readonly onPress: () => void;
}) {
  const { color } = Theme.useTheme();

  const look = {
    plain: { border: color.hairline, fill: color.surface, text: color.ink },
    armed: { border: color.warning, fill: color.warningTint, text: color.warning },
    danger: { border: color.danger, fill: color.surface, text: color.danger },
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: look.border,
          backgroundColor: look.fill,
          transform: [{ scale: pressed ? Tokens.motion.press.scale : 1 }],
        },
      ]}
    >
      <Text variant="footnote" style={{ color: look.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A labelled part of a pane, with a count on the right when it lists something. */
export function Section({
  title,
  count,
  children,
}: {
  readonly title: string;
  readonly count?: number;
  readonly children: ReactNode;
}) {
  const { color } = Theme.useTheme();

  return (
    <View style={[styles.section, { borderTopColor: color.hairline }]}>
      <View style={styles.line}>
        <Text variant="subhead" weight="bold" style={{ color: color.inkSoft }}>
          {title}
        </Text>
        {count === undefined ? null : (
          <Text variant="subhead" weight="bold" style={{ color: color.inkSoft }}>
            {count}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

/** One line of a section: text on the left after an optional mark, a note on the right. */
export function Line({
  text,
  leading,
  right,
  rightColor,
  mono = false,
}: {
  readonly text: string;
  readonly leading?: ReactNode;
  readonly right?: string;
  readonly rightColor?: string;
  readonly mono?: boolean;
}) {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.line}>
      <View style={styles.left}>
        {leading}
        <Text
          variant={mono ? "footnote" : "callout"}
          numberOfLines={1}
          style={[styles.shrink, mono ? styles.mono : undefined]}
        >
          {text}
        </Text>
      </View>
      {right === undefined ? null : (
        <Text variant="footnote" style={{ color: rightColor ?? color.inkSoft }}>
          {right}
        </Text>
      )}
    </View>
  );
}

export const mono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontWeight: "400",
} as const;

const styles = StyleSheet.create({
  switch: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: Tokens.radius.pill,
    padding: Tokens.space.xxs,
  },
  side: {
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
    borderRadius: Tokens.radius.pill,
    cursor: "pointer",
  },
  chip: {
    borderWidth: 1,
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
    cursor: "pointer",
  },
  section: {
    borderTopWidth: 1,
    paddingHorizontal: Tokens.layout.cardPadding,
    paddingVertical: Tokens.space.md,
    gap: Tokens.space.sm,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Tokens.space.sm,
  },
  left: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: Tokens.space.sm },
  shrink: { flexShrink: 1 },
  mono,
});
