import { DevTools } from "@effect/experimental";
import { BunRuntime, BunSocket } from "@effect/platform-bun";
import { serve } from "bun";
import { Effect, Layer } from "effect";
import { env } from "../env";
import { createBase } from "../src/base";
import { AppLayerLive } from "../src/groundswell";

const server = Effect.gen(function* () {
  const port = env.API_PORT;
  const app = yield* createBase("/");

  serve({
    fetch: app.fetch,
    port,
  });

  yield* Effect.log(`Server is running at http://localhost:${port}`);
  return yield* Effect.never; // Prevent from closing scope too early. need to find better solution. Probably need to integrate better into Effect.
});

const DevToolsLive = DevTools.layerWebSocket().pipe(Layer.provide(BunSocket.layerWebSocketConstructor));
const serverLive = server.pipe(Effect.provide(AppLayerLive), Effect.provide(DevToolsLive));
BunRuntime.runMain(Effect.scoped(serverLive) as Effect.Effect<never, never, never>);
