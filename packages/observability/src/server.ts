import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import type * as LogLevel from "effect/LogLevel";
import * as References from "effect/References";
import type * as Duration from "effect/Duration";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import {
  OtlpExporter,
  OtlpLogger,
  OtlpMetrics,
  OtlpSerialization,
  OtlpTracer,
} from "effect/unstable/observability";
import type { ResourceIdentity } from "./resource.ts";
import { otlpResource } from "./resource.ts";

export { serverConfig, type ServerConfig } from "./config.ts";

export interface OtlpServerLayerOptions {
  readonly endpoint: string | URL;
  readonly resource: ResourceIdentity;
  readonly logLevel?: LogLevel.LogLevel;
  readonly traceLevel?: LogLevel.LogLevel;
  readonly exportInterval?: Duration.Input;
  readonly shutdownTimeout?: Duration.Input;
}

export function otlpProtobufLayer(
  options: OtlpServerLayerOptions,
): Layer.Layer<OtlpExporter.Flusher, never, HttpClient.HttpClient> {
  const references = Layer.mergeAll(
    Layer.succeed(References.MinimumLogLevel, options.logLevel ?? "Info"),
    Layer.succeed(References.MinimumTraceLevel, options.traceLevel ?? "Info"),
  );
  const baseUrl = String(options.endpoint).replace(/\/$/, "");
  const common = {
    resource: otlpResource(options.resource),
    exportInterval: options.exportInterval ?? "5 seconds",
    shutdownTimeout: options.shutdownTimeout ?? "3 seconds",
  } as const;
  const exporter = Layer.mergeAll(
    OtlpLogger.layer({
      ...common,
      url: `${baseUrl}/v1/logs`,
      excludeLogSpans: true,
      mergeWithExisting: false,
    }),
    OtlpMetrics.layer({ ...common, url: `${baseUrl}/v1/metrics` }),
    OtlpTracer.layer({ ...common, url: `${baseUrl}/v1/traces` }),
  ).pipe(Layer.provide(OtlpSerialization.layerProtobuf));

  return Layer.mergeAll(references, exporter);
}

export const flushOtlp = Effect.gen(function* () {
  const flusher = yield* OtlpExporter.Flusher;
  yield* flusher.flush;
});

export function developmentLayer(options?: {
  readonly logLevel?: LogLevel.LogLevel;
  readonly traceLevel?: LogLevel.LogLevel;
}): Layer.Layer<never> {
  return Layer.mergeAll(
    Logger.layer([Logger.consolePretty()]),
    Layer.succeed(References.MinimumLogLevel, options?.logLevel ?? "Debug"),
    Layer.succeed(References.MinimumTraceLevel, options?.traceLevel ?? "Debug"),
  );
}

export function productionJsonLayer(options?: {
  readonly logLevel?: LogLevel.LogLevel;
  readonly traceLevel?: LogLevel.LogLevel;
}): Layer.Layer<never> {
  return Layer.mergeAll(
    Logger.layer([Logger.consoleJson]),
    Layer.succeed(References.MinimumLogLevel, options?.logLevel ?? "Info"),
    Layer.succeed(References.MinimumTraceLevel, options?.traceLevel ?? "Info"),
  );
}
