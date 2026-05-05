import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

export const pullCommand = Command.make("pull", {}, () => Effect.log("Pulling..."));
