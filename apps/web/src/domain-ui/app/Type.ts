import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";

// The stand-ins' text styles: the type tokens' sizes, with the calmer weights Hauke asked for on the
// phones (semibold for titles and key numbers, regular for secondary text). M1's `Text` in
// packages/ui replaces this, and with it the question whether the tokens' weights should follow.
export * as Type from "./Type.ts";

const roles = {
  heroTitle: ["display", "700"],
  heroSubtitle: ["title3", "600"],
  cardTitle: ["title2", "700"],
  rowTitle: ["title3", "600"],
  figure: ["figure", "700"],
  figureUnit: ["title3", "600"],
  points: ["title1", "700"],
  title: ["headline", "600"],
  button: ["callout", "700"],
  chip: ["subhead", "600"],
  body: ["callout", "400"],
  detail: ["subhead", "400"],
  label: ["footnote", "500"],
  status: ["footnote", "600"],
  cell: ["caption", "700"],
  cellDetail: ["caption", "500"],
} as const satisfies Record<string, readonly [keyof typeof Tokens.type, string]>;

export type Role = keyof typeof roles;

export const style = (role: Role) => {
  const [token, fontWeight] = roles[role];

  return {
    fontFamily: Theme.fontFamily,
    fontSize: Tokens.type[token].size,
    lineHeight: Tokens.type[token].line,
    fontWeight,
  };
};
