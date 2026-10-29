import * as Record from "effect/Record";
import { Text as NativeText, StyleSheet, type TextProps as NativeTextProps } from "react-native";

import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";

export type Variant = keyof typeof Tokens.type;

const weights = { regular: "400", medium: "500", semibold: "600", bold: "700" } as const;

export type Weight = keyof typeof weights;

export interface TextProps extends NativeTextProps {
  readonly variant?: Variant;
  /** Replaces the token's weight, for a word that must stand out at its size or a quieter label. */
  readonly weight?: Weight;
}

/**
 * Text in Nunito at one of the type tokens. On iOS it follows Dynamic Type along the token's own text
 * style, so a large title grows less than body text; Android scales `sp` the same way by itself.
 */
export function Text({ variant = "body", weight, style, ...props }: TextProps) {
  const { color } = Theme.useTheme();
  const token: (typeof Tokens.type)[Variant] = Tokens.type[variant];

  return (
    <NativeText
      dynamicTypeRamp={token.ios}
      maxFontSizeMultiplier={"maxScale" in token ? token.maxScale : undefined}
      style={[
        styles[variant],
        { color: color.ink },
        weight === undefined ? null : { fontWeight: weights[weight] },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create(
  Record.map(Tokens.type, (token) => ({
    fontFamily: Theme.fontFamily,
    fontSize: token.size,
    lineHeight: token.line,
    fontWeight: token.weight,
  })),
);
