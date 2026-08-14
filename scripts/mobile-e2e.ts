#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as Schema from "effect/Schema";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const scenarioDirectory = join(repositoryRoot, "apps/mobile/e2e/scenarios");
const comparisonStartedAt = new Date();
const artifactRoot = join(
  repositoryRoot,
  "test-results/mobile-e2e",
  comparisonStartedAt.toISOString().replaceAll(":", "-").replace(".", "-"),
);

const platforms = ["android", "ios"] as const;
const runners = ["agent-device", "argent"] as const;
const PackageManifest = Schema.Struct({ version: Schema.String });
type Platform = (typeof platforms)[number];
type Runner = (typeof runners)[number];

interface Result {
  readonly durationMs: number;
  readonly exitCode: number | null;
  readonly runner: Runner;
  readonly scenario: string;
  readonly signal: NodeJS.Signals | null;
  readonly status: "failed" | "passed";
}

function usage(): never {
  console.log(`Usage: node scripts/mobile-e2e.ts <android|ios> [scenario]
       node scripts/mobile-e2e.ts --check

Runs both paired mobile E2E implementations by default. Environment:
  MOBILE_E2E_RUNNER      agent-device | argent
  MOBILE_E2E_DEVICE      explicit simulator, emulator, or device id
  MOBILE_E2E_ORDER       agent-device-first | argent-first
  MOBILE_E2E_TIMEOUT_MS  per-runner timeout (default: 600000)`);
  process.exit(0);
}

function fail(message: string): never {
  console.error(`Mobile E2E comparison: ${message}`);
  process.exit(2);
}

function isOneOf<const Values extends ReadonlyArray<string>>(
  value: string,
  values: Values,
): value is Values[number] {
  return values.includes(value);
}

function packageVersion(name: string): string {
  const manifest = Schema.decodeUnknownSync(PackageManifest)(
    JSON.parse(readFileSync(join(repositoryRoot, "node_modules", name, "package.json"), "utf8")),
  );

  return manifest.version;
}

const firstArgument = process.argv[2];
if (firstArgument === "--help" || firstArgument === "-h") usage();
const availableScenarios = readdirSync(scenarioDirectory)
  .filter((file) => file.endsWith(".md"))
  .map((file) => file.slice(0, -3))
  .sort();

const implementationPath = (runner: Runner, platform: Platform, scenario: string): string =>
  runner === "agent-device"
    ? join(repositoryRoot, "apps/mobile/e2e/agent-device", platform, `${scenario}.ad`)
    : join(repositoryRoot, ".argent/flows", platform, `${scenario}.yaml`);

if (firstArgument === "--check") {
  const incompletePairs = platforms.flatMap((platform) =>
    availableScenarios.flatMap((scenario) => {
      const paths = runners.map((runner) => implementationPath(runner, platform, scenario));
      const present = paths.filter(existsSync);
      return present.length === 1 ? paths.filter((path) => !existsSync(path)) : [];
    }),
  );

  if (incompletePairs.length > 0) {
    fail(
      `Runner implementations must be added in pairs. Missing:\n${incompletePairs
        .map((path) => `- ${relative(repositoryRoot, path)}`)
        .join("\n")}`,
    );
  }

  const completePairCount = platforms.reduce(
    (count, platform) =>
      count +
      availableScenarios.filter((scenario) =>
        runners.every((runner) => existsSync(implementationPath(runner, platform, scenario))),
      ).length,
    0,
  );
  const possiblePairCount = platforms.length * availableScenarios.length;
  console.log(
    `Mobile E2E parity: ${completePairCount} complete, ${possiblePairCount - completePairCount} awaiting live recording.`,
  );
  process.exit(0);
}

const platformArgument = firstArgument ?? "android";
if (!isOneOf(platformArgument, platforms)) {
  fail(`Unknown platform ${platformArgument}; expected ${platforms.join(" or ")}.`);
}
const platform: Platform = platformArgument;

const requestedScenario = process.argv[3] || undefined;
const scenarios = requestedScenario === undefined ? availableScenarios : [requestedScenario];

for (const scenario of scenarios) {
  if (!availableScenarios.includes(scenario)) {
    fail(`Unknown scenario ${scenario}; expected one of ${availableScenarios.join(", ")}.`);
  }
}

const runnerFilter = process.env.MOBILE_E2E_RUNNER;
if (runnerFilter !== undefined && !isOneOf(runnerFilter, runners)) {
  fail(`Unknown MOBILE_E2E_RUNNER ${runnerFilter}; expected ${runners.join(" or ")}.`);
}

const order = process.env.MOBILE_E2E_ORDER ?? "agent-device-first";
if (order !== "agent-device-first" && order !== "argent-first") {
  fail(`Unknown MOBILE_E2E_ORDER ${order}.`);
}
const orderedRunners: ReadonlyArray<Runner> =
  order === "argent-first" ? ["argent", "agent-device"] : runners;
const selectedRunners =
  runnerFilter === undefined
    ? orderedRunners
    : orderedRunners.filter((runner) => runner === runnerFilter);

const timeoutMs = Number(process.env.MOBILE_E2E_TIMEOUT_MS ?? "600000");
if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
  fail("MOBILE_E2E_TIMEOUT_MS must be a positive integer.");
}

const missingImplementations = scenarios.flatMap((scenario) =>
  runners
    .map((runner) => implementationPath(runner, platform, scenario))
    .filter((path) => !existsSync(path)),
);

if (missingImplementations.length > 0) {
  fail(
    `Refusing an unpaired comparison. Record and verify:\n${missingImplementations
      .map((path) => `- ${relative(repositoryRoot, path)}`)
      .join("\n")}`,
  );
}

mkdirSync(artifactRoot, { recursive: true });
const deviceArguments =
  process.env.MOBILE_E2E_DEVICE === undefined ? [] : ["--device", process.env.MOBILE_E2E_DEVICE];

function commandFor(runner: Runner, scenario: string): ReadonlyArray<string> {
  const implementation = implementationPath(runner, platform, scenario);
  const outputDirectory = join(artifactRoot, runner, scenario);
  mkdirSync(outputDirectory, { recursive: true });

  if (runner === "agent-device") {
    return [
      join(repositoryRoot, "node_modules/agent-device/bin/agent-device.mjs"),
      "test",
      implementation,
      "--platform",
      platform,
      ...deviceArguments,
      "--timeout",
      String(timeoutMs),
      "--artifacts-dir",
      outputDirectory,
      "--reporter",
      "default",
      "--reporter",
      `junit:${join(outputDirectory, "junit.xml")}`,
    ];
  }

  return [
    join(repositoryRoot, "node_modules/@swmansion/argent/dist/cli.js"),
    "flow",
    "run",
    implementation,
    "--platform",
    platform,
    ...deviceArguments,
    "--output",
    outputDirectory,
  ];
}

const results: Array<Result> = [];
for (const scenario of scenarios) {
  for (const runner of selectedRunners) {
    const startedAt = performance.now();
    console.log(`\n=== ${scenario} · ${runner} · ${platform} ===`);
    const execution = spawnSync(process.execPath, commandFor(runner, scenario), {
      cwd: repositoryRoot,
      env: { ...process.env, ARGENT_TELEMETRY: "0" },
      stdio: "inherit",
      timeout: timeoutMs + 5_000,
    });
    const exitCode = execution.status;
    if (execution.error !== undefined) {
      console.error(`${runner} failed to execute: ${execution.error.message}`);
    }
    results.push({
      durationMs: Math.round(performance.now() - startedAt),
      exitCode,
      runner,
      scenario,
      signal: execution.signal,
      status: exitCode === 0 ? "passed" : "failed",
    });
  }
}

const summary = {
  schemaVersion: 1,
  startedAt: comparisonStartedAt.toISOString(),
  platform,
  device: process.env.MOBILE_E2E_DEVICE ?? null,
  order,
  versions: {
    agentDevice: packageVersion("agent-device"),
    argent: packageVersion("@swmansion/argent"),
  },
  results,
};
const summaryPath = join(artifactRoot, "summary.json");
mkdirSync(dirname(summaryPath), { recursive: true });
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`\nComparison report: ${summaryPath}`);

if (results.some((result) => result.status === "failed")) {
  process.exitCode = 1;
}
