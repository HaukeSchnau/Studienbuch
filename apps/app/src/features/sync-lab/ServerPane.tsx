import { useAtomValue } from "@effect/atom-react";
import { Card } from "@stu/ui/Card";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { StyleSheet, View } from "react-native";

import { Lab } from "./Lab.ts";
import { Line, mono, Section } from "./LabControls.tsx";

/** What the server holds: versions, its command log, and each notebook's rows as ciphertext. */
export function ServerPane({ host }: { readonly host: string }) {
  const { color } = Theme.useTheme();
  const panel = useAtomValue(Lab.panel);

  return (
    <Card style={styles.pane}>
      <View style={styles.head}>
        <View style={styles.title}>
          <Text variant="title3">Server</Text>
          <Text variant="footnote" style={{ color: color.inkSoft }}>
            {host}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: color.accentTint }]}>
          <Text variant="footnote" style={{ color: color.accent }}>
            sieht nur Chiffretext
          </Text>
        </View>
      </View>

      {Option.match(panel, {
        onNone: () => (
          <Text variant="callout" style={[styles.padded, { color: color.inkSoft }]}>
            Wartet auf die Antwort des Servers.
          </Text>
        ),
        onSome: (view) => (
          <>
            <Section title="Spaces">
              {view.spaces.map((space) => (
                <Line
                  key={space.id}
                  text={space.name}
                  right={`v${space.version}`}
                  rightColor={color.ink}
                />
              ))}
            </Section>

            <Section title="Befehlslog">
              {view.commands.slice(0, 12).map((command) => (
                <Line
                  key={command.key}
                  mono
                  text={`${command.device} #${command.mutationId} ${command.what}`}
                  right={command.refusal ?? "angenommen"}
                  rightColor={command.refusal === null ? color.accent : color.danger}
                />
              ))}
            </Section>

            {view.notebooks.map((notebook) => (
              <Section key={notebook.space.id} title={`Zeilen in ${notebook.space.name}`}>
                {notebook.rows.length === 0 ? (
                  <Text variant="callout" style={{ color: color.inkSoft }}>
                    keine
                  </Text>
                ) : (
                  notebook.rows.map((row) => (
                    <View key={row.key} style={styles.row}>
                      <Text variant="footnote" style={[mono, { color: color.inkSoft }]}>
                        v{row.version} · {row.id} ·{" "}
                        {row.sealed ? `Chiffretext ${row.stored}` : row.stored}
                      </Text>
                      {row.seen.map((seen) => (
                        <Text key={seen.devices} variant="footnote" style={{ color: color.accent }}>
                          Gerät {seen.devices}: {seen.text}
                        </Text>
                      ))}
                    </View>
                  ))
                )}
              </Section>
            ))}
          </>
        ),
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1.2, minWidth: 340, gap: Tokens.space.md, paddingTop: Tokens.layout.cardPadding },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Tokens.space.md,
    paddingHorizontal: Tokens.layout.cardPadding,
  },
  title: { flexShrink: 1, gap: Tokens.space.xxs },
  badge: {
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
  },
  padded: { paddingHorizontal: Tokens.layout.cardPadding, paddingBottom: Tokens.space.lg },
  row: { gap: Tokens.space.xxs },
});
