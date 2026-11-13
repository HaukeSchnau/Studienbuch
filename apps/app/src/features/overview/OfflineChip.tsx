import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { StyleSheet, View } from "react-native";

/**
 * The white chip under the hero's subtitle while the device is offline (m1-screens.md): "Offline",
 * or how many changes wait for the network. Online it is gone, and its line stays empty, so the
 * panel below doesn't move with the connection.
 */
export function OfflineChip({
  offline,
}: {
  readonly offline: Option.Option<{ readonly waiting: number }>;
}) {
  const { color, elevation } = Theme.useTheme();

  return (
    // The line is the live region, so a screen reader hears the chip come.
    <View accessibilityLiveRegion="polite" style={styles.line}>
      {Option.match(offline, {
        onNone: () => null,
        onSome: ({ waiting }) => (
          <View
            style={[styles.chip, { backgroundColor: color.surface, boxShadow: elevation.float }]}
          >
            <Icon name="cloudOff" color={color.warning} size={20} />
            <Text variant="subhead" weight="bold">
              {waiting === 0
                ? "Offline"
                : waiting === 1
                  ? "Offline, 1 Änderung wartet"
                  : `Offline, ${String(waiting)} Änderungen warten`}
            </Text>
          </View>
        ),
      })}
    </View>
  );
}

const chipHeight = 32;

const styles = StyleSheet.create({
  line: { minHeight: chipHeight + Tokens.space.sm },
  chip: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    minHeight: chipHeight,
    marginTop: Tokens.space.sm,
    borderRadius: Tokens.radius.pill,
    paddingLeft: Tokens.space.sm + Tokens.space.xxs,
    paddingRight: Tokens.space.md + Tokens.space.xxs,
    paddingVertical: Tokens.space.xs,
  },
});
