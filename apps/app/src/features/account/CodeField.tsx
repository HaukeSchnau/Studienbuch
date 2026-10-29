import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { Text } from "../../ui/Text.tsx";

export const codeLength = 6;

export interface CodeFieldProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
}

/**
 * The code from the mail in six boxes. A plain text field lies under them and takes every touch
 * through them, so typing, pasting and the keyboard's one-time-code suggestion work as in any
 * field, while the boxes, on the card's colour, cover its text.
 */
export function CodeField({ value, onChangeText }: CodeFieldProps) {
  const { color } = Theme.useTheme();
  const focus = useFocused();
  const next = Math.min(value.length, codeLength - 1);

  return (
    <View>
      <TextInput
        accessibilityLabel="Code aus der E-Mail"
        value={value}
        onChangeText={onChangeText}
        onFocus={() => focus.set(true)}
        onBlur={() => focus.set(false)}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        keyboardType="number-pad"
        inputMode="numeric"
        caretHidden
        style={[StyleSheet.absoluteFill, styles.input]}
      />
      <View
        style={[styles.boxes, { backgroundColor: color.surface }]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: codeLength }, (_, index) => {
          const active = focus.focused && index === next;

          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  backgroundColor: color.canvas,
                  borderColor: active ? color.accent : color.hairline,
                  borderWidth: active ? 2 : 1,
                },
              ]}
            >
              <Text variant="title1">{value[index] ?? ""}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Whether a field has the focus, for its edge. */
export function useFocused() {
  const [focused, set] = useState(false);

  return { focused, set };
}

const styles = StyleSheet.create({
  boxes: { flexDirection: "row", gap: Tokens.space.sm, pointerEvents: "none" },
  box: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    // The boxes show the focus, so the browser's own ring would frame all six.
    outlineStyle: "solid",
    outlineWidth: 0,
    // Below 16 points, mobile Safari zooms into the page on focus.
    fontSize: 16,
  },
});
