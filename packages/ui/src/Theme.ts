import * as Record from "effect/Record";
import { Platform, useColorScheme } from "react-native";

import { Tokens } from "./Tokens.ts";

// How the tokens reach each platform (design-language.md, section 4). On native, components get the
// values of the current scheme. On the web they get CSS variable references, and `css` switches the
// variables by media query, so server-rendered HTML is right in light, dark and high contrast before
// any script runs.
export * as Theme from "./Theme.ts";

export interface Values {
  readonly color: Tokens.Palette;
  readonly elevation: Readonly<Record.ReadonlyRecord<Tokens.ElevationName, string>>;
}

// Fontsource registers the variable web font as "Nunito Variable".
const webFontStack = '"Nunito Variable", Nunito, system-ui, sans-serif';

export const fontFamily = Platform.OS === "web" ? webFontStack : Tokens.fontFamily;

const variable = (group: string, name: string) =>
  `--${group}-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

const declarations = (group: string, values: Record.ReadonlyRecord<string, string>) =>
  Record.collect(values, (name, value) => `${variable(group, name)}:${value};`).join("");

const scheme = (name: Tokens.Scheme) =>
  declarations("color", Tokens.color[name]) + declarations("elevation", Tokens.elevation[name]);

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
};

const schemes: Record.ReadonlyRecord<Tokens.Scheme, Values> = {
  light: { color: Tokens.color.light, elevation: Tokens.elevation.light },
  dark: { color: Tokens.color.dark, elevation: Tokens.elevation.dark },
};

/** Colours and elevations for styles that depend on the colour scheme. */
export const useTheme = (): Values => {
  const colorScheme = useColorScheme();

  return Platform.OS === "web" ? references : schemes[colorScheme === "dark" ? "dark" : "light"];
};
