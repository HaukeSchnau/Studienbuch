import { StyleSheet, View } from "react-native";

import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface RevisionCardProps {
  /** What the revision belongs to, such as "Server" or "App". */
  readonly title: string;
  /** Undefined while unknown. The card then shows `problem`, or a placeholder while it waits. */
  readonly revision: string | undefined;
  /** A short tag next to the title, such as the environment. */
  readonly badge?: string | undefined;
  readonly details?: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  /** Why the revision is missing. */
  readonly problem?: string | undefined;
}

/** Which build is running somewhere, for a person comparing two places. */
export function RevisionCard({ title, revision, badge, details = [], problem }: RevisionCardProps) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: color.surface, borderColor: color.cardEdge, boxShadow: elevation.card },
      ]}
    >
      <View style={styles.header}>
        <Text variant="title2" style={{ color: color.accent }}>
          {title}
        </Text>
        {badge === undefined ? null : (
          <Text
            variant="footnote"
            style={[styles.badge, { color: color.accent, backgroundColor: color.accentTint }]}
          >
            {badge}
          </Text>
        )}
      </View>
      <View>
        <Text variant="footnote" style={{ color: color.inkSoft }}>
          Revision
        </Text>
        {revision !== undefined ? (
          <Text variant="title3" selectable>
            {revision}
          </Text>
        ) : problem !== undefined ? (
          <Text variant="callout" style={{ color: color.danger }}>
            {problem}
          </Text>
        ) : (
          <Text variant="title3" style={{ color: color.inkSoft }}>
            …
          </Text>
        )}
      </View>
      {details.map(({ label, value }) => (
        <View key={label} style={[styles.detail, { borderTopColor: color.hairline }]}>
          <Text variant="footnote" style={{ color: color.inkSoft }}>
            {label}
          </Text>
          <Text variant="callout">{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Tokens.radius.card,
    borderWidth: 1,
    padding: Tokens.layout.cardPadding,
    gap: Tokens.space.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Tokens.space.sm,
  },
  badge: {
    overflow: "hidden",
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
  },
  detail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: Tokens.space.lg,
    borderTopWidth: 1,
    paddingTop: Tokens.space.md,
  },
});
