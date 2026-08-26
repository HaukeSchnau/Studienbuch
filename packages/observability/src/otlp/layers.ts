import type * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import type * as LogLevel from "effect/LogLevel";
import * as References from "effect/References";
import * as Tracer from "effect/Tracer";
import type * as Duration from "effect/Duration";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import {
  OtlpExporter,
  OtlpLogger,
  OtlpMetrics,
  OtlpSerialization,
  OtlpTracer,
} from "effect/unstable/observability";
import type { ResourceIdentity, ServiceName } from "../opentelemetry/resource.ts";
import { otlpResource } from "../opentelemetry/resource.ts";
import {
  environmentConfig,
  revisionConfig,
  serverConfig,
  serviceInstanceIdConfig,
  serviceVersionConfig,
} from "./config.ts";

export interface OtlpServerLayerOptions {
  readonly endpoint: string | URL;
  readonly resource: ResourceIdentity;
  readonly logLevel?: LogLevel.LogLevel;
  readonly traceLevel?: LogLevel.LogLevel;
  readonly exportInterval?: Duration.Input;
  readonly shutdownTimeout?: Duration.Input;
  readonly databaseSpanSampleEvery?: number;
}

const drizzleOperationSpan = "drizzle.operation";

/**
 * Keeps representative database detail without letting row-oriented import work dominate a trace.
 * `sql.execute` is a child of Drizzle's operation span, so Effect propagates the sampling decision
 * to the actual database span and preserves both halves of every retained sample.
 */
export function makeDatabaseSpanSampler(sampleEvery = 100): (spanName: string) => boolean {
  let operation = 0;
  return (spanName) =>
    spanName !== drizzleOperationSpan || operation++ % Math.max(1, sampleEvery) === 0;
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
  const tracer = Layer.effect(
    Tracer.Tracer,
    Effect.gen(function* () {
      const delegate = yield* OtlpTracer.make({ ...common, url: `${baseUrl}/v1/traces` });
      const shouldSample = makeDatabaseSpanSampler(options.databaseSpanSampleEvery);
      return Tracer.make({
        span(spanOptions) {
          return delegate.span({
            ...spanOptions,
            sampled: spanOptions.sampled && shouldSample(spanOptions.name),
          });
        },
        context: delegate.context,
      });
    }),
  ).pipe(Layer.provideMerge(OtlpExporter.layerFlusher));
  const exporter = Layer.mergeAll(
    OtlpLogger.layer({
      ...common,
      url: `${baseUrl}/v1/logs`,
      excludeLogSpans: true,
      mergeWithExisting: false,
    }),
    OtlpMetrics.layer({ ...common, url: `${baseUrl}/v1/metrics` }),
    tracer,
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

/**
 * The whole server-side observability layer for one service, assembled from the environment.
 *
 * `apps/web` and `apps/console` each built this themselves and had already drifted: the web app
 * coerced the environment with a hand-written `Config.map` while the console decoded it through a
 * literal schema, and the disabled branch used `OtlpExporter.layerFlusher` in one and a
 * hand-written no-op `Flusher` in the other. Adding a third service should not mean writing it a
 * third time.
 */
export function serverObservabilityLayer(options: {
  readonly serviceName: ServiceName;
}): Layer.Layer<OtlpExporter.Flusher, Config.ConfigError, HttpClient.HttpClient> {
  return Layer.unwrap(
    Effect.gen(function* () {
      const config = yield* serverConfig;
      const environment = yield* environmentConfig;
      const serviceVersion = yield* serviceVersionConfig;
      const instanceId = yield* serviceInstanceIdConfig;
      const revision = yield* revisionConfig;

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
          serviceName: options.serviceName,
          serviceVersion,
          environment,
          instanceId,
          revision,
        },
        logLevel: config.logLevel,
        traceLevel: config.traceLevel,
        exportInterval: config.exportInterval,
        shutdownTimeout: config.shutdownTimeout,
      });
    }),
  );
}
