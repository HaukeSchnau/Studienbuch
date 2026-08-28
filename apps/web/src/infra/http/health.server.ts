import { runCanary } from "@stu/observability";
import { flushOtlp } from "@stu/observability/server";
import { Database } from "@stu/server";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import {
  applicationRuntimeState,
  currentApplicationRuntime,
  type RuntimeState,
} from "#/infra/runtime/lifecycle.server.ts";
import { runRouteEffect } from "#/infra/runtime/request.server.ts";
import { exitFailureResponse, jsonResponse } from "#/infra/http/response.server.ts";

export const livenessRoute = "/api/health/live";
export const readinessRoute = "/api/health/ready";
export const canaryRoute = "/api/observability/v1/canary";

const databasePingTimeout = "2 seconds";

/**
 * Answers whether the database is responding right now, rather than whether a pool was once built.
 * Deliberately untraced: readiness is probed every couple of seconds and would otherwise dominate
 * the trace stream.
 */
async function pingDatabase(): Promise<boolean> {
  const exit = await currentApplicationRuntime().runPromiseExit(
    Effect.flatMap(Database.Service, (database) => database.ping).pipe(
      Effect.timeout(databasePingTimeout),
    ),
  );
  return Exit.isSuccess(exit);
}

export function makeHealthHandlers(options?: {
  readonly runtimeState?: () => RuntimeState;
  readonly pingDatabase?: () => Promise<boolean>;
  readonly run?: typeof runRouteEffect;
  readonly revision?: string;
}) {
  const runtimeState = options?.runtimeState ?? applicationRuntimeState;
  const ping = options?.pingDatabase ?? pingDatabase;
  const run = options?.run ?? runRouteEffect;
  const revision = options?.revision ?? (process.env.STUDIENBUCH_REVISION?.trim() || undefined);

  return {
    /**
     * Liveness answers "is this process still the process we started". It must never consult a
     * dependency: failing it tells the supervisor to restart, which cannot fix a sick database and
     * turns an outage into a crash loop.
     */
    liveness: (): Response => jsonResponse({ status: "alive" }),

    /** Readiness answers "should this instance receive traffic", and so does check dependencies. */
    readiness: async (): Promise<Response> => {
      const state = runtimeState();
      if (state.status !== "ready") {
        return jsonResponse({ status: "not_ready", runtime: state.status }, 503);
      }
      if (!(await ping())) {
        return jsonResponse({ status: "not_ready", runtime: "database_unavailable" }, 503);
      }
      return revision === undefined
        ? jsonResponse({ status: "ready" })
        : jsonResponse({ status: "ready", revision });
    },

    canary: async (request: Request): Promise<Response> => {
      const exit = await run(runCanary().pipe(Effect.tap(() => flushOtlp)), {
        request,
        route: canaryRoute,
      });
      const failure = exitFailureResponse(exit);
      if (failure !== undefined) return failure;
      return Exit.isSuccess(exit)
        ? jsonResponse({ status: "ok", ...exit.value })
        : jsonResponse({ error: "internal_error" }, 500);
    },
  };
}

const handlers = makeHealthHandlers();

export const handleLiveness = handlers.liveness;
export const handleReadiness = handlers.readiness;
export const handleCanary = handlers.canary;
