import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { ScrollView, StyleSheet, View } from "react-native";

import { ServerOrigin } from "../../infra/api/ServerOrigin.ts";
import { AgreementBar } from "./AgreementBar.tsx";
import { DevicePane } from "./DevicePane.tsx";
import { LabDevice } from "./LabDevice.ts";
import { ServerPane } from "./ServerPane.tsx";

const environments = { development: "Entwicklung", preview: "Vorschau" } as const;

/**
 * Three devices and the server side by side. B going offline, homework on A and B, and B coming
 * back is the three-click check of M1 (sync.md, "Sync Lab").
 */
export function SyncLabScreen({
  environment,
}: {
  readonly environment: keyof typeof environments;
}) {
  const { color } = Theme.useTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: color.canvas }}
      contentContainerStyle={styles.page}
    >
      <View style={styles.header}>
        <Text variant="title1">Sync Lab</Text>
        <View style={[styles.badge, { backgroundColor: color.actionTint }]}>
          <Text variant="footnote" style={{ color: color.action }}>
            {environments[environment]}
          </Text>
        </View>
      </View>
      <AgreementBar />
      <View style={styles.columns}>
        {LabDevice.ids.map((id) => (
          <DevicePane key={id} id={id} />
        ))}
        <ServerPane host={Option.getOrElse(ServerOrigin.host, () => "")} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: Tokens.space.xl, gap: Tokens.space.lg },
  header: { flexDirection: "row", alignItems: "center", gap: Tokens.space.md },
  badge: {
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
  },
  columns: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: Tokens.space.lg,
  },
});
