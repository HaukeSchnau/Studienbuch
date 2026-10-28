import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Image, StyleSheet, Text, View } from "react-native";

import { Card } from "./Card.tsx";
import { CheckBadge, Icon, OpenBadge } from "./Icon.tsx";
import { Type } from "./Type.ts";

const warning = "/art/warning.svg";

export interface AbsenceEntry {
  readonly id: string;
  /** "Do, 15.10." */
  readonly date: string;
  readonly hours: number;
  readonly reason: string | undefined;
  readonly excused: boolean;
}

/**
 * Stand-in for the app's absence card with the yellow "!" (variant B) until M1 builds it in
 * packages/domain-ui: the summary, and below it the days in `entries`, when given.
 */
export function AbsenceCard({
  unexcused,
  days,
  entries = [],
}: {
  unexcused: number;
  days: number;
  entries?: ReadonlyArray<AbsenceEntry>;
}) {
  const { color } = Theme.useTheme();

  return (
    <Card>
      <View style={styles.summary}>
        <View style={styles.header}>
          <Text style={[Type.style("cardTitle"), { color: color.accent }]}>Fehlzeiten</Text>
          <Icon color={color.accent} name="plus" size={26} />
        </View>
        <View style={styles.body}>
          {/* `defaultSource` makes react-native-web render the image while prerendering. */}
          <Image defaultSource={{ uri: warning }} source={{ uri: warning }} style={styles.art} />
          <Text style={[Type.style("body"), styles.text, { color: color.ink }]}>
            Du hast noch <Text style={styles.strong}>{unexcused}</Text> unentschuldigte Fehlzeiten
            an <Text style={styles.strong}>{days}</Text> {days === 1 ? "Tag" : "Tagen"}.
          </Text>
        </View>
      </View>
      {entries.map((entry) => (
        <View key={entry.id} style={[styles.row, { borderTopColor: color.hairline }]}>
          <View style={styles.text}>
            <Text style={[Type.style("label"), { color: color.inkSoft }]}>{entry.date}</Text>
            <Text style={[Type.style("title"), { color: color.ink }]}>
              {entry.hours} {entry.hours === 1 ? "Stunde" : "Stunden"}
              {entry.reason === undefined ? null : (
                <Text style={[styles.reason, { color: color.inkSoft }]}>, {entry.reason}</Text>
              )}
            </Text>
          </View>
          <View style={styles.status}>
            {entry.excused ? (
              <CheckBadge color={color.accent} />
            ) : (
              <OpenBadge color={color.warning} />
            )}
            <Text
              style={[
                Type.style("status"),
                { color: entry.excused ? color.accent : color.warning },
              ]}
            >
              {entry.excused ? "entschuldigt" : "Entschuldigung fehlt"}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: {
    paddingVertical: Tokens.space.lg,
    paddingLeft: Tokens.layout.cardPadding,
    paddingRight: Tokens.space.lg,
    gap: Tokens.space.md,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  body: { flexDirection: "row", alignItems: "center", gap: Tokens.space.lg },
  art: {
    width: 24,
    height: 44,
    marginHorizontal: Tokens.space.xs,
    transform: [{ rotate: "-14deg" }],
  },
  text: { flex: 1, gap: Tokens.space.xxs },
  strong: { fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Tokens.space.md,
    paddingLeft: Tokens.layout.cardPadding,
    paddingRight: Tokens.space.lg,
  },
  reason: { fontWeight: "400" },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
});
