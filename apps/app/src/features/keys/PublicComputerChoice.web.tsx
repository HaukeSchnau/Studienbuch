import { useAtom } from "@effect/atom-react";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, View } from "react-native";

import { publicComputer } from "../../infra/device/publicComputer.ts";
import { AccountState } from "../account/AccountState.ts";

/**
 * "Öffentlicher Computer" (D44): the account that signs in next keeps nothing on this computer,
 * and the notebook unlocks again on every visit. An account the device holds already stays where
 * it is, so the choice shows only while the device holds none.
 */
export function PublicComputerChoice() {
  const { color } = Theme.useTheme();
  const [checked, setChecked] = useAtom(publicComputer);
  const access = AccountState.useAccess();

  if (access !== "signed-out") return null;

  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
      onPress={() => setChecked(!checked)}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? color.accent : color.inkSoft,
            backgroundColor: checked ? color.accent : "transparent",
          },
        ]}
      >
        {checked ? <Icon name="check" color={color.onAccent} size={16} /> : null}
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
