import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { StyleSheet, View } from "react-native";

/** What the device says about its connection, as a white chip under the hero's date. */
export function SyncChip({ children }: { readonly children: string }) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.chip, { backgroundColor: color.surface, boxShadow: elevation.float }]}
    >
      <Icon name="cloudOff" color={color.warning} size={20} />
      <Text variant="subhead" weight="bold">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: Tokens.space.xs + Tokens.space.xxs,
    minHeight: 32,
    marginTop: Tokens.space.sm,
    borderRadius: Tokens.radius.pill,
    paddingLeft: Tokens.space.sm + Tokens.space.xxs,
    paddingRight: Tokens.space.md + Tokens.space.xxs,
    paddingVertical: Tokens.space.xs,
  },
});
