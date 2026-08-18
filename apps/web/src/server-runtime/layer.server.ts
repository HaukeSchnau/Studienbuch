import {
  developmentLayer,
  otlpProtobufLayer,
  productionJsonLayer,
  serverConfig,
} from "@stu/observability/server";
import { Database } from "@stu/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { OtlpExporter } from "effect/unstable/observability";
import { ClientTelemetryLive } from "./client-telemetry.server.ts";

function deploymentEnvironment(): "development" | "test" | "staging" | "production" {
  const value = process.env["STUDIENBUCH_ENVIRONMENT"] ?? process.env["NODE_ENV"];
  return value === "production" || value === "staging" || value === "test" ? value : "development";
}

const telemetryLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* serverConfig;
    if (!config.enabled) {
      const logger =
        deploymentEnvironment() === "production"
          ? productionJsonLayer({ logLevel: config.logLevel, traceLevel: config.traceLevel })
          : developmentLayer({ logLevel: config.logLevel, traceLevel: config.traceLevel });
      return Layer.mergeAll(logger, OtlpExporter.layerFlusher);
    }

    return otlpProtobufLayer({
      endpoint: config.endpoint,
      resource: {
        serviceName: "studienbuch-server",
        serviceVersion: process.env["STUDIENBUCH_VERSION"] ?? "development",
        environment: deploymentEnvironment(),
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
