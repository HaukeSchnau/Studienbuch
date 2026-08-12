import type { ClientTelemetryEnvelopeType } from "@stu/observability/browser";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as Tracer from "effect/Tracer";

const acceptedRecords = Metric.counter("studienbuch_client_telemetry_records_total", {
  description: "Validated client telemetry records accepted by the Studienbuch server.",
  incremental: true,
});

const clientCanaryTotal = Metric.counter("studienbuch_client_canary_total", {
  description: "Client observability canaries accepted by the Studienbuch server.",
  incremental: true,
});

const clientRequestDuration = Metric.histogram("studienbuch_client_request_duration_ms", {
  description: "Client-observed request duration in milliseconds.",
  boundaries: [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000],
});

const clientOutboxDepth = Metric.gauge("studienbuch_client_outbox_depth", {
  description: "Client-reported durable telemetry outbox depth.",
});

const clientOutboxDropped = Metric.counter("studienbuch_client_outbox_dropped_total", {
  description: "Client-reported telemetry records dropped from a bounded outbox.",
  incremental: true,
});

export interface ClientTelemetryService {
  readonly ingest: (envelope: ClientTelemetryEnvelopeType) => Effect.Effect<void>;
}

export class ClientTelemetry extends Context.Service<ClientTelemetry, ClientTelemetryService>()(
  "@stu/web/ClientTelemetry",
) {}

function metricForRecord(
  record: Extract<ClientTelemetryEnvelopeType["records"][number], { readonly type: "metric" }>,
) {
  const attributes = { ...record.attributes, source: "public-client-ingress" };
  switch (record.name) {
    case "studienbuch_client_canary_total":
      return Metric.update(Metric.withAttributes(clientCanaryTotal, attributes), record.value);
    case "studienbuch_client_request_duration_ms":
      return Metric.update(Metric.withAttributes(clientRequestDuration, attributes), record.value);
    case "studienbuch_client_outbox_depth":
      return Metric.update(Metric.withAttributes(clientOutboxDepth, attributes), record.value);
    case "studienbuch_client_outbox_dropped_total":
      return Metric.update(Metric.withAttributes(clientOutboxDropped, attributes), record.value);
  }
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

function ingestRecord(record: ClientTelemetryEnvelopeType["records"][number]): Effect.Effect<void> {
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

export const ClientTelemetryLive = Layer.succeed(ClientTelemetry, {
  ingest: Effect.fn("ClientTelemetry.ingest")((envelope: ClientTelemetryEnvelopeType) =>
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
});
