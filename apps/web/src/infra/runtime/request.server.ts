import {
  outcomeFromExit,
  serverHttpRequestDuration,
  serverHttpRequests,
  spanAttributes,
} from "@stu/observability";
import * as Clock from "effect/Clock";
import { withIncomingTraceContext } from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import type * as Exit from "effect/Exit";
import * as Metric from "effect/Metric";
import type { OtlpExporter } from "effect/unstable/observability";
import type { Database } from "@stu/server";
import type { ClientTelemetry } from "#/infra/observability/client-telemetry.server.ts";
import { httpAvailabilityOutcome } from "./http-outcome.ts";
import { currentApplicationRuntime } from "./lifecycle.server.ts";

export interface RouteEffectOptions {
  readonly request: Request;
  readonly route: string;
}

/**
 * Everything `WebApplicationLive` provides. A handler may require any of it; the runtime is built
 * once at start-up and the process exits if it cannot be, so nothing here is optional at runtime.
 */
type RuntimeServices = ClientTelemetry | Database.Service | OtlpExporter.Flusher;

export interface RouteEffectRunner<R = ClientTelemetry | OtlpExporter.Flusher> {
  <A, E>(
    effect: Effect.Effect<A, E, R>,
    options: RouteEffectOptions,
  ): Promise<Exit.Exit<A, unknown>>;
}

/**
 * Runs a route's effect on the process-wide runtime, as a server span continuing any incoming W3C
 * trace context. Each runtime generation starts warming when its module loads; the Nitro plugin
 * terminates the process if that warmup fails, so handlers never see a half-constructed runtime.
 */
export const runRouteEffect: RouteEffectRunner<RuntimeServices> = (effect, options) => {
  const traced = Effect.gen(function* () {
    const startedAt = yield* Clock.currentTimeMillis;
    return yield* effect.pipe(
      Effect.onExit((exit) => {
        const outcome =
          exit._tag === "Success" && exit.value instanceof Response && !exit.value.ok
            ? "failure"
            : outcomeFromExit(exit);
        const availabilityOutcome =
          exit._tag === "Success" && exit.value instanceof Response
            ? httpAvailabilityOutcome(exit.value)
            : outcomeFromExit(exit) === "success"
              ? "success"
              : "failure";
        const attributes = {
          "availability.outcome": availabilityOutcome,
          "http.method": options.request.method,
          "http.route": options.route,
          outcome,
        };
        return Effect.all([
          Metric.update(Metric.withAttributes(serverHttpRequests, attributes), 1),
          Clock.currentTimeMillis.pipe(
            Effect.flatMap((endedAt) =>
              Metric.update(
                Metric.withAttributes(serverHttpRequestDuration, attributes),
                Math.max(0, endedAt - startedAt),
              ),
            ),
          ),
        ]).pipe(Effect.asVoid);
      }),
    );
  }).pipe(
    Effect.withSpan(
      `http ${options.request.method} ${options.route}`,
      {
        kind: "server",
        attributes: spanAttributes({
          "http.method": options.request.method,
          "http.route": options.route,
        }),
      },
      { captureStackTrace: false },
    ),
  );
  return currentApplicationRuntime().runPromiseExit(
    withIncomingTraceContext(traced, options.request.headers),
    { signal: options.request.signal },
  );
};
