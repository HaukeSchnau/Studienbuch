import { StyleSheet, View } from "react-native";

import { Arrive } from "./Arrive.tsx";
import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Underline } from "./Underline.tsx";
import { useFocusOnMount } from "./useFocusOnMount.ts";
import { useLastLine } from "./useLastLine.ts";

export interface AuthHeadingProps {
  /** One short title per step, such as "Willkommen!" or "Konto erstellen". */
  readonly children: string;
}

/**
 * A step's title, centred in the accent green, with the blue swoosh under it that draws itself
 * once the words have arrived (the old web's AuthHeading). A title that wraps has the swoosh under
 * its last line. A new title draws it again and takes the screen reader's focus.
 */
export function AuthHeading({ children }: AuthHeadingProps) {
  return <Title key={children}>{children}</Title>;
}

function Title({ children }: AuthHeadingProps) {
  const { color } = Theme.useTheme();
  const words = useLastLine();
  const focus = useFocusOnMount();

  return (
    <Arrive duration={720} style={styles.heading}>
      {/* A new step's title takes the focus, so a screen reader announces the step. */}
      <View
        ref={focus}
        accessible
        accessibilityRole="header"
        accessibilityLabel={children}
        tabIndex={-1}
        style={styles.focusable}
      >
        <View {...words.container}>
          <Text {...words.text} variant="title1" style={[styles.title, { color: color.accent }]}>
            {children}
          </Text>
        </View>
      </View>
      {words.line === undefined ? null : <Underline line={words.line} color={color.heroEdge} />}
    </Arrive>
  );
}

const styles = StyleSheet.create({
  // A title may reach 8 points into the card's padding, so "Passwort vergessen?" stays on one
  // line at 390 points, as on the old web.
  heading: { alignSelf: "center", marginHorizontal: -8 },
  // The old web's text-3xl, Nunito Bold.
  title: { fontSize: 30, lineHeight: 36, fontWeight: "700", textAlign: "center" },
  // The focus moves here by script, so the browser's ring would only flash.
  focusable: { outlineStyle: "solid", outlineWidth: 0 },
});
