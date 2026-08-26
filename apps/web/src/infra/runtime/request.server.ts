import { spanAttributes } from "@stu/observability";
import { withIncomingTraceContext } from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import type * as Exit from "effect/Exit";
import type { OtlpExporter } from "effect/unstable/observability";
import type { Database } from "@stu/server";
import type { ClientTelemetry } from "#/infra/observability/client-telemetry.server.ts";
import { applicationRuntime } from "./lifecycle.server.ts";

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
 * trace context. The runtime is warmed once by the Nitro plugin, which terminates the process if it
 * cannot be built, so handlers never see a half-constructed runtime here.
 */
export const runRouteEffect: RouteEffectRunner<RuntimeServices> = (effect, options) => {
  const traced = effect.pipe(
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
  return applicationRuntime.runPromiseExit(
    withIncomingTraceContext(traced, options.request.headers),
    { signal: options.request.signal },
  );
};
