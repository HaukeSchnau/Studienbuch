import latin from "@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2";
import latinExtended from "@fontsource-variable/nunito/files/nunito-latin-ext-wght-normal.woff2";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";

// Nunito's variable font, as @fontsource-variable/nunito declares it. Metro bundles no files that CSS
// links to, so the faces name the asset URLs Metro gives the imports. German needs latin and
// latin-ext only.
const face = (file: string, unicodeRange: string) =>
  `@font-face{font-family:"Nunito Variable";font-style:normal;font-display:swap;font-weight:200 1000;src:url(${file}) format("woff2-variations");unicode-range:${unicodeRange}}`;

const fonts = [
  face(
    latin,
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  ),
  face(
    latinExtended,
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  ),
].join("\n");

/**
 * The CSS variables behind `Theme.useTheme()`, the font, and the browser's bar in the hero's green.
 * React hoists all of it into the document's head.
 */
export function WebStyles() {
  return (
    <>
      <style href="studienbuch-theme" precedence="default">
        {`${fonts}\n${Theme.css}`}
      </style>
      <meta
        name="theme-color"
        media="(prefers-color-scheme: light)"
        content={Tokens.color.light.hero}
      />
      <meta
        name="theme-color"
        media="(prefers-color-scheme: dark)"
        content={Tokens.color.dark.hero}
      />
    </>
  );
}
