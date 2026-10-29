import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";

export type Status = "ok" | "pending" | "failed" | "missing";

export interface StatusRowProps {
  /** The small line on top, like the time above a lesson. */
  readonly label: string;
  readonly title: string;
  readonly detail?: string | undefined;
  readonly status: Status;
  /** The bar on the left, a subject colour as on a lesson row. */
  readonly accent: string;
  /** Rows with more to show open it. */
  readonly onPress?: (() => void) | undefined;
  /** The first row of a card has no line above it. */
  readonly first?: boolean;
}

/** One line of the diagnostics card, shaped like a lesson in the Übersicht. */
export function StatusRow({
  label,
  title,
  detail,
  status,
  accent,
  onPress,
  first = false,
}: StatusRowProps) {
  const { color } = Theme.useTheme();

  const titleColor =
    status === "failed" ? color.danger : status === "ok" ? color.accent : color.inkSoft;

  return (
    <Pressable
      onPress={onPress}
      disabled={onPress === undefined}
      accessibilityRole={onPress === undefined ? undefined : "button"}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: color.hairline, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth },
        pressed ? { backgroundColor: color.accentTint } : null,
        onPress === undefined ? null : styles.pressable,
      ]}
    >
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <View style={styles.text}>
        <Text variant="footnote" style={{ color: color.inkSoft }}>
          {label}
        </Text>
        <Text variant="title3" style={{ color: titleColor }}>
          {title}
        </Text>
        {detail === undefined ? null : (
          <Text variant="subhead" selectable>
            {detail}
          </Text>
        )}
      </View>
      <Trail status={status} navigates={onPress !== undefined} />
    </Pressable>
  );
}

function Trail({ status, navigates }: { readonly status: Status; readonly navigates: boolean }) {
  const { color } = Theme.useTheme();

  switch (status) {
    case "pending":
      return <ActivityIndicator color={color.inkSoft} />;
    case "failed":
      return (
        <View style={[styles.badge, { backgroundColor: color.dangerTint }]}>
          <Icon name="alert" color={color.danger} size={20} />
        </View>
      );
    case "missing":
    case "ok":
      return navigates ? (
        <Icon name="chevron" color={color.inkSoft} size={26} />
      ) : status === "ok" ? (
        <Icon name="check" color={color.accent} size={26} />
      ) : null;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    minHeight: 62,
    paddingVertical: Tokens.space.md,
    paddingLeft: Tokens.space.xl,
    paddingRight: Tokens.space.lg,
  },
  pressable: { cursor: "pointer" },
  bar: {
    position: "absolute",
    left: 10,
    top: Tokens.space.lg,
    bottom: Tokens.space.lg,
    width: 4,
    borderRadius: 2,
  },
  text: { flex: 1, gap: Tokens.space.xxs },
  badge: {
    width: 30,
    height: 30,
    borderRadius: Tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
