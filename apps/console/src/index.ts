import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Command } from "effect/unstable/cli";
import { observabilityCommand } from "./commands/observability.ts";
import { pullCommand } from "./commands/pull.ts";
import { webUntisDirectoryCommand } from "./commands/webuntis.ts";
import { withConsoleRuntime } from "./runtime.ts";

export const consoleCommand = Command.make("console").pipe(
  Command.withSubcommands([pullCommand, observabilityCommand, webUntisDirectoryCommand]),
);

const cli = Command.run(consoleCommand, { version: "0.1.0" });

cli.pipe(withConsoleRuntime, NodeRuntime.runMain);
