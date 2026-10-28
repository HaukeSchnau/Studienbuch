import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Otlp from "effect/observability/Otlp";
import * as OtlpSerialization from "effect/observability/OtlpSerialization";
import { Deployment } from "../config/Deployment.ts";

// The OpenTelemetry spec defaults each signal's exporter to `otlp`, and Effect defaults it to none.
// With the spec's default, `OTEL_EXPORTER_OTLP_ENDPOINT` alone turns export on.
const specDefaults = ConfigProvider.layerAdd(
  ConfigProvider.fromUnknown({
    OTEL_TRACES_EXPORTER: "otlp",
    OTEL_LOGS_EXPORTER: "otlp",
    OTEL_METRICS_EXPORTER: "otlp",
  }),
);

/**
 * Exports traces, logs and metrics over OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and does
 * nothing otherwise. Closing the layer flushes what is buffered.
 */
export const layer = Layer.unwrap(
  Effect.map(Deployment.Current, ({ revision, environment }) =>
    Otlp.layerFromConfig({
      resource: {
        serviceName: "studienbuch-server",
        serviceVersion: revision,
        attributes: { "deployment.environment.name": environment },
      },
    }),
  ),
).pipe(Layer.provide([OtlpSerialization.layerProtobuf, FetchHttpClient.layer, specDefaults]));

export * as Telemetry from "./Telemetry.ts";
