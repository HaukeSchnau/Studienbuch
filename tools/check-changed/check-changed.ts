// Ported from T3 Code's `scripts/check-changed.ts` (github.com/pingdotgg/t3code, MIT, copyright T3
// Tools Inc.; see tools/T3CODE-LICENSE).

// Format and lint of the changed files, knip, a typecheck of the affected projects and their
// dependents, and the tests beside changed files. The change is the jj diff from
// `fork_point(trunk() | @)` to `@`, or in git the diff from the merge base with origin/main plus
// untracked files. `vp run check:changed <rev>` compares with another jj revset or git ref.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const root = NodePath.resolve(import.meta.dirname, "../..");
const CODE = /\.[cm]?[jt]sx?$/u;
const TEST = /\.test\.[cm]?[jt]sx?$/u;

// Shared compiler options and the installed dependencies, oxlint's and tsgo's versions among them,
// reach every project's types.
const AFFECTS_EVERY_PROJECT = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
]);

// These can fail any file's format or lint: the lint and format config, a local lint rule, the
// type information lint reads, and the tool versions.
const REPOSITORY_WIDE = (file: string) =>
  file === "vite.config.ts" ||
  file.startsWith("tools/oxlint/") ||
  AFFECTS_EVERY_PROJECT.has(file) ||
  /^tsconfig.*\.json$/u.test(NodePath.basename(file));

interface Changes {
  readonly base: string;
  readonly files: ReadonlyArray<string>;
}

/** The output lines of a command run at the repository root, or null when it fails. */
function lines(command: string, args: ReadonlyArray<string>): Array<string> | null {
  const result = NodeChildProcess.spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  return result.status === 0 ? result.stdout.split("\n").filter((line) => line !== "") : null;
}

// quotePath=false prints non-ASCII paths as they are. --no-renames lists a rename as both paths,
// which `jj diff --name-only` doesn't.
const GIT = ["-c", "core.quotePath=false"];

const commitId = (rev: string) =>
  lines("jj", ["log", "--no-graph", "-r", rev, "-T", "commit_id"])?.[0];

function jjChanges(rev: string): Changes | null {
  const base = commitId(`fork_point((${rev}) | @)`);
  const head = commitId("@");

  if (base === undefined || head === undefined) return null;

  const files = lines("git", [...GIT, "diff", "--name-only", "--no-renames", base, head, "--"]);

  return files === null ? null : { base: base.slice(0, 12), files };
}

function gitChanges(ref: string): Changes | null {
  const base = lines("git", ["merge-base", "HEAD", ref])?.[0];

  if (base === undefined) return null;

  const changed = lines("git", [...GIT, "diff", "--name-only", "--no-renames", base, "--"]);
  const untracked = lines("git", [...GIT, "ls-files", "--others", "--exclude-standard"]);

  if (changed === null || untracked === null) return null;

  return { base: base.slice(0, 12), files: [...new Set([...changed, ...untracked])].sort() };
}

const rev = process.argv[2];
const jj = lines("jj", ["root"]) !== null;
const changes = jj ? jjChanges(rev ?? "trunk()") : gitChanges(rev ?? "origin/main");

if (changes === null) {
  const fix = jj ? "Pass a revset that exists" : "Run `git fetch origin` or pass a ref";
  console.error(`check:changed: no fork point with ${rev ?? "trunk"}. ${fix}.`);
  process.exit(1);
}

const { base, files } = changes;

const count = (items: ReadonlyArray<string>) =>
  `${items.length} file${items.length === 1 ? "" : "s"}`;

if (files.length === 0) {
  console.log(`check:changed: no changes since ${base}.`);
  process.exit(0);
}

console.log(`check:changed: ${count(files)} since ${base}`);

const exists = (path: string) => NodeFS.existsSync(NodePath.join(root, path));
const present = files.filter(exists);
const code = present.filter((file) => CODE.test(file));
const repositoryWide = files.some(REPOSITORY_WIDE);

interface Manifest {
  readonly name?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

// A project is a directory with its own tsconfig.json. Workspace packages among them name the
// packages they depend on in package.json.
const projects = ["apps", "packages", "tools"].flatMap((parent) =>
  NodeFS.readdirSync(NodePath.join(root, parent))
    .map((name) => `${parent}/${name}`)
    .filter((dir) => exists(`${dir}/tsconfig.json`)),
);

function manifest(dir: string): Manifest {
  const path = NodePath.join(root, dir, "package.json");

  return NodeFS.existsSync(path) ? JSON.parse(NodeFS.readFileSync(path, "utf8")) : {};
}

const manifests = new Map(projects.map((dir) => [dir, manifest(dir)]));

function dependsOn(dependent: string, dependency: string): boolean {
  const name = manifests.get(dependency)?.name;
  const { dependencies = {}, devDependencies = {} } = manifests.get(dependent) ?? {};

  return name !== undefined && (name in dependencies || name in devDependencies);
}

const affected = new Set(
  files.some((file) => AFFECTS_EVERY_PROJECT.has(file))
    ? projects
    : projects.filter((dir) => files.some((file) => file.startsWith(`${dir}/`))),
);

for (const dependency of affected) {
  for (const dependent of projects) {
    if (dependsOn(dependent, dependency)) affected.add(dependent);
  }
}

// Changed test files, and the test files beside a changed source file (`Outbox.ts` brings
// `Outbox.test.ts`). Vitest's import-graph `related` would reach most of a package.
const tests = new Set(code.filter((file) => TEST.test(file)));

for (const file of code) {
  const dir = NodePath.dirname(file);
  const prefix = `${NodePath.basename(file).replace(CODE, "")}.`;

  for (const entry of NodeFS.readdirSync(NodePath.join(root, dir))) {
    if (entry.startsWith(prefix) && TEST.test(entry)) tests.add(NodePath.join(dir, entry));
  }
}

/** The nearest directory with a vite.config.ts, whose test settings the file runs under. */
function configDir(file: string): string {
  let dir = NodePath.dirname(file);

  while (dir !== "." && !exists(`${dir}/vite.config.ts`)) dir = NodePath.dirname(dir);

  return dir;
}

const testsByConfig = Map.groupBy(tests, configDir);

// Any code or manifest change can leave a file, export or dependency unused.
const runKnip = files.some(
  (file) => CODE.test(file) || NodePath.basename(file) === "package.json" || file === "knip.jsonc",
);

interface Step {
  readonly name: string;
  readonly args: ReadonlyArray<string>;
  readonly cwd?: string;
}

const steps: Array<Step> = [];

if (repositoryWide || present.length > 0) {
  const scope = repositoryWide ? [] : ["--no-error-on-unmatched-pattern", ...present];

  steps.push({ name: "format", args: ["fmt", "--check", ...scope] });
}

if (repositoryWide || code.length > 0) {
  steps.push({
    name: repositoryWide ? "lint (all files)" : "lint",
    args: ["lint", ...(repositoryWide ? [] : ["--no-error-on-unmatched-pattern", ...code])],
  });
}

if (runKnip) steps.push({ name: "knip", args: ["exec", "knip"] });

for (const dir of affected) {
  steps.push({ name: `typecheck ${dir}`, args: ["exec", "tsc", "--noEmit", "-p", dir] });
}

for (const [dir, group] of testsByConfig) {
  steps.push({
    name: `test ${dir === "." ? "" : `${dir} `}(${count(group)})`,
    args: [
      "test",
      "run",
      "--passWithNoTests",
      ...group.map((file) => NodePath.relative(dir, file)),
    ],
    cwd: dir,
  });
}

interface Result {
  readonly name: string;
  readonly ok: boolean;
  readonly seconds: string;
}

// Output is piped, so keep the colors a terminal would get.
const env = process.stdout.isTTY ? { ...process.env, FORCE_COLOR: "1" } : process.env;

function run(step: Step): Promise<Result> {
  const started = performance.now();
  const output: Array<Buffer> = [];

  const child = NodeChildProcess.spawn("vp", step.args, {
    cwd: NodePath.join(root, step.cwd ?? "."),
    env,
  });

  child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => output.push(chunk));
  // A failed spawn emits "error", then "close" with a nonzero code.
  child.on("error", (error) => output.push(Buffer.from(`${error.message}\n`)));

  return new Promise((resolve) => {
    child.on("close", (status) => {
      const ok = status === 0;
      const seconds = ((performance.now() - started) / 1000).toFixed(1);

      console.log(`\n> ${step.name}  ${ok ? "pass" : "FAIL"}  ${seconds}s`);
      process.stdout.write(Buffer.concat(output));
      resolve({ name: step.name, ok, seconds });
    });
  });
}

const results = await Promise.all(steps.map(run));

const summary = ["check:changed summary"];

for (const result of results) {
  summary.push(`  ${result.ok ? "pass" : "FAIL"}  ${result.name}  ${result.seconds}s`);
}

// CI's tasks run over the whole repository, so they catch what the file lists above skip.
const ciTasks = [
  ...NodeFS.readFileSync(NodePath.join(root, ".calder/ci.ts"), "utf8").matchAll(
    /Task\.make\("([^"]+)"/gu,
  ),
].map((match) => match[1]);

summary.push(`  CI also runs: ${ciTasks.join(", ")} on every file (\`calder check\`)`);

if (!runKnip) summary.push("  knip skipped: no code or manifest changed");

if (tests.size === 0) summary.push("  tests skipped: no test file beside a changed file");

console.log(`\n${summary.join("\n")}`);

// exitCode, not exit(): piped stdout is asynchronous, and exit() would cut off a failing step's
// output.
if (results.some((result) => !result.ok)) process.exitCode = 1;
