import { DevTools } from "@effect/experimental";
import { BunRuntime, BunSocket } from "@effect/platform-bun";
import { DatabaseLive } from "@stu/db";
import { serve } from "bun";
import { Effect, Layer } from "effect";
import { env } from "../env";
import { createBase } from "../src/base";
import { appServerLayer, canonicalStorageLive, memoryBroadcastLive } from "../src/groundswell";

const server = Effect.gen(function* () {
  const port = env.API_PORT;
  const app = yield* createBase("/");

  // TODO: experiment if this is needed with effect anymore
  process.on("SIGINT", () => {
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    process.exit(0);
  });

  serve({
    fetch: app.fetch,
    port,
  });
});

const DevToolsLive = DevTools.layerWebSocket().pipe(Layer.provide(BunSocket.layerWebSocketConstructor));
const serverLive = server.pipe(
  Effect.provide(appServerLayer),
  Effect.provide(memoryBroadcastLive),
  Effect.provide(canonicalStorageLive),
  Effect.provide(DatabaseLive),
  Effect.provide(DevToolsLive),
);
BunRuntime.runMain(serverLive);
