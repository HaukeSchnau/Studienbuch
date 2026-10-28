import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Image, StyleSheet, Text, View } from "react-native";

import { Card } from "./Card.tsx";
import { Icon } from "./Icon.tsx";
import { Type } from "./Type.ts";

const warning = "/art/warning.svg";

/**
 * Stand-in for the app's absence summary with the yellow "!" (variant B) until M1 builds it in
 * packages/domain-ui.
 */
export function AbsenceCard({ unexcused, days }: { unexcused: number; days: number }) {
  const { color } = Theme.useTheme();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[Type.style("cardTitle"), { color: color.accent }]}>Fehlzeiten</Text>
        <Icon color={color.accent} name="plus" size={26} />
      </View>
      <View style={styles.body}>
        {/* `defaultSource` makes react-native-web render the image while prerendering. */}
        <Image defaultSource={{ uri: warning }} source={{ uri: warning }} style={styles.art} />
        <Text style={[Type.style("body"), styles.text, { color: color.ink }]}>
          Du hast noch <Text style={styles.strong}>{unexcused}</Text> unentschuldigte Fehlzeiten an{" "}
          <Text style={styles.strong}>{days}</Text> {days === 1 ? "Tag" : "Tagen"}.
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
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
  text: { flex: 1 },
  strong: { fontWeight: "700" },
});
