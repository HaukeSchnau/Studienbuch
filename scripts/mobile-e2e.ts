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
const confidenceLevels = ["established", "corroborated", "inferred"] as const;
const PackageManifest = Schema.Struct({ version: Schema.String });
type Platform = (typeof platforms)[number];
type Runner = (typeof runners)[number];

interface ScenarioContract {
  readonly name: string;
  readonly platforms: ReadonlyArray<Platform>;
}

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
  MOBILE_E2E_RUNNER        agent-device | argent
  MOBILE_E2E_DEVICE        shared device selector when both runners accept it
  MOBILE_E2E_AGENT_DEVICE  agent-device simulator, emulator, or device selector
  MOBILE_E2E_ARGENT_DEVICE Argent UDID, ADB serial, or Chromium id
  MOBILE_E2E_ORDER         agent-device-first | argent-first
  MOBILE_E2E_TIMEOUT_MS    per-runner timeout (default: 600000)`);
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

function scenarioMetadata(content: string, field: string): string | undefined {
  return content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"))?.[1]?.trim();
}

function parseScenarioContract(name: string): ScenarioContract {
  const path = join(scenarioDirectory, `${name}.md`);
  const content = readFileSync(path, "utf8");
  const errors: Array<string> = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    errors.push("the filename must be a lowercase semantic slug");
  }
  if ((content.match(/^# [^#\n].+$/gm) ?? []).length !== 1) {
    errors.push("the contract needs exactly one descriptive level-one title");
  }
  const status = scenarioMetadata(content, "Status");
  if (status !== "accepted") {
    errors.push("`Status` must be `accepted`; unresolved behavior belongs in the legacy catalogue");
  }

  const confidence = scenarioMetadata(content, "Confidence");
  if (confidence === undefined || !isOneOf(confidence, confidenceLevels)) {
    errors.push(`\`Confidence\` must be ${confidenceLevels.join(", ")}`);
  }

  const platformValues = scenarioMetadata(content, "Platforms")?.split(",") ?? [];
  const scenarioPlatforms = platformValues
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is Platform => isOneOf(value, platforms));
  if (scenarioPlatforms.length === 0 || new Set(scenarioPlatforms).size !== platformValues.length) {
    errors.push("`Platforms` must be a unique comma-separated subset of `Android, iOS`");
  }

  for (const heading of [
    "Rule",
    "Example",
    "Evidence contract",
    "State",
    "Sources",
    "Recordings",
  ]) {
    if (!content.includes(`## ${heading}\n`)) errors.push(`missing \`## ${heading}\``);
  }

  for (const keyword of ["Given", "When", "Then"]) {
    if (!new RegExp(`^${keyword}\\s+\\S`, "m").test(content)) {
      errors.push(`the Example needs a ${keyword} step`);
    }
  }

  if (!/^\|\s*Outcome\s*\|\s*Executable evidence\s*\|/m.test(content)) {
    errors.push("the Evidence contract needs `Outcome` and `Executable evidence` columns");
  }
  for (const stateField of ["Initial state", "Final state", "Side effects"]) {
    if (!new RegExp(`^${stateField}:\\s*\\S`, "m").test(content)) {
      errors.push(`State needs a non-empty \`${stateField}\``);
    }
  }
  if (!/^-[ \t]+`(?:flutter|react-native|current):[^`]+`/m.test(content)) {
    errors.push("Sources needs at least one `flutter:`, `react-native:`, or `current:` reference");
  }
  if (/\b(?:works? correctly|happy path)\b/i.test(content)) {
    errors.push(
      "replace vague `works correctly` or `happy path` wording with an observable outcome",
    );
  }

  if (errors.length > 0) {
    fail(
      `Unreadable scenario contract ${relative(repositoryRoot, path)}:\n${errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }

  return { name, platforms: scenarioPlatforms };
}

const firstArgument = process.argv[2];
if (firstArgument === "--help" || firstArgument === "-h") usage();
const scenarioNames = readdirSync(scenarioDirectory)
  .filter((file) => file.endsWith(".md"))
  .map((file) => file.slice(0, -3))
  .sort();
const scenarioContracts = scenarioNames.map(parseScenarioContract);

function implementationDirectory(runner: Runner, platform: Platform): string {
  return runner === "agent-device"
    ? join(repositoryRoot, "apps/mobile/e2e/agent-device", platform)
    : join(repositoryRoot, ".argent/flows", platform);
}

const implementationPath = (runner: Runner, platform: Platform, scenario: string): string =>
  runner === "agent-device"
    ? join(implementationDirectory(runner, platform), `${scenario}.ad`)
    : join(implementationDirectory(runner, platform), `${scenario}.yaml`);

function implementedScenarios(runner: Runner, platform: Platform): ReadonlyArray<string> {
  const directory = implementationDirectory(runner, platform);
  if (!existsSync(directory)) return [];
  const extension = runner === "agent-device" ? ".ad" : ".yaml";
  return readdirSync(directory)
    .filter((file) => file.endsWith(extension))
    .map((file) => file.slice(0, -extension.length));
}

if (firstArgument === "--check") {
  const orphanImplementations = runners.flatMap((runner) =>
    platforms.flatMap((platform) =>
      implementedScenarios(runner, platform)
        .filter(
          (scenario) =>
            !scenarioContracts.some(
              (contract) => contract.name === scenario && contract.platforms.includes(platform),
            ),
        )
        .map((scenario) => implementationPath(runner, platform, scenario)),
    ),
  );
  if (orphanImplementations.length > 0) {
    fail(
      `Runner implementations need an applicable readable contract. Orphaned:\n${orphanImplementations
        .map((path) => `- ${relative(repositoryRoot, path)}`)
        .join("\n")}`,
    );
  }

  const incompletePairs = scenarioContracts.flatMap(
    ({ name: scenario, platforms: contractPlatforms }) =>
      contractPlatforms.flatMap((platform) => {
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

  const completePairCount = scenarioContracts.reduce(
    (count, { name: scenario, platforms: contractPlatforms }) =>
      count +
      contractPlatforms.filter((platform) =>
        runners.every((runner) => existsSync(implementationPath(runner, platform, scenario))),
      ).length,
    0,
  );
  const possiblePairCount = scenarioContracts.reduce(
    (count, contract) => count + contract.platforms.length,
    0,
  );
  console.log(
    `Mobile E2E contracts: ${scenarioContracts.length} accepted. Parity: ${completePairCount} complete, ${possiblePairCount - completePairCount} awaiting live recording.`,
  );
  process.exit(0);
}

const platformArgument = firstArgument ?? "android";
if (!isOneOf(platformArgument, platforms)) {
  fail(`Unknown platform ${platformArgument}; expected ${platforms.join(" or ")}.`);
}
const platform: Platform = platformArgument;
const availableScenarios = scenarioContracts
  .filter((contract) => contract.platforms.includes(platform))
  .map((contract) => contract.name);

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
const jobs = scenarios.flatMap((scenario) =>
  selectedRunners.map((runner) => ({ runner, scenario })),
);
const argentCli = join(repositoryRoot, "node_modules/@swmansion/argent/dist/cli.js");
const sharedDevice = process.env.MOBILE_E2E_DEVICE;
const devices = {
  "agent-device": process.env.MOBILE_E2E_AGENT_DEVICE ?? sharedDevice,
  argent: process.env.MOBILE_E2E_ARGENT_DEVICE ?? sharedDevice,
} satisfies Readonly<Record<Runner, string | undefined>>;

if (
  devices.argent === undefined &&
  jobs.some((job, index) => job.runner === "argent" && index < jobs.length - 1)
) {
  fail(
    "MOBILE_E2E_ARGENT_DEVICE (or shared MOBILE_E2E_DEVICE) is required when another job follows Argent so its device services can be stopped without affecting other devices.",
  );
}

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
const deviceArguments = (runner: Runner): ReadonlyArray<string> =>
  devices[runner] === undefined ? [] : ["--device", devices[runner]];

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
      ...deviceArguments(runner),
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
    argentCli,
    "flow",
    "run",
    implementation,
    "--platform",
    platform,
    ...deviceArguments(runner),
    "--output",
    outputDirectory,
  ];
}

const results: Array<Result> = [];
for (const [jobIndex, { runner, scenario }] of jobs.entries()) {
  const startedAt = performance.now();
  console.log(`\n=== ${scenario} · ${runner} · ${platform} ===`);
  const execution = spawnSync(process.execPath, commandFor(runner, scenario), {
    cwd: repositoryRoot,
    env: { ...process.env, ARGENT_TELEMETRY: "0" },
    stdio: "inherit",
    timeout: timeoutMs + 5_000,
  });
  let exitCode = execution.status;
  if (execution.error !== undefined) {
    console.error(`${runner} failed to execute: ${execution.error.message}`);
  }

  if (runner === "argent" && jobIndex < jobs.length - 1) {
    const cleanup = spawnSync(
      process.execPath,
      [argentCli, "run", "stop-all-simulator-servers", "--devices", devices.argent!, "--json"],
      {
        cwd: repositoryRoot,
        env: { ...process.env, ARGENT_TELEMETRY: "0" },
        stdio: "inherit",
        timeout: 30_000,
      },
    );
    if (cleanup.status !== 0 || cleanup.error !== undefined) {
      console.error(
        `Argent service cleanup failed: ${cleanup.error?.message ?? `exit ${cleanup.status}`}`,
      );
      exitCode = cleanup.status ?? 1;
    }
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

const summary = {
  schemaVersion: 2,
  startedAt: comparisonStartedAt.toISOString(),
  platform,
  devices: {
    agentDevice: devices["agent-device"] ?? null,
    argent: devices.argent ?? null,
  },
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
