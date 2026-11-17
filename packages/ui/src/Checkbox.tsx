import { StyleSheet, View } from "react-native";

import { Checkable } from "./Checkable.tsx";
import { Icon } from "./Icon.tsx";
import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface CheckboxProps {
  /** Such as "Öffentlicher Computer". */
  readonly label: string;
  /** A line under the label that says what ticking it does. */
  readonly description?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

/** A box to tick before its label, the whole row taking the touch. */
export function Checkbox({ label, description, checked, onChange }: CheckboxProps) {
  const { color } = Theme.useTheme();

  return (
    <Checkable
      kind="checkbox"
      checked={checked}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
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
      <View style={styles.text}>
        <Text variant="callout" weight={description === undefined ? "regular" : "semibold"}>
          {label}
        </Text>
        {description === undefined ? null : (
          <Text variant="subhead" style={{ color: color.inkSoft }}>
            {description}
          </Text>
        )}
      </View>
    </Checkable>
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
  text: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
});
