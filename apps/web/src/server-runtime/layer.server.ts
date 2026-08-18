import {
  developmentLayer,
  otlpProtobufLayer,
  productionJsonLayer,
  serverConfig,
} from "@stu/observability/server";
import { Database } from "@stu/server";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { OtlpExporter } from "effect/unstable/observability";
import { ClientTelemetryLive } from "./client-telemetry.server.ts";

const environmentConfig = Config.string("STUDIENBUCH_ENVIRONMENT").pipe(
  Config.orElse(() => Config.string("NODE_ENV")),
  Config.withDefault("development"),
  Config.map((value) =>
    value === "production" || value === "staging" || value === "test" ? value : "development",
  ),
);

const telemetryLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* serverConfig;
    const serviceVersion = yield* Config.string("STUDIENBUCH_VERSION").pipe(
      Config.withDefault("development"),
    );
    const environment = yield* environmentConfig;
    if (!config.enabled) {
      const logger =
        environment === "production"
          ? productionJsonLayer({ logLevel: config.logLevel, traceLevel: config.traceLevel })
          : developmentLayer({ logLevel: config.logLevel, traceLevel: config.traceLevel });
      return Layer.mergeAll(logger, OtlpExporter.layerFlusher);
    }

    return otlpProtobufLayer({
      endpoint: config.endpoint,
      resource: {
        serviceName: "studienbuch-server",
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

export const WebApplicationLive = Layer.mergeAll(ClientTelemetryLive, Database.layerConfig).pipe(
  Layer.provideMerge(telemetryLayer),
);
