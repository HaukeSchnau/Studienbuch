import { StyleSheet, View, type ViewProps } from "react-native";

import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface CardProps extends ViewProps {
  /** A heading in the accent green, such as "Fehlzeiten" or "Mit E-Mail und Passwort". */
  readonly title?: string | undefined;
  /** Pads the content and spaces it out, for a form or text. Rows of a list stay edge to edge. */
  readonly padded?: boolean;
}

/** A white card on the canvas. Light cards lift by their shadow, dark ones by a hairline. */
export function Card({ title, padded = false, style, children, ...props }: CardProps) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View
      style={[
        styles.card,
        padded ? styles.padded : null,
        { backgroundColor: color.surface, borderColor: color.cardEdge, boxShadow: elevation.card },
        style,
      ]}
      {...props}
    >
      {title === undefined ? null : (
        <Text
          variant="title2"
          accessibilityRole="header"
          style={[padded ? null : styles.title, { color: color.accent }]}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Tokens.radius.card,
    borderWidth: 1,
    // Rows inside reach the rounded edge and must not paint over it.
    overflow: "hidden",
  },
  padded: { padding: Tokens.layout.cardPadding, gap: Tokens.space.lg },
  title: {
    paddingHorizontal: Tokens.layout.cardPadding,
    paddingTop: Tokens.space.lg,
    paddingBottom: Tokens.space.xs,
  },
});
