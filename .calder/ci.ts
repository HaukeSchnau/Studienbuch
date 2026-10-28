import { Files, Flake, Nix, On, Step, Task, cmd } from "@calder-ci/core";
import { Environments, Pnpm, Vitest } from "@calder-ci/std";
import { Schema } from "effect";
import { flake } from "./flake.ts";

const shell = flake.devShells.ci;
const install = Pnpm.install({ shell });

// The checks of `tools/check-changed`, over the whole repository: format, type-aware lint, knip, a
// typecheck of every project and every test.

const fmt = Task.make("fmt", { shell, setup: install, run: cmd`vp fmt --check` });
const lint = Task.make("lint", { shell, setup: install, run: cmd`vp lint` });
const knip = Task.make("knip", { shell, setup: install, run: cmd`knip` });

/**
 * Every project, which check:changed takes to be a directory under apps, packages or tools with its
 * own tsconfig.json. All of them take seconds together, less than a task of its own costs each.
 */
const typecheck = Task.make("typecheck", {
  shell,
  setup: install,
  run: cmd`bash -c ${[
    "status=0",
    'for config in apps/*/tsconfig.json packages/*/tsconfig.json tools/*/tsconfig.json; do tsc --noEmit -p "$config" || status=1; done',
    "exit $status",
  ].join("\n")}`,
});

/**
 * The tests that need PostgreSQL start a throwaway PostgreSQL 18 of their own (`Postgres18.setup.ts`
 * in packages/sync) and skip without one. In CI they fail instead.
 */
const postgres18 = [
  "bash",
  "-c",
  `postgres --version | grep -q '(PostgreSQL) 18\\.' || { echo "The dev shell has no PostgreSQL 18" >&2; exit 1; }`,
];
const postgresSetup = "packages/sync/src/testing/Postgres18.setup.ts";

/** A package's tests, grouped as check:changed groups them: by the nearest vite.config.ts. */
const tests = [
  // Packages without a config of their own run under the root's. Calder's globs can't exclude, so
  // each such package is listed, and a new one needs its line here.
  Vitest.files({
    name: "test",
    shell,
    setup: install,
    tests: [
      "apps/app/src/**/*.test.ts",
      "packages/e2ee/src/**/*.test.ts",
      "packages/ui/src/**/*.test.ts",
    ],
    inputs: Files.of("vite.config.ts"),
    vitest: ["vp", "test"],
  }),
  Vitest.files({
    name: "test-server",
    shell,
    setup: install,
    dir: "apps/server",
    tests: ["src/**/*.test.ts"],
    inputs: Files.of("apps/server/vite.config.ts", postgresSetup),
    before: postgres18,
    vitest: ["vp", "test"],
  }),
  Vitest.files({
    name: "test-sync",
    shell,
    setup: install,
    dir: "packages/sync",
    tests: ["src/**/*.test.ts"],
    inputs: Files.of("packages/sync/vite.config.ts", postgresSetup),
    before: postgres18,
    vitest: ["vp", "test"],
  }),
];

// The bundle is architecture-independent JS, so it builds once on an x86_64 builder (the tower),
// while srv-2 runs it on Node for its own system, aarch64 (hosting.md section 2).
const bundle = Nix.build(Flake.attr("packages.x86_64-linux.bundle"), { name: "bundle" });
const node = Nix.build(Flake.attr("packages.aarch64-linux.node"), { name: "node" });

// The checks run on srv-2's system, with srv-2's Node and the bundle that ships, so serverSmoke is the
// pairing a deploy runs. closureGuard reads only the bundle's files, so one system's run covers both.
const serverSmoke = Nix.build(Flake.attr("checks.aarch64-linux.serverSmoke"), {
  name: "serverSmoke",
});
const flakeChecks = [
  Nix.build(Flake.attr("checks.aarch64-linux.closureGuard"), { name: "closureGuard" }),
  serverSmoke,
];

/**
 * The bundle's pnpm store, 1.3 GB that only a build reads, so no build step's output closure holds it.
 * As a step of its own it reaches the binary cache, and a builder substitutes it after a lockfile
 * change instead of fetching every package from npm.
 */
const pnpmDeps = Nix.build(Flake.attr("packages.x86_64-linux.deps.pnpmDeps"), {
  name: "pnpmDeps",
});

// The Alchemy stack in deploy/, with a lockfile of its own.
const deployInstall = Pnpm.install({ shell, dir: "deploy", name: "deploy-install" });
const deployChecks = [
  Task.make("typecheck-deploy", {
    shell,
    setup: deployInstall,
    inputs: Files.of("deploy", "tsconfig.base.json"),
    run: cmd`tsc --noEmit -p deploy`,
  }),
  Vitest.files({
    name: "test-deploy",
    shell,
    setup: deployInstall,
    dir: "deploy",
    tests: ["**/*.test.ts"],
  }),
];

const checks = [
  ...[fmt, lint, knip, typecheck, ...tests, ...deployChecks].map(Step.timeout("15 minutes")),
  ...flakeChecks,
];

export default Environments.project({
  stack: {
    shell,
    dir: "deploy",
    setup: deployInstall,
    env: "cloudflare",
    secrets: { FLEET_TOKEN_FILE: "placement-token" },
    outputs: {
      name: "Studienbuch",
      schema: Schema.Struct({ url: Schema.String, readiness: Schema.String }),
    },
  },
  checks,
  artifacts: { CALDER_BUNDLE: bundle, CALDER_NODE: node },
  readiness: (outputs) => outputs.readiness,
  // A preview waits for none of the checks but the one that runs what it deploys (ADR 0007).
  previews: { url: (_pr, outputs) => outputs.url, after: [serverSmoke] },
  environments: { beta: { on: { push: "main" }, after: checks } },
  nightly: "0 3 * * *",
  rules: [On.pullRequest([pnpmDeps]), On.push("main", [pnpmDeps])],
});
