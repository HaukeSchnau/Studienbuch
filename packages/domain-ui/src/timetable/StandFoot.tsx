import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { StyleSheet, View } from "react-native";

import type { AgendaItem } from "./AgendaItem.ts";

/** The old Stand in amber at the foot of the card it qualifies: the day's lessons, or the week. */
export function StandFoot({ stand }: { readonly stand: AgendaItem.Stand }) {
  const { color } = Theme.useTheme();

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      style={[styles.stand, { backgroundColor: color.warningTint }]}
    >
      <Icon name="clock" color={color.warning} size={18} />
      <View style={styles.grow}>
        <Text variant="footnote" weight="bold" style={{ color: color.warning }}>
          {stand.title}
        </Text>
        <Text variant="footnote" style={{ color: color.ink }}>
          {stand.hint}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stand: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Tokens.space.sm,
    paddingHorizontal: Tokens.layout.cardPadding,
    paddingTop: 10,
    paddingBottom: Tokens.space.md,
  },
  grow: { flex: 1 },
});
