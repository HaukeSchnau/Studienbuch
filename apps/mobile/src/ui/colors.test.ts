import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { colors } from "./colors";

/**
 * Tailwind needs literal values at build time, so it cannot read the palette out of TypeScript, and
 * React Native `StyleSheet` values cannot read it out of CSS. The palette therefore exists twice:
 * `@theme` in `global.css` for every `className`, and `colors` here for `StyleSheet` and inline
 * styles. Nothing kept the two in step.
 *
 * This is the cheap half of the fix: no code generation, but the two cannot contradict each other
 * silently. A token defined on only one side stays legitimate -- not every `className` colour needs
 * a `StyleSheet` counterpart, or the reverse.
 */
const themeVariables = (): ReadonlyMap<string, string> => {
  const css = readFileSync(fileURLToPath(new URL("../global.css", import.meta.url)), "utf8");
  const block = /@theme\s*\{([^}]*)\}/u.exec(css)?.[1] ?? "";
  return new Map(
    [...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/gu)].flatMap((match) => {
      const [, name, value] = match;
      return name === undefined || value === undefined
        ? []
        : [[`--color-${name}`, value.toLowerCase()] as const];
    }),
  );
};

interface ColorGroup {
  readonly [token: string]: string | ColorGroup;
}

/** `DEFAULT` is Tailwind's name for the bare `--color-<group>` variable. */
const flatten = (group: ColorGroup, prefix: string): ReadonlyArray<readonly [string, string]> =>
  Object.entries(group).flatMap(([key, value]) => {
    const name = key === "DEFAULT" ? prefix : `${prefix}-${key}`;
    return Schema.is(Schema.String)(value)
      ? [[name, value.toLowerCase()] as const]
      : flatten(value, name);
  });

describe("mobile palette", () => {
  const theme = themeVariables();

  it("reads a non-empty @theme block", () => {
    expect(theme.size).toBeGreaterThan(0);
  });

  it("agrees with global.css wherever both define a token", () => {
    const mismatches = flatten(colors, "--color")
      .filter(([name]) => theme.has(name))
      .filter(([name, value]) => theme.get(name) !== value)
      .map(([name, value]) => `${name}: colors=${value} css=${theme.get(name)}`);

    expect(mismatches).toEqual([]);
  });
});
