import {
  clientMetricNames,
  type ClientMetricName,
  type ClientTelemetryEnvelope,
} from "@stu/observability/browser";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as Tracer from "effect/Tracer";

const acceptedRecords = Metric.counter("studienbuch_client_telemetry_records_total", {
  description: "Validated client telemetry records accepted by the server.",
  incremental: true,
});

const clientCanaryTotal = Metric.counter(clientMetricNames.canaryTotal, {
  description: "Client observability canaries accepted by the server.",
  incremental: true,
});

const clientRequestDuration = Metric.histogram(clientMetricNames.requestDuration, {
  description: "Client-observed request duration in milliseconds.",
  boundaries: [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000],
});

const clientOutboxDepth = Metric.gauge(clientMetricNames.outboxDepth, {
  description: "Client-reported durable telemetry outbox depth.",
});

const clientOutboxDropped = Metric.counter(clientMetricNames.outboxDropped, {
  description: "Client-reported telemetry records dropped from a bounded outbox.",
  incremental: true,
});

export class ClientTelemetry extends Context.Service<ClientTelemetry>()(
  "@stu/web/infra/observability/client-telemetry.server/ClientTelemetry",
  {
    make: Effect.succeed({
      ingest: Effect.fn("ClientTelemetry.ingest")((envelope: ClientTelemetryEnvelope) =>
        Effect.forEach(envelope.records, ingestRecord, { discard: true }).pipe(
          Effect.annotateLogs({
            client_service: envelope.serviceName,
            record_count: envelope.records.length,
          }),
          Effect.withSpan(
            "client.telemetry.ingest",
            {
              attributes: {
                "client.service.name": envelope.serviceName,
                "telemetry.record.count": envelope.records.length,
              },
            },
            { captureStackTrace: false },
          ),
        ),
      ),
    }),
  },
) {
  static readonly layer = Layer.effect(ClientTelemetry, this.make);
}

type RecordAttributes = Readonly<Record<string, string>>;
type MetricUpdate = (value: number, attributes: RecordAttributes) => Effect.Effect<void>;

/**
 * Every client metric name mapped onto the server instrument that records it.
 *
 * `satisfies Record<ClientMetricName, …>` is the point: adding a name to the shared vocabulary
 * fails this file until it is handled here, which the previous switch could not guarantee. Each
 * entry closes over its own instrument, so the differing state types never have to be unified.
 */
const updatesByName = {
  [clientMetricNames.canaryTotal]: (value, attributes) =>
    Metric.update(Metric.withAttributes(clientCanaryTotal, attributes), value),
  [clientMetricNames.requestDuration]: (value, attributes) =>
    Metric.update(Metric.withAttributes(clientRequestDuration, attributes), value),
  [clientMetricNames.outboxDepth]: (value, attributes) =>
    Metric.update(Metric.withAttributes(clientOutboxDepth, attributes), value),
  [clientMetricNames.outboxDropped]: (value, attributes) =>
    Metric.update(Metric.withAttributes(clientOutboxDropped, attributes), value),
} satisfies Record<ClientMetricName, MetricUpdate>;

function metricForRecord(
  record: Extract<ClientTelemetryEnvelope["records"][number], { readonly type: "metric" }>,
) {
  return updatesByName[record.name](record.value, {
    ...record.attributes,
    source: "public-client-ingress",
  });
}

function logLevelForSeverity(
  severity: "debug" | "info" | "warn" | "error",
): "Debug" | "Info" | "Warn" | "Error" {
  switch (severity) {
    case "debug":
      return "Debug";
    case "info":
      return "Info";
    case "warn":
      return "Warn";
    case "error":
      return "Error";
  }
}

function ingestRecord(record: ClientTelemetryEnvelope["records"][number]): Effect.Effect<void> {
  const countAccepted = Metric.update(
    Metric.withAttributes(acceptedRecords, { record_type: record.type }),
    1,
  );

  switch (record.type) {
    case "metric":
      return Effect.all([countAccepted, metricForRecord(record)], { discard: true });
    case "log": {
      return Effect.all(
        [
          countAccepted,
          Effect.logWithLevel(logLevelForSeverity(record.severity))(record.event).pipe(
            Effect.annotateLogs({
              ...record.attributes,
              event: record.event,
              source: "public-client-ingress",
            }),
          ),
        ],
        { discard: true },
      );
    }
    case "span": {
      const parent = Tracer.externalSpan({
        traceId: record.traceId,
        spanId: record.spanId,
        sampled: true,
      });
      return Effect.all(
        [
          countAccepted,
          Effect.void.pipe(
            Effect.withSpan(
              record.name,
              {
                parent,
                kind: "client",
                attributes: {
                  ...record.attributes,
                  "client.duration_ms": record.durationMillis,
                  "client.status": record.status,
                  source: "public-client-ingress",
                },
              },
              { captureStackTrace: false },
            ),
          ),
        ],
        { discard: true },
      );
    }
  }
}
