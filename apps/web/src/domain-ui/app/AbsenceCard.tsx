import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Image, StyleSheet, Text, View } from "react-native";

import { Plus } from "./Glyph.tsx";
import { Type } from "./Type.ts";

const warning = "/art/warning.svg";

/**
 * Stand-in for the app's absence summary with the yellow "!" (design-language.md, variant B) until
 * M1 builds it in packages/domain-ui.
 */
export function AbsenceCard({ unexcused, days }: { unexcused: number; days: number }) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: color.surface, borderColor: color.cardEdge, boxShadow: elevation.card },
      ]}
    >
      <View style={styles.header}>
        <Text style={[Type.style("title2"), { color: color.accent }]}>Fehlzeiten</Text>
        <Plus color={color.accent} />
      </View>
      <View style={styles.body}>
        {/* `defaultSource` makes react-native-web render the image while prerendering. */}
        <Image
          accessibilityIgnoresInvertColors
          defaultSource={{ uri: warning }}
          source={{ uri: warning }}
          style={styles.art}
        />
        <Text style={[Type.style("body"), styles.grow, { color: color.ink }]}>
          Du hast noch <Text style={styles.strong}>{unexcused}</Text> unentschuldigte Fehlzeiten an{" "}
          <Text style={styles.strong}>{days}</Text> {days === 1 ? "Tag" : "Tagen"}.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Tokens.radius.card,
    borderWidth: 1,
    padding: Tokens.layout.cardPadding,
    paddingRight: Tokens.space.lg,
    gap: Tokens.space.md,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  body: { flexDirection: "row", alignItems: "center", gap: Tokens.space.lg },
  art: { width: 30, height: 56, transform: [{ rotate: "-14deg" }] },
  grow: { flex: 1 },
  strong: { fontWeight: "800" },
});
