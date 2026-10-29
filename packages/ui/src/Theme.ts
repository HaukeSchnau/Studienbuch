import * as Record from "effect/Record";
import { Platform, useColorScheme } from "react-native";

import { Tokens } from "./Tokens.ts";

// How the tokens reach each platform (design-language.md, section 4). On native, components get the
// values of the current scheme. On the web they get CSS variable references, and `css` switches the
// variables by media query, so server-rendered HTML is right in light, dark and high contrast before
// any script runs.
export * as Theme from "./Theme.ts";

/** A subject's colours in the current scheme: `fill` carries white labels, `tint` and `text` go together. */
export interface SubjectColors {
  readonly fill: string;
  readonly tint: string;
  readonly text: string;
}

export interface Values {
  readonly color: Tokens.Palette;
  readonly elevation: Readonly<Record.ReadonlyRecord<Tokens.ElevationName, string>>;
  readonly subject: Readonly<Record.ReadonlyRecord<Tokens.SubjectSlot, SubjectColors>>;
}

// Fontsource registers the variable web font as "Nunito Variable".
const webFontStack = '"Nunito Variable", Nunito, system-ui, sans-serif';

export const fontFamily = Platform.OS === "web" ? webFontStack : Tokens.fontFamily;

const variable = (group: string, name: string) =>
  `--${group}-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

const declarations = (group: string, values: Record.ReadonlyRecord<string, string>) =>
  Record.collect(values, (name, value) => `${variable(group, name)}:${value};`).join("");

const subjects: Record.ReadonlyRecord<
  Tokens.Scheme,
  Record.ReadonlyRecord<Tokens.SubjectSlot, SubjectColors>
> = {
  light: Record.map(Tokens.subject, ({ fill, tint, text }) => ({ fill, tint, text })),
  dark: Record.map(Tokens.subject, ({ fill, tintDark, textDark }) => ({
    fill,
    tint: tintDark,
    text: textDark,
  })),
};

// One variable per slot and colour, such as `--subject-red-tint`.
const subjectVariables = (name: Tokens.Scheme) =>
  Object.fromEntries(
    Record.collect(subjects[name], (slot, colors) =>
      Record.collect(colors, (kind, value) => [`${slot}-${kind}`, value] as const),
    ).flat(),
  );

const scheme = (name: Tokens.Scheme) =>
  declarations("color", Tokens.color[name]) +
  declarations("elevation", Tokens.elevation[name]) +
  declarations("subject", subjectVariables(name));

/** The CSS custom properties behind `useTheme()` on the web. Render it in the document's `<head>`. */
export const css = [
  `:root{color-scheme:light dark;--font-family:${webFontStack};${scheme("light")}}`,
  `@media (prefers-color-scheme:dark){:root{${scheme("dark")}}}`,
  `@media (prefers-color-scheme:light) and (prefers-contrast:more){:root{${declarations("color", Tokens.highContrast.light)}}}`,
  `@media (prefers-color-scheme:dark) and (prefers-contrast:more){:root{${declarations("color", Tokens.highContrast.dark)}}}`,
].join("\n");

const references: Values = {
  color: Record.map(Tokens.color.light, (_, name) => `var(${variable("color", name)})`),
  elevation: Record.map(Tokens.elevation.light, (_, name) => `var(${variable("elevation", name)})`),
  subject: Record.map(subjects.light, (colors, slot) =>
    Record.map(colors, (_, kind) => `var(${variable("subject", `${slot}-${kind}`)})`),
  ),
};

const schemes: Record.ReadonlyRecord<Tokens.Scheme, Values> = {
  light: { color: Tokens.color.light, elevation: Tokens.elevation.light, subject: subjects.light },
  dark: { color: Tokens.color.dark, elevation: Tokens.elevation.dark, subject: subjects.dark },
};

/** Colours, subject colours and elevations for styles that depend on the colour scheme. */
export const useTheme = (): Values => {
  const colorScheme = useColorScheme();

  return Platform.OS === "web" ? references : schemes[colorScheme === "dark" ? "dark" : "light"];
};
