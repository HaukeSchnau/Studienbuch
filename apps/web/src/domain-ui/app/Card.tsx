import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { StyleSheet, View, type ViewProps } from "react-native";

/**
 * Stand-in for the app's `Card` (apps/app/src/ui): a white card on the canvas. Light cards lift by
 * their shadow, dark ones by a hairline.
 */
export function Card({ style, ...props }: ViewProps) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: color.surface, borderColor: color.cardEdge, boxShadow: elevation.card },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Tokens.radius.card,
    borderWidth: 1,
    // Rows inside reach the rounded edge and must not paint over it.
    overflow: "hidden",
  },
});
