import * as Layer from "effect/Layer";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import type { OtlpExporter } from "effect/unstable/observability";
import {
  OtlpLogger,
  OtlpMetrics,
  OtlpSerialization,
  OtlpTracer,
} from "effect/unstable/observability";
import type { OtlpServerLayerOptions } from "./server.ts";
import { otlpResource } from "./shared/resource.ts";

export function otlpJsonTestLayer(
  options: OtlpServerLayerOptions,
): Layer.Layer<OtlpExporter.Flusher, never, HttpClient.HttpClient> {
  const baseUrl = String(options.endpoint).replace(/\/$/, "");
  const common = {
    resource: otlpResource(options.resource),
    exportInterval: options.exportInterval ?? "1 hour",
    shutdownTimeout: options.shutdownTimeout ?? "1 second",
  } as const;
  return Layer.mergeAll(
    OtlpLogger.layer({
      ...common,
      url: `${baseUrl}/v1/logs`,
      excludeLogSpans: true,
      mergeWithExisting: false,
    }),
    OtlpMetrics.layer({ ...common, url: `${baseUrl}/v1/metrics` }),
    OtlpTracer.layer({ ...common, url: `${baseUrl}/v1/traces` }),
  ).pipe(Layer.provide(OtlpSerialization.layerJson));
}
