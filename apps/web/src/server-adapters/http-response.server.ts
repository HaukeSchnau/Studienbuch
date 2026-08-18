import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";

type JsonValue = string | number | boolean | null | JsonObject | ReadonlyArray<JsonValue>;
interface JsonObject {
  readonly [key: string]: JsonValue;
}

export function jsonResponse(body: JsonValue, status = 200): Response {
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
