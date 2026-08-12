import { runCanary } from "@stu/observability";
import { flushOtlp } from "@stu/observability/server";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { applicationRuntimeState } from "../server-runtime/lifecycle.server.ts";
import { runRouteEffect } from "../server-runtime/request.server.ts";
import { exitFailureResponse, jsonResponse } from "./http-response.server.ts";

export const livenessRoute = "/api/health/live";
export const readinessRoute = "/api/health/ready";
export const canaryRoute = "/api/observability/v1/canary";

export function handleLiveness(): Response {
  return jsonResponse({ status: "alive" });
}

export function handleReadiness(): Response {
  const state = applicationRuntimeState();
  return state.status === "ready"
    ? jsonResponse({ status: "ready" })
    : jsonResponse({ status: "not_ready", runtime: state.status }, 503);
}

export async function handleCanary(request: Request): Promise<Response> {
  const exit = await runRouteEffect(runCanary().pipe(Effect.tap(() => flushOtlp)), {
    request,
    route: canaryRoute,
  });
  const failure = exitFailureResponse(exit);
  if (failure !== undefined) return failure;
  if (Exit.isSuccess(exit)) {
    return jsonResponse({ status: "ok", ...exit.value });
  }
  return jsonResponse({ error: "internal_error" }, 500);
}
