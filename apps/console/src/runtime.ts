import { flushOtlp, serverObservabilityLayer } from "@stu/observability/server";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

const consoleLayer = serverObservabilityLayer({ serviceName: "studienbuch-console" }).pipe(
  Layer.provide(FetchHttpClient.layer),
);
const migrationLayer = serverObservabilityLayer({ serviceName: "studienbuch-migration" }).pipe(
  Layer.provide(FetchHttpClient.layer),
);
export const ConsoleLive = Layer.mergeAll(NodeServices.layer, consoleLayer);
export const MigrationLive = Layer.mergeAll(NodeServices.layer, migrationLayer);

export function withConsoleRuntime<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return effect.pipe(
    Effect.ensuring(flushOtlp.pipe(Effect.timeoutOption("5 seconds"))),
    Effect.provide(ConsoleLive),
  );
}

export function withMigrationRuntime<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return effect.pipe(
    Effect.ensuring(flushOtlp.pipe(Effect.timeoutOption("5 seconds"))),
    Effect.provide(MigrationLive),
  );
}
