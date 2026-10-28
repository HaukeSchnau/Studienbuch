import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";

// React Native text styles from the type tokens. M1's `Text` component in packages/ui replaces this,
// together with the Dynamic Type ramp each token names.
export * as Type from "./Type.ts";

export const style = (token: keyof typeof Tokens.type) => ({
  fontFamily: Theme.fontFamily,
  fontSize: Tokens.type[token].size,
  lineHeight: Tokens.type[token].line,
  fontWeight: Tokens.type[token].weight,
});
