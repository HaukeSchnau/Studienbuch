/**
 * Where a rule runs, as globs from the repository root in oxlint's override form. A rule module in
 * rules/ exports one as `scope`; a rule without it runs on every file.
 */
export interface Scope {
  readonly files?: ReadonlyArray<string>;
  readonly excludeFiles?: ReadonlyArray<string>;
}

/**
 * The globs plus the same globs under tools/oxlint/fixtures. The fixtures mirror the repository
 * layout, so every scoped rule also covers the fixture that proves it.
 */
export const withFixtures = (...globs: ReadonlyArray<string>) =>
  globs.flatMap((glob) => [glob, `tools/oxlint/fixtures/${glob}`]);

export const tests = ["**/*.{test,spec}.{ts,tsx}"];

/** Code in a web or native client bundle. */
export const clientCode = withFixtures("apps/app/**", "apps/web/**", "packages/**");

/** React code. Elsewhere a function named `use`, such as `HttpRouter.use`, is no hook. */
export const reactCode = withFixtures("apps/app/**", "apps/web/**", "packages/{ui,domain-ui}/**");

/** The apps' and packages' own source, without their configs and scripts. */
export const sources = withFixtures("apps/*/src/**", "packages/*/src/**");
