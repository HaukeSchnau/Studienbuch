import * as Option from "effect/Option";
import { StyleSheet, View } from "react-native";

import { Checkable } from "./Checkable.tsx";
import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface PillChoiceProps<A extends string | number | boolean> {
  /** The question, such as "Jahrgang" or "Bist du volljährig?". */
  readonly label: string;
  readonly options: ReadonlyArray<{ readonly value: A; readonly label: string }>;
  readonly value: Option.Option<A>;
  readonly onChange: (value: A) => void;
}

/**
 * One of a few values, such as the Jahrgang or a Ja/Nein answer: the old web's grey pills in a row,
 * the chosen one green. With at most a dozen options, every one stays in view.
 */
export function PillChoice<A extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: PillChoiceProps<A>) {
  const { color } = Theme.useTheme();

  return (
    <View style={styles.field} accessibilityRole="radiogroup" aria-label={label}>
      <Text variant="subhead" weight="medium" style={[styles.label, { color: color.ink }]}>
        {label}
      </Text>
      <View style={styles.pills}>
        {options.map((option) => {
          const chosen = Option.contains(value, option.value);

          return (
            <Checkable
              key={String(option.value)}
              kind="radio"
              checked={chosen}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: chosen ? color.accent : color.fieldFill },
                pressed ? styles.pressed : null,
              ]}
            >
              <Text
                variant="callout"
                weight={chosen ? "semibold" : "regular"}
                style={{ color: chosen ? color.onAccent : color.ink }}
              >
                {option.label}
              </Text>
            </Checkable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Tokens.space.sm },
  label: { fontSize: 14, lineHeight: 20 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: Tokens.space.sm },
  pill: {
    paddingHorizontal: 20,
    borderRadius: Tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
});
