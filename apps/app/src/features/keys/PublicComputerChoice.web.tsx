import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, View } from "react-native";

import { publicComputer, setPublicComputer } from "../../infra/device/publicComputer.ts";

/**
 * "Öffentlicher Computer" (D44): the tab keeps nothing, and the notebook unlocks again on every
 * visit. Switching reloads the tab, so it sits above the fields, before anything is typed.
 */
export function PublicComputerChoice() {
  const { color } = Theme.useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={publicComputer}
      onPress={() => setPublicComputer(!publicComputer)}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: publicComputer ? color.accent : color.inkSoft,
            backgroundColor: publicComputer ? color.accent : "transparent",
          },
        ]}
      >
        {publicComputer ? <Icon name="check" color={color.onAccent} size={16} /> : null}
      </View>
      <View style={styles.grow}>
        <Text variant="callout" weight="semibold">
          Öffentlicher Computer
        </Text>
        <Text variant="subhead" style={{ color: color.inkSoft }}>
          Nichts auf diesem Computer speichern. Du entsperrst dein Notizbuch bei jedem Besuch neu.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: Tokens.space.md, alignItems: "flex-start" },
  box: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1, gap: 2 },
});
