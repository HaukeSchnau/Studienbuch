import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { ClientTelemetryAcknowledgement, type ClientTelemetryEnvelope } from "./envelope.ts";
import { TelemetryDelivery, type TelemetryDeliveryResult } from "./outbox.ts";

const validSessionCookie = (value: string | undefined): value is string =>
  value !== undefined &&
  value.includes("=") &&
  value.length <= 8_192 &&
  !value.includes("\r") &&
  !value.includes("\n");

export interface TelemetryHttpDeliveryOptions {
  readonly endpoint: string;
  /** Omit for same-origin browser delivery. Native delivery requires a fresh session per send. */
  readonly sessionCookie?: Effect.Effect<string | undefined>;
  readonly sendBeacon?: (envelope: ClientTelemetryEnvelope) => boolean;
}

/** Builds telemetry delivery on Effect HTTP without taking retry ownership away from the outbox. */
export const makeTelemetryHttpDelivery = (
  options: TelemetryHttpDeliveryOptions,
): Effect.Effect<TelemetryDelivery["Service"], never, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;

    const send = (envelope: ClientTelemetryEnvelope): Effect.Effect<TelemetryDeliveryResult> =>
      Effect.gen(function* () {
        const sessionCookie =
          options.sessionCookie === undefined ? undefined : yield* options.sessionCookie;
        if (options.sessionCookie !== undefined && !validSessionCookie(sessionCookie)) {
          return {
            status: "failed" as const,
            reason: "Authenticated telemetry authority is unavailable",
          };
        }

        const baseRequest = HttpClientRequest.post(options.endpoint);
        const authorizedRequest =
          sessionCookie === undefined
            ? baseRequest
            : HttpClientRequest.setHeader(baseRequest, "cookie", sessionCookie);
        const request = yield* HttpClientRequest.bodyJson(authorizedRequest, envelope);
        const response = yield* httpClient.execute(request);
        if (response.status < 200 || response.status >= 300) {
          return {
            status: "failed" as const,
            reason: `Telemetry ingress rejected the batch (${response.status})`,
          };
        }

        const decoded = yield* HttpClientResponse.schemaBodyJson(ClientTelemetryAcknowledgement, {
          onExcessProperty: "error",
        })(response).pipe(Effect.result);
        if (Result.isFailure(decoded)) {
          return {
            status: "failed" as const,
            reason: "Telemetry ingress returned an invalid acknowledgement",
          };
        }
        return { status: "sent" as const, accepted: decoded.success.acceptedRecords };
      }).pipe(
        Effect.catchCause(() =>
          Effect.succeed({ status: "failed" as const, reason: "Telemetry delivery failed" }),
        ),
      );

    return TelemetryDelivery.of({ send, sendBeacon: options.sendBeacon });
  });
