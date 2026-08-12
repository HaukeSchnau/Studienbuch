import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";

export function jsonResponse<Body>(body: Body, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}

export function exitFailureResponse(exit: Exit.Exit<unknown, unknown>): Response | undefined {
  if (Exit.isSuccess(exit)) {
    return undefined;
  }
  return jsonResponse(
    {
      error: Cause.hasInterruptsOnly(exit.cause) ? "request_cancelled" : "internal_error",
    },
    Cause.hasInterruptsOnly(exit.cause) ? 499 : 500,
  );
}
