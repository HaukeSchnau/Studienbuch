import { Files, Step, Task, cmd } from "@kiln/core";
import { Pnpm, Project, Vitest } from "@kiln/std";
import { flake } from "./flake.ts";

const shell = flake.devShells.ci;
const install = Pnpm.install({ shell });

const extensions = (...names: ReadonlyArray<string>) => names.map((name) => `**/*.${name}`);
const code = extensions("ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs");

/** Every file type oxfmt formats, including ones the repository doesn't have yet. */
const formatted = [
  ...code,
  ...extensions("json", "jsonc", "json5", "md", "markdown", "mdx", "yaml", "yml", "toml"),
  ...extensions("css", "scss", "less", "html", "vue", "graphql", "gql"),
];

const fmtCheck = Task.make("fmt-check", {
  shell,
  setup: install,
  inputs: Files.optional(Files.glob(...formatted)),
  run: cmd`vp fmt --check`,
});

/** Type-aware, so it also reads tsconfig files and imported JSON. */
const lint = Task.make("lint", {
  shell,
  setup: install,
  inputs: Files.optional(Files.glob(...code, "**/*.json")),
  run: cmd`vp lint --report-unused-disable-directives`,
});

const mobileE2eCheck = Task.make("mobile-e2e-check", {
  shell,
  setup: install,
  inputs: Files.of("scripts/mobile-e2e.ts", "apps/mobile/e2e", ".argent/flows"),
  run: cmd`node scripts/mobile-e2e.ts --check`,
});

const webLockCheck = Task.make("web-lock-check", {
  shell,
  setup: install,
  inputs: Files.of("scripts/web-production-lock.ts", "nix/web-pnpmfile.cjs", "pnpm-lock.web.yaml"),
  run: cmd`node scripts/web-production-lock.ts --check`,
});

interface Suite {
  /** The config file vitest reads in the package. */
  readonly config?: string;
  readonly tests?: ReadonlyArray<string>;
  /** The package's import aliases, so Kiln follows them to the files a test reaches. */
  readonly aliases?: Vitest.FilesOptions["aliases"];
}

/** A package's vitest suite, where a test file runs again only when it or what it imports changed. */
const vitest = (
  dir: string,
  { config = "vite.config.ts", tests = ["src/**/*.test.ts"], aliases = {} }: Suite = {},
) =>
  Vitest.files({
    name: `test-${dir.slice(dir.indexOf("/") + 1)}`,
    shell,
    setup: install,
    dir,
    tests,
    aliases,
    inputs: Files.of("tsconfig.json", `${dir}/${config}`),
    vitest: ["vp", "test"],
  });

const tests = [
  vitest("packages/core"),
  vitest("packages/observability"),
  vitest("packages/server"),
  vitest("apps/console"),
  vitest("apps/mobile", { aliases: { "~": "apps/mobile/src" } }),
  vitest("apps/web", {
    config: "vitest.config.ts",
    tests: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    aliases: { "#": "apps/web/src" },
  }),
];

export default Project.standard({
  flake,
  checks: [fmtCheck, lint, mobileE2eCheck, webLockCheck, ...tests].map(Step.timeout("15 minutes")),
  readiness: "https://beta.studienbuch.app/api/health/ready",
});
