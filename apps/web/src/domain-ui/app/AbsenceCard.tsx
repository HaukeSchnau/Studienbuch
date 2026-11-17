import { StatusSticker } from "@stu/domain-ui/status/StatusSticker";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Card } from "@stu/ui/Card";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { StyleSheet, View } from "react-native";

export interface AbsenceEntry {
  readonly id: string;
  /** "Do, 15.10." */
  readonly date: string;
  readonly hours: number;
  readonly reason: string | undefined;
  readonly excused: boolean;
}

/**
 * Stand-in for the app's absence card with the attention sticker (variant B) until M1 builds it in
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
          <Text variant="title2" style={{ color: color.accent }}>
            Fehlzeiten
          </Text>
          <Icon color={color.accent} name="plus" size={26} />
        </View>
        <View style={styles.body}>
          <StatusSticker status="attention" size={40} />
          <Text variant="callout" style={[styles.text, { color: color.ink }]}>
            Du hast noch{" "}
            <Text variant="callout" weight="bold">
              {unexcused}
            </Text>{" "}
            unentschuldigte Fehlzeiten an{" "}
            <Text variant="callout" weight="bold">
              {days}
            </Text>{" "}
            {days === 1 ? "Tag" : "Tagen"}.
          </Text>
        </View>
      </View>
      {entries.map((entry) => (
        <View key={entry.id} style={[styles.row, { borderTopColor: color.hairline }]}>
          <View style={styles.text}>
            <Text variant="footnote" weight="medium" style={{ color: color.inkSoft }}>
              {entry.date}
            </Text>
            <Text variant="headline" style={{ color: color.ink }}>
              {entry.hours} {entry.hours === 1 ? "Stunde" : "Stunden"}
              {entry.reason === undefined ? null : (
                <Text variant="headline" weight="regular" style={{ color: color.inkSoft }}>
                  , {entry.reason}
                </Text>
              )}
            </Text>
          </View>
          <View style={styles.status}>
            <StatusSticker status={entry.excused ? "confirmed" : "missing"} size={20} />
            <Text variant="footnote" style={{ color: entry.excused ? color.accent : color.danger }}>
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
  text: { flex: 1, gap: Tokens.space.xxs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Tokens.space.md,
    paddingLeft: Tokens.layout.cardPadding,
    paddingRight: Tokens.space.lg,
  },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
});
