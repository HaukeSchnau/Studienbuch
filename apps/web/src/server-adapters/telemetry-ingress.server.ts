import {
  decodeClientTelemetryEnvelope,
  type ClientTelemetryAcknowledgement,
} from "@stu/observability/browser";
import * as Cause from "effect/Cause";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { ClientTelemetry } from "../server-runtime/client-telemetry.server.ts";
import { runRouteEffect } from "../server-runtime/request.server.ts";
import { jsonResponse } from "./http-response.server.ts";
import { telemetryAdmission, type TelemetryAdmission } from "./telemetry-policy.server.ts";

export const telemetryRoute = "/api/observability/v1/telemetry";
export const maximumTelemetryBodyBytes = 64 * 1_024;

class InvalidTelemetryEnvelope extends Data.TaggedError("InvalidTelemetryEnvelope") {}

type BodyResult =
  | { readonly ok: true; readonly value: unknown }
  | {
      readonly ok: false;
      readonly status: 400 | 413 | 415;
      readonly error:
        | "compressed_body_not_supported"
        | "invalid_content_length"
        | "invalid_json"
        | "payload_too_large"
        | "unsupported_content_type";
    };

async function readBoundedBody(request: Request): Promise<BodyResult> {
  const contentEncoding = request.headers.get("content-encoding");
  if (contentEncoding !== null && contentEncoding.toLowerCase() !== "identity") {
    return { ok: false, status: 415, error: "compressed_body_not_supported" };
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false, status: 415, error: "unsupported_content_type" };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      return { ok: false, status: 400, error: "invalid_content_length" };
    }
    if (parsed > maximumTelemetryBodyBytes) {
      return { ok: false, status: 413, error: "payload_too_large" };
    }
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  if (reader !== undefined) {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      byteLength += result.value.byteLength;
      if (byteLength > maximumTelemetryBodyBytes) {
        await reader.cancel();
        return { ok: false, status: 413, error: "payload_too_large" };
      }
      chunks.push(result.value);
    }
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}

export function makeTelemetryIngressHandler(options?: {
  readonly admission?: TelemetryAdmission;
  readonly run?: typeof runRouteEffect;
}) {
  const admission = options?.admission ?? telemetryAdmission;
  const run = options?.run ?? runRouteEffect;

  return async (request: Request): Promise<Response> => {
    const decision = await admission.check(request);
    if (!decision.allowed) {
      const response = jsonResponse({ error: decision.error }, decision.status);
      if (decision.retryAfterSeconds !== undefined) {
        response.headers.set("retry-after", String(decision.retryAfterSeconds));
      }
      return response;
    }

    const body = await readBoundedBody(request);
    if (!body.ok) {
      return jsonResponse({ error: body.error }, body.status);
    }

    const program = Effect.gen(function* () {
      const envelope = yield* decodeClientTelemetryEnvelope(body.value).pipe(
        Effect.mapError(() => new InvalidTelemetryEnvelope()),
      );
      const telemetry = yield* ClientTelemetry;
      yield* telemetry.ingest(envelope);
      return envelope.records.length;
    });
    const exit = await run(program, { request, route: telemetryRoute });
    if (Exit.isSuccess(exit)) {
      // Ingestion is all-or-nothing today, so every accepted envelope acknowledges in full. The
      // count is still reported because clients decode it to decide what to retry, and a future
      // partial path must not need a protocol change.
      return jsonResponse(
        { acceptedRecords: exit.value } satisfies ClientTelemetryAcknowledgement,
        202,
      );
    }

    const failure = Cause.findErrorOption(exit.cause);
    return Option.isSome(failure) && failure.value instanceof InvalidTelemetryEnvelope
      ? jsonResponse({ error: "invalid_telemetry_envelope" }, 400)
      : jsonResponse({ error: "internal_error" }, 500);
  };
}

export const handleTelemetryIngress = makeTelemetryIngressHandler();
