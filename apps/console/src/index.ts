import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Command } from "effect/unstable/cli";
import { observabilityCommand } from "./commands/observability.ts";
import {
  accessCodesCommand,
  operatorBootstrapCommand,
  operatorRecoverCommand,
} from "./commands/auth.ts";
import { pullCommand } from "./commands/pull.ts";
import {
  webUntisCourseIdentityAuditCommand,
  webUntisCourseRosterCommand,
  webUntisDirectoryCommand,
  webUntisPollCommand,
  webUntisTimetableCommand,
} from "./commands/webuntis.ts";
import { withConsoleRuntime } from "./runtime.ts";

export const consoleCommand = Command.make("console").pipe(
  Command.withSubcommands([
    pullCommand,
    operatorBootstrapCommand,
    operatorRecoverCommand,
    accessCodesCommand,
    observabilityCommand,
    webUntisDirectoryCommand,
    webUntisTimetableCommand,
    webUntisCourseRosterCommand,
    webUntisCourseIdentityAuditCommand,
    webUntisPollCommand,
  ]),
);

const cli = Command.run(consoleCommand, { version: "0.1.0" });

cli.pipe(withConsoleRuntime, NodeRuntime.runMain);
