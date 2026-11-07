import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "./Icon.tsx";
import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface CheckboxProps {
  /** Such as "Ich bin volljährig." */
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

/**
 * A statement to tick, the label first and the box at the right end of the row, as the Flutter
 * app's CheckboxListTile. The whole row takes the touch.
 */
export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  const { color } = Theme.useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <Text variant="callout" style={styles.label}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? color.accent : color.inkSoft,
            backgroundColor: checked ? color.accent : "transparent",
          },
        ]}
      >
        {checked ? <Icon name="check" color={color.onAccent} size={18} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: Tokens.layout.minTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    cursor: "pointer",
  },
  label: { flex: 1 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
});
