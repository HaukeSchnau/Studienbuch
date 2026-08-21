import { flushOtlp, serverObservabilityLayer } from "@stu/observability/server";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

const observabilityLayer = serverObservabilityLayer({ serviceName: "studienbuch-console" }).pipe(
  Layer.provide(FetchHttpClient.layer),
);

export const ConsoleLive = Layer.mergeAll(NodeServices.layer, observabilityLayer);

export function withConsoleRuntime<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return effect.pipe(
    Effect.ensuring(flushOtlp.pipe(Effect.timeoutOption("5 seconds"))),
    Effect.provide(ConsoleLive),
  );
}
