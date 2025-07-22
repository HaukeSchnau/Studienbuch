import { DevTools } from "@effect/experimental";
import { NodeRuntime, NodeSocket } from "@effect/platform-node";
import { serve } from "@hono/node-server";
import { Effect, Layer } from "effect";
import { env } from "../env";
import { createBase } from "../src/base";
import { AppLayerLive } from "../src/groundswell";

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

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`Server is running on port ${info.port}`);
    },
  );
});

const DevToolsLive = DevTools.layerWebSocket().pipe(Layer.provide(NodeSocket.layerWebSocketConstructor));
const serverLive = server.pipe(Effect.provide(AppLayerLive), Effect.provide(DevToolsLive));
NodeRuntime.runMain(serverLive);
