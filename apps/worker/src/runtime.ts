import { flushOtlp, serverObservabilityLayer } from "@stu/observability/server";
import { Database, WebUntisDirectory, WebUntisImporter } from "@stu/server";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

const observabilityLayer = serverObservabilityLayer({ serviceName: "studienbuch-worker" }).pipe(
  Layer.provide(FetchHttpClient.layer),
);

const WorkerLive = Layer.mergeAll(NodeServices.layer, observabilityLayer);

export const ImporterLive = WebUntisImporter.layer.pipe(
  Layer.provide(Layer.merge(WebUntisDirectory.layer, Database.layerConfig)),
);

export function withWorkerRuntime<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return effect.pipe(
    Effect.scoped,
    Effect.ensuring(flushOtlp.pipe(Effect.timeoutOption("5 seconds"))),
    Effect.provide(WorkerLive),
  );
}
