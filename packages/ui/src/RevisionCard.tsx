import { StyleSheet, Text, View } from "react-native";

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
        <Text style={[styles.title, { color: color.accent }]}>{title}</Text>
        {badge === undefined ? null : (
          <Text style={[styles.badge, { color: color.accent, backgroundColor: color.accentTint }]}>
            {badge}
          </Text>
        )}
      </View>
      <View>
        <Text style={[styles.label, { color: color.inkSoft }]}>Revision</Text>
        {revision !== undefined ? (
          <Text selectable style={[styles.revision, { color: color.ink }]}>
            {revision}
          </Text>
        ) : problem !== undefined ? (
          <Text style={[styles.body, { color: color.danger }]}>{problem}</Text>
        ) : (
          <Text style={[styles.revision, { color: color.inkSoft }]}>…</Text>
        )}
      </View>
      {details.map(({ label, value }) => (
        <View key={label} style={[styles.detail, { borderTopColor: color.hairline }]}>
          <Text style={[styles.label, { color: color.inkSoft }]}>{label}</Text>
          <Text style={[styles.body, { color: color.ink }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const text = (token: keyof typeof Tokens.type) => ({
  fontFamily: Theme.fontFamily,
  fontSize: Tokens.type[token].size,
  lineHeight: Tokens.type[token].line,
  fontWeight: Tokens.type[token].weight,
});

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
  title: text("title2"),
  badge: {
    ...text("footnote"),
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
  },
  label: text("footnote"),
  revision: text("title3"),
  body: text("callout"),
  detail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: Tokens.space.lg,
    borderTopWidth: 1,
    paddingTop: Tokens.space.md,
  },
});
