import { Text, type Variant } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { StyleSheet } from "react-native";

import type { AgendaItem } from "./AgendaItem.ts";

export interface NamedTextProps {
  readonly named: AgendaItem.Named;
  readonly variant?: Variant;
}

/** A teacher or room inside a line of text, the old one struck through before the new one in bold. */
export function NamedText({ named, variant = "subhead" }: NamedTextProps) {
  const { color } = Theme.useTheme();

  if (named.was === undefined) return named.now;

  return (
    <>
      <Text variant={variant} style={[styles.struck, { textDecorationColor: color.danger }]}>
        {named.was}
      </Text>
      {named.now === "" ? null : (
        <Text variant={variant} weight="bold" style={{ color: color.ink }}>
          {` ${named.now}`}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  struck: { textDecorationLine: "line-through", textDecorationStyle: "solid" },
});
