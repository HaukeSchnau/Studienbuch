import { describe, expect, it } from "@effect/vitest";

import { Tokens } from "./Tokens.ts";

// WCAG 2 contrast ratio of two `#RRGGBB` colours.
const contrast = (foreground: string, background: string) => {
  const luminance = (hex: string) => {
    const channel = (offset: number) => {
      const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;

      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };

  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);

  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
};

const white = "#FFFFFF";

// Body text needs 4.5:1. Text of at least 24 px, or 19 px bold, needs 3:1.
const body = 4.5;
const large = 3;

// The pairs of design-language.md's contrast table, against the WCAG minimum rather than the
// measured ratio, so a token can move as long as it stays readable.
const pairs = (palette: Tokens.Palette, scheme: Tokens.Scheme) =>
  [
    ["ink on canvas", palette.ink, palette.canvas, body],
    ["ink on surface", palette.ink, palette.surface, body],
    ["inkSoft on canvas", palette.inkSoft, palette.canvas, body],
    ["inkSoft on surface", palette.inkSoft, palette.surface, body],
    ["accent on surface", palette.accent, palette.surface, body],
    ["accent on canvas", palette.accent, palette.canvas, body],
    ["accent on accentTint", palette.accent, palette.accentTint, body],
    ["onAccent on accent", palette.onAccent, palette.accent, body],
    ["onAction on action", palette.onAction, palette.action, body],
    ["white on hero", white, palette.hero, scheme === "light" ? large : body],
    ["white on panel", white, palette.panel, large],
    ["panelTitle on panelCard", palette.panelTitle, palette.panelCard, body],
    ["panelDue on panelCard", palette.panelDue, palette.panelCard, body],
    ["danger on dangerTint", palette.danger, palette.dangerTint, body],
    ["warning on warningTint", palette.warning, palette.warningTint, body],
  ] as const;

describe("Tokens", () => {
  for (const scheme of ["light", "dark"] as const) {
    const palettes = {
      [scheme]: Tokens.color[scheme],
      [`${scheme}, high contrast`]: { ...Tokens.color[scheme], ...Tokens.highContrast[scheme] },
    };

    for (const [name, palette] of Object.entries(palettes)) {
      it.each(pairs(palette, scheme))(
        `${name}: %s is readable`,
        (_, foreground, background, minimum) => {
          expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
        },
      );
    }
  }

  it.each(Object.entries(Tokens.subject))(
    "white labels on the %s subject fill are readable",
    (_, slot) => {
      expect(contrast(white, slot.fill)).toBeGreaterThanOrEqual(body);
    },
  );

  it("measures the reference pair of the design table", () => {
    // White on the brand green is the reason text moved to #097D00 (D50).
    expect(contrast(white, Tokens.color.light.hero)).toBeCloseTo(3.24, 2);
  });
});
