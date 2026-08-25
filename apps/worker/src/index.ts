import { flushOtlp, serverObservabilityLayer } from "@stu/observability/server";
import { Database, WebUntisDirectory, WebUntisImporter, WebUntisPolling } from "@stu/server";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

const observabilityLayer = serverObservabilityLayer({ serviceName: "studienbuch-worker" }).pipe(
  Layer.provide(FetchHttpClient.layer),
);

const platformLayer = Layer.mergeAll(NodeServices.layer, observabilityLayer);
const importerLayer = WebUntisImporter.layer.pipe(
  Layer.provide(Layer.merge(WebUntisDirectory.layer, Database.layerConfig)),
);

WebUntisPolling.run().pipe(
  Effect.provide(importerLayer),
  Effect.scoped,
  Effect.ensuring(flushOtlp.pipe(Effect.timeoutOption("5 seconds"))),
  Effect.provide(platformLayer),
  NodeRuntime.runMain,
);
