import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric";
import { spanAttributes } from "../opentelemetry/attributes.ts";
import { canaryDuration, canaryTotal } from "./metrics.ts";

export interface CanaryResult {
  readonly traceId: string;
  readonly spanId: string;
}

export const runCanary = Effect.fn("Observability.canary")(
  function* () {
    const startedAt = yield* Clock.currentTimeNanos;
    const span = yield* Effect.currentSpan;

    yield* Effect.logInfo("observability.canary", {
      event: "observability.canary",
      signal: "all",
    });
    yield* Metric.update(canaryTotal, 1);

    const endedAt = yield* Clock.currentTimeNanos;
    yield* Metric.update(
      canaryDuration,
      Duration.nanos(endedAt > startedAt ? endedAt - startedAt : 0n),
    );

    return { traceId: span.traceId, spanId: span.spanId };
  },
  (effect) =>
    effect.pipe(
      Effect.annotateLogs({ event: "observability.canary", signal: "all" }),
      Effect.withSpan("observability.canary", {
        attributes: spanAttributes({
          "app.operation": "observability.canary",
          outcome: "success",
          "telemetry.priority": "high",
        }),
      }),
    ),
);
