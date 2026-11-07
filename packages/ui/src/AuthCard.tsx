import type { ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Arrive } from "./Arrive.tsx";
import { Grow } from "./Grow.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export interface AuthCardProps {
  readonly children: ReactNode;
}

/**
 * The one white card of a sign-in or setup step. It arrives from below after the logo, and when
 * its content changes, from one step to the next or as an error appears, it grows or shrinks to
 * fit in 300 ms. Light cards lift by their shadow, dark ones by a hairline.
 */
export function AuthCard({ children }: AuthCardProps) {
  const { color, elevation } = Theme.useTheme();
  const { width } = useWindowDimensions();

  return (
    <Arrive delay={110}>
      <Grow
        style={[
          styles.card,
          {
            backgroundColor: color.surface,
            outlineColor: color.cardEdge,
            boxShadow: elevation.raised,
          },
        ]}
      >
        <View style={width >= wide ? styles.contentWide : styles.content}>{children}</View>
      </Grow>
    </Arrive>
  );
}

// The old web's card padding grows from its `sm` breakpoint.
const wide = 640;

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: Tokens.radius.panel,
    // The dark card's hairline, drawn outside so it takes no room from the old web's padding.
    outlineStyle: "solid",
    outlineWidth: 1,
  },
  content: { padding: 28 },
  contentWide: { padding: 36 },
});
