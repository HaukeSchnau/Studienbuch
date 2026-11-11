import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { StyleSheet, View } from "react-native";

/**
 * The white chip under the hero's subtitle while the device is offline (m1-screens.md): "Offline",
 * or how many changes wait for the network. Online, the screen shows none.
 */
export function OfflineChip({ waiting }: { readonly waiting: number }) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
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
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    marginTop: Tokens.space.sm,
    borderRadius: Tokens.radius.pill,
    paddingLeft: Tokens.space.sm + Tokens.space.xxs,
    paddingRight: Tokens.space.md + Tokens.space.xxs,
    paddingVertical: Tokens.space.xs,
  },
});
