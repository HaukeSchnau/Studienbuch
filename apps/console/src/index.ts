import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { pullCommand } from "./commands/pull";

const consoleCommand = Command.make("console").pipe(Command.withSubcommands([pullCommand]));

const cli = Command.run(consoleCommand, { version: "0.1.0" });

BunRuntime.runMain(cli.pipe(Effect.provide(BunServices.layer)));
