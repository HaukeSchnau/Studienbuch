import { spanAttributes } from "@stu/observability";
import { withIncomingTraceContext } from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import type * as Exit from "effect/Exit";
import type { OtlpExporter } from "effect/unstable/observability";
import type { ClientTelemetry } from "./client-telemetry.server.ts";
import { applicationRuntime, warmApplicationRuntime } from "./lifecycle.server.ts";

export interface RouteEffectOptions {
  readonly request: Request;
  readonly route: string;
}

export interface RouteEffectRunner {
  <A, E>(
    effect: Effect.Effect<A, E, ClientTelemetry | OtlpExporter.Flusher>,
    options: RouteEffectOptions,
  ): Promise<Exit.Exit<A, unknown>>;
}

export const runRouteEffect: RouteEffectRunner = async (effect, options) => {
  await warmApplicationRuntime();
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
