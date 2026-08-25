import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";

/** Parses a small JSON request without letting an endpoint become an upload sink. */
export async function readJsonBody(request: Request, maximumBodyBytes = 16 * 1_024) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return undefined;
  const raw = await request.text();
  if (raw.length > maximumBodyBytes) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** A value that survives `JSON.stringify` unchanged. */
type JsonValue = string | number | boolean | null | JsonObject | ReadonlyArray<JsonValue>;
interface JsonObject {
  readonly [key: string]: JsonValue;
}

/**
 * A JSON response with the headers every API route here wants: uncached, no scripts, no sniffing.
 *
 * `JsonValue` is deliberate rather than incidental. Widening `body` to `unknown` type-checks but
 * trips `anti-slop/no-unknown-parameters`, which is correct: this is an I/O boundary, and the
 * parameter type is where the response contract is stated.
 */
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
