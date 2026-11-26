import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, View } from "react-native";

import type { WeekItem } from "./WeekItem.ts";

export interface DaySwitchProps {
  readonly days: ReadonlyArray<WeekItem.Day>;
  /** Index into `days`. */
  readonly selected: number;
  readonly onSelect: (index: number) => void;
}

/**
 * The week's days as buttons above the day list, which takes the grid's place at large text sizes
 * (design-language rule 7). The chosen day is green.
 */
export function DaySwitch({ days, selected, onSelect }: DaySwitchProps) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {days.map((day, index) => {
        const chosen = index === selected;

        return (
          <Pressable
            key={day.id}
            accessibilityRole="tab"
            accessibilityLabel={`${day.long}, ${day.date}`}
            aria-selected={chosen}
            onPress={() => onSelect(index)}
            style={({ pressed }) => [
              styles.day,
              {
                backgroundColor: chosen ? color.accent : color.surface,
                borderColor: color.cardEdge,
                boxShadow: elevation.card,
              },
              pressed ? styles.pressed : null,
            ]}
          >
            <Text variant="headline" style={{ color: chosen ? color.onAccent : color.inkSoft }}>
              {day.short}
            </Text>
            <Text
              variant="title3"
              weight="bold"
              style={{ color: chosen ? color.onAccent : color.ink }}
            >
              {day.date}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6 },
  day: {
    flex: 1,
    minHeight: Tokens.layout.minTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    cursor: "pointer",
  },
  pressed: { opacity: 0.8 },
});
