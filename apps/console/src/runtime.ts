import { developmentLayer } from "@stu/observability/server";
import { flushOtlp, otlpProtobufLayer, serverConfig } from "@stu/observability/server";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as OtlpExporter from "effect/unstable/observability/OtlpExporter";

const environmentConfig = Config.schema(
  Schema.Literals(["development", "test", "staging", "production"]),
  "STUDIENBUCH_ENVIRONMENT",
).pipe(Config.withDefault("development"));

const serviceVersionConfig = Config.string("STUDIENBUCH_VERSION").pipe(Config.withDefault("0.1.0"));

const disabledFlusherLayer = Layer.succeed(OtlpExporter.Flusher, {
  flush: Effect.void,
  register: () => Effect.void,
});

const observabilityLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* serverConfig;
    const environment = yield* environmentConfig;
    const serviceVersion = yield* serviceVersionConfig;

    if (!config.enabled) {
      return Layer.mergeAll(
        developmentLayer({ logLevel: config.logLevel, traceLevel: config.traceLevel }),
        disabledFlusherLayer,
      );
    }

    return otlpProtobufLayer({
      endpoint: config.endpoint,
      resource: {
        serviceName: "studienbuch-console",
        serviceVersion,
        environment,
      },
      logLevel: config.logLevel,
      traceLevel: config.traceLevel,
      exportInterval: config.exportInterval,
      shutdownTimeout: config.shutdownTimeout,
    }).pipe(Layer.provide(FetchHttpClient.layer));
  }),
);

export const ConsoleLive = Layer.mergeAll(NodeServices.layer, observabilityLayer);

export function withConsoleRuntime<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return effect.pipe(
    Effect.ensuring(flushOtlp.pipe(Effect.timeoutOption("5 seconds"))),
    Effect.provide(ConsoleLive),
  );
}
