#!/usr/bin/env node
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Argument from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";
import * as Script from "./lib/script.ts";

const defaultDevice = "539D7C55-85D6-50B1-BE9B-88293D4628C3";
const defaultArtifactsDirectory = "/tmp/studienbuch-mobile-builds";
const bundleIdentifier = "dev.schnau.studienbuch";

const development = {
  profile: "development",
  artifact: "studienbuch-dev.ipa",
} as const;

const production = {
  profile: "production-device",
  artifact: "studienbuch-prod.ipa",
} as const;

class EmptyArtifactError extends Schema.TaggedError<EmptyArtifactError>()("EmptyArtifactError", {
  path: Schema.String,
}) {
  override get message(): string {
    return `The iOS build did not produce a non-empty artifact at ${this.path}.`;
  }
}

class NoInstalledAppsError extends Schema.TaggedError<NoInstalledAppsError>()(
  "NoInstalledAppsError",
  { device: Schema.String },
) {
  override get message(): string {
    return `No Studienbuch apps are installed on device ${this.device}.`;
  }
}

const repositoryRoot = Effect.fn("ios.repositoryRoot")(function* () {
  const path = yield* Path.Path;
  return yield* path.fromFileUrl(new URL("..", import.meta.url));
});

const configuration = Effect.fn("ios.configuration")(function* () {
  const path = yield* Path.Path;
  const repoRoot = yield* repositoryRoot();
  const device = yield* Config.nonEmptyString("IOS_DEVICE").pipe(Config.withDefault(defaultDevice));
  const artifactsDirectory = yield* Config.nonEmptyString("IOS_ARTIFACTS_DIR").pipe(
    Config.withDefault(defaultArtifactsDirectory),
  );
  const resolvedArtifactsDirectory = path.resolve(repoRoot, artifactsDirectory);

  return {
    device,
    developmentArtifact: path.join(resolvedArtifactsDirectory, development.artifact),
    productionArtifact: path.join(resolvedArtifactsDirectory, production.artifact),
  };
});

const writeExecutable = Effect.fn("ios.writeExecutable")(function* (
  file: string,
  contents: string,
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(file, contents);
  yield* fs.chmod(file, 0o755);
});

const makeBuildTools = Effect.fn("ios.makeBuildTools")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "studienbuch-ios-build-" });
  const tool = (name: string) => path.join(directory, name);

  yield* Effect.all(
    [
      fs.symlink("/usr/bin/sed", tool("sed")),
      fs.symlink("/usr/bin/rsync", tool("rsync")),
      writeExecutable(
        tool("git"),
        `#!/bin/sh
if [ "$1" = "--no-pager" ] && [ "$2" = "log" ] && [ "$3" = "-1" ] && [ "$4" = "--pretty=%B" ]; then
  output="$(/usr/bin/git "$@")"
  status="$?"
  if [ "$status" -ne 0 ]; then
    exit "$status"
  fi
  if [ -n "$output" ]; then
    printf "%s" "$output"
  else
    printf "%s\\n" "\${IOS_BUILD_MESSAGE:-Local build}"
  fi
else
  exec /usr/bin/git "$@"
fi
`,
      ),
      writeExecutable(
        tool("build"),
        `#!/bin/sh
PATH="\${0%/*}:$PATH"
export PATH
export NODE_OPTIONS=--dns-result-order=ipv4first
export EXPO_USE_PRECOMPILED_MODULES=0
export EAS_LOCAL_BUILD_SKIP_CLEANUP=1
exec vp dlx eas-cli build "$@"
`,
      ),
    ],
    { concurrency: "unbounded", discard: true },
  );

  return tool("build");
});

const build = Effect.fn("ios.build")(function* (profile: string, output: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* repositoryRoot();
  const mobileDirectory = path.join(repoRoot, "apps/mobile");
  const artifact = path.resolve(repoRoot, output);
  const buildTool = yield* makeBuildTools();

  yield* fs.makeDirectory(path.dirname(artifact), { recursive: true });
  yield* fs.remove(artifact, { force: true });

  const nix = Script.command("nix", {
    cwd: mobileDirectory,
    env: { IOS_BUILD_MESSAGE: `Local ${profile} build` },
    extendEnv: true,
  });

  yield* nix`${[
    "shell",
    "nixpkgs#fastlane",
    "nixpkgs#cocoapods",
    "-c",
    buildTool,
    "--platform",
    "ios",
    "--profile",
    profile,
    "--local",
    "--non-interactive",
    "--message",
    `Local ${profile} build`,
    "--output",
    artifact,
  ]}`;

  const artifactExists = yield* fs.exists(artifact);
  if (!artifactExists) {
    return yield* new EmptyArtifactError({ path: artifact });
  }

  const info = yield* fs.stat(artifact);
  if (info.type !== "File" || info.size === 0n) {
    return yield* new EmptyArtifactError({ path: artifact });
  }

  yield* Console.log(`Built ${profile}: ${artifact}`);
  return artifact;
}, Effect.scoped);

const buildDevelopment = Effect.fn("ios.buildDevelopment")(function* () {
  const config = yield* configuration();
  return yield* build(development.profile, config.developmentArtifact);
});

const buildProduction = Effect.fn("ios.buildProduction")(function* () {
  const config = yield* configuration();
  return yield* build(production.profile, config.productionArtifact);
});

const buildBoth = Effect.fn("ios.buildBoth")(function* () {
  return yield* Effect.all([buildDevelopment(), buildProduction()], {
    concurrency: 2,
  });
});

const install = Effect.fn("ios.install")(function* (ipa: string) {
  const path = yield* Path.Path;
  const repoRoot = yield* repositoryRoot();
  const { device } = yield* configuration();
  const artifact = path.resolve(repoRoot, ipa);
  const xcrun = Script.command("xcrun");

  yield* xcrun`devicectl device install app --device ${device} ${artifact}`;
});

const installDevelopment = Effect.fn("ios.installDevelopment")(function* () {
  yield* install(yield* buildDevelopment());
});

const installProduction = Effect.fn("ios.installProduction")(function* () {
  yield* install(yield* buildProduction());
});

const listInstalledApps = Effect.fn("ios.listInstalledApps")(function* () {
  const { device } = yield* configuration();
  const output = yield* Script.capture("xcrun", [
    "devicectl",
    "device",
    "info",
    "apps",
    "--device",
    device,
  ]);
  const installedApps = output.split("\n").filter((line) => line.includes(bundleIdentifier));

  if (installedApps.length === 0) {
    return yield* new NoInstalledAppsError({ device });
  }

  yield* Console.log(installedApps.join("\n"));
});

const installBoth = Effect.fn("ios.installBoth")(function* () {
  const artifacts = yield* buildBoth();
  yield* Effect.forEach(artifacts, install, { discard: true });
  yield* listInstalledApps();
});

const listDevices = Script.command("xcrun")`devicectl list devices`;

const profile = Argument.string("profile").pipe(Argument.withDescription("EAS build profile"));
const output = Argument.path("output").pipe(Argument.withDescription("Destination IPA path"));
const ipa = Argument.file("ipa", { mustExist: true }).pipe(
  Argument.withDescription("IPA to install"),
);

const cli = Command.make("ios").pipe(
  Command.withDescription("Build and install Studienbuch iOS artifacts"),
  Command.withSubcommands([
    Command.make("build", { profile, output }, ({ profile, output }) =>
      build(profile, output),
    ).pipe(Command.withDescription("Build an IPA with an EAS profile")),
    Command.make("build-dev", {}, buildDevelopment).pipe(
      Command.withDescription("Build the development IPA"),
    ),
    Command.make("build-prod", {}, buildProduction).pipe(
      Command.withDescription("Build the production device IPA"),
    ),
    Command.make("build-both", {}, buildBoth).pipe(
      Command.withDescription("Build development and production IPAs concurrently"),
    ),
    Command.make("devices", {}, () => listDevices).pipe(
      Command.withDescription("List available Apple devices"),
    ),
    Command.make("install", { ipa }, ({ ipa }) => install(ipa)).pipe(
      Command.withDescription("Install an existing IPA on the configured device"),
    ),
    Command.make("install-dev", {}, installDevelopment).pipe(
      Command.withDescription("Build and install the development IPA"),
    ),
    Command.make("install-prod", {}, installProduction).pipe(
      Command.withDescription("Build and install the production IPA"),
    ),
    Command.make("install-both", {}, installBoth).pipe(
      Command.withDescription("Build and install both IPAs"),
    ),
    Command.make("installed-apps", {}, listInstalledApps).pipe(
      Command.withDescription("List installed Studienbuch apps"),
    ),
  ]),
);

Script.runMain(Command.run(cli, { version: "0.1.0" }));
