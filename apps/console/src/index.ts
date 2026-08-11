import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { pullCommand } from "./commands/pull.ts";

const consoleCommand = Command.make("console").pipe(Command.withSubcommands([pullCommand]));

const cli = Command.run(consoleCommand, { version: "0.1.0" });

NodeRuntime.runMain(cli.pipe(Effect.provide(NodeServices.layer)));
