import {
  Action,
  Calder,
  Files,
  Flake,
  Nix,
  On,
  PullRequest,
  Secret,
  Step,
  Task,
  cmd,
} from "@calder-ci/core";
import { Environments, Expo, Pnpm, Vitest } from "@calder-ci/std";
import { Effect, Option, Schema } from "effect";
import { flake } from "./flake.ts";

const shell = flake.devShells.ci;
const install = Pnpm.install({ shell });

// The checks of `tools/check-changed`, over the whole repository: format, type-aware lint, knip, the
// atlas's paths, a typecheck of every project and every test.

const fmt = Task.make("fmt", { shell, setup: install, run: cmd`vp fmt --check` });
const lint = Task.make("lint", { shell, setup: install, run: cmd`vp lint` });
const knip = Task.make("knip", { shell, setup: install, run: cmd`knip` });
const atlas = Task.make("atlas", { shell, setup: install, run: cmd`vp run check:atlas` });

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
  // Packages without a config of their own run under the root's. Calder refuses a negation that
  // removes no test file, so a package with its own config gets its line once it has tests.
  Vitest.files({
    name: "test",
    shell,
    setup: install,
    tests: [
      "**/*.test.ts",
      "!apps/app/**",
      "!apps/server/**",
      "!packages/sync/**",
      "!deploy/**",
      "!tools/oxlint/fixtures/**",
    ],
    inputs: Files.of("vite.config.ts"),
    vitest: ["vp", "test"],
  }),
  // The app's Node project. app.config.test.ts loads the app config through Expo and lists the route
  // files from disk, which Calder's import graph doesn't see.
  Vitest.files({
    name: "test-app",
    shell,
    setup: install,
    dir: "apps/app",
    tests: [
      "src/**/*.test.ts",
      "modules/**/*.test.ts",
      "app.config.test.ts",
      "!src/**/*.browser.test.ts",
    ],
    inputs: Files.union(
      Files.of("apps/app/vite.config.ts"),
      Files.imports("apps/app/app.config.ts"),
      Files.glob("apps/app/src/app/**"),
    ),
    vitest: ["vp", "test"],
  }),
  // The app's browser project, in the CI shell's headless Chromium and Firefox. Its Vite config
  // swaps our imports of `x.ts` for `x.web.ts` and loads the SQLite worker by a URL, two edges
  // Calder's import graph doesn't follow, so every web file and the worker count for every test.
  Vitest.files({
    name: "test-app-browser",
    shell,
    setup: install,
    dir: "apps/app",
    tests: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
    inputs: Files.union(
      Files.of("apps/app/vite.config.ts"),
      Files.imports([
        "apps/app/src/**/*.web.ts",
        "apps/app/src/**/*.web.tsx",
        "apps/app/src/infra/sqlite/opfs.worker.ts",
        "packages/*/src/**/*.web.ts",
        "packages/*/src/**/*.web.tsx",
      ]),
    ),
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
    inputs: Files.of(
      "packages/sync/vite.config.ts",
      postgresSetup,
      "packages/sync/src/testing/FileFetch.setup.ts",
    ),
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
  ...[fmt, lint, knip, atlas, typecheck, ...tests, ...deployChecks].map(Step.timeout("15 minutes")),
  ...flakeChecks,
];

/**
 * The corpus gate (m2-import-corpus.md, section 6, "CI"): the import's numbers on the pinned private
 * corpus against baseline.json. It needs the corpus's deploy key and age identity, so it runs in
 * trusted runs only, and again only when the import, the recorded client, the harness or the pin
 * changes. Its output and its comment hold aggregates, never corpus content.
 */
const importEval = Task.make("import-eval", {
  shell: flake.devShells.corpus,
  setup: install,
  inputs: Files.union(
    Files.imports([
      "apps/server/src/import/corpus/main.ts",
      "apps/server/src/import/evaluation/main.ts",
    ]),
    Files.of(
      "apps/server/package.json",
      "apps/server/src/import/corpus/pin.json",
      "apps/server/src/import/evaluation/baseline.json",
      ".calder/known_hosts",
    ),
  ),
  secrets: {
    CORPUS_DEPLOY_KEY: Secret.file("import-corpus-deploy-key"),
    SOPS_AGE_KEY_FILE: Secret.file("import-corpus-age-identity"),
  },
  run: cmd`bash -c ${[
    "set -euo pipefail",
    // The deploy key alone, against git.schnau.dev's pinned host key.
    'export GIT_SSH_COMMAND="ssh -F /dev/null -o IdentityAgent=none -o IdentitiesOnly=yes -i $CORPUS_DEPLOY_KEY -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$PWD/.calder/known_hosts -o GlobalKnownHostsFile=/dev/null"',
    'result="$PWD/import-eval.json"',
    'rm -f "$result"',
    "cd apps/server",
    "vp run corpus:fetch --pinned",
    // Exit code 3 says numbers differ from the baseline: the step passes its result on, and the
    // gate comments it and fails.
    "status=0",
    'vp run import:eval --corpus pinned --against baseline --comment "$result" || status=$?',
    '[ "$status" -eq 0 ] || [ "$status" -eq 3 ]',
  ].join("\n")}`,
  value: {
    path: "import-eval.json",
    schema: Schema.Struct({ markdown: Schema.String, differences: Schema.Number }),
  },
}).pipe(Step.timeout("30 minutes"));

class BaselineDiffers extends Calder.Failure<BaselineDiffers>("studienbuch")("BaselineDiffers", {
  count: Schema.Number,
}) {
  override get message() {
    const numbers = this.count === 1 ? "1 number differs" : `${this.count} numbers differ`;

    return `${numbers} from baseline.json: fix the import, or update baseline.json in this commit with the reason`;
  }
}

/** Comments the numbers on a pull request, and fails when any differs from the baseline. */
const importEvalGate = Action.make(
  "import-eval-gate",
  { needs: { result: importEval } },
  function* ({ result }) {
    const pullRequest = yield* Effect.serviceOption(PullRequest);

    if (Option.isSome(pullRequest)) yield* pullRequest.value.comment(result.markdown);

    if (result.differences > 0) return yield* new BaselineDiffers({ count: result.differences });
  },
);

// The native app, from the TestFlight and Play internal builds of every push to main that changes it.

/**
 * What every step of the native app evaluates its config with, the same for each (std's Expo). Store
 * builds talk to beta; the web export never sees this, so one web build serves every deployment.
 */
const app = { dir: "apps/app", env: { EXPO_PUBLIC_API_URL: "https://beta.studienbuch.app" } };

/** The native layer's fingerprint on each platform (apps/app/fingerprint.config.js). */
const runtimeIos = Expo.runtimeVersion("ios", { ...app, shell, setup: install });
const runtimeAndroid = Expo.runtimeVersion("android", { ...app, shell, setup: install });

/**
 * The store builds are keyed by the fingerprint and, while there are no over-the-air updates (D94),
 * by everything the app bundles too: a new build is then the only way new JavaScript reaches testers.
 * Once M5.16's update server ships JavaScript, drop `inputs` so only a native change rebuilds. Calder
 * reuses a key it built before, even in `calder rerun --force`, so a revert to such a tree uploads
 * nothing unless it also raises the version in apps/app/package.json, which the fingerprint hashes.
 */
const store = { ...app, shell, inputs: Files.workspace("apps/app") };

/** Urbs UG's App Store Connect key: the project's secret, and its identifiers. */
const appStoreConnect = {
  key: "app-store-connect",
  keyId: "85N8Y9CZC4",
  issuerId: "e4b59e5f-0f40-4b1b-996e-b7a01664676a",
};

/** The store builds wait until beta runs this commit, so a tester's build never meets an older server. */
const storeBuilds = (ready: Step.Any) => [
  Expo.testflight({
    ...store,
    runtime: runtimeIos,
    appId: "6751515035",
    appStoreConnect,
    after: [ready],
  }).pipe(Step.timeout("90 minutes")),
  // On m1, like hopwatch's, until the tower's workers get an Android SDK, a JDK and gplay.
  Expo.playInternal({
    ...store,
    platform: "aarch64-darwin",
    runtime: runtimeAndroid,
    keystore: "play-upload-keystore",
    password: "play-upload-password",
    serviceAccount: "play-service-account",
    after: [ready],
  }).pipe(Step.timeout("90 minutes")),
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
  environments: { beta: { on: { push: "main" }, after: checks, then: storeBuilds } },
  nightly: "0 3 * * *",
  // A pull request shows its fingerprints, so a change to the native layer is visible before merging.
  // The corpus gate runs where secrets reach: same-repo pull requests and pushes to main.
  rules: [
    On.pullRequest([pnpmDeps, runtimeIos, runtimeAndroid]),
    On.preview([importEval, importEvalGate]),
    On.push("main", [pnpmDeps, importEval, importEvalGate]),
  ],
});
