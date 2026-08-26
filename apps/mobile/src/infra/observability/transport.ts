import {
  decodeClientTelemetryAcknowledgement,
  TelemetryDelivery,
  type ClientTelemetryEnvelope,
} from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

export type TelemetryAuthorization = () => Promise<string | undefined>;

export interface FetchTelemetryTransportOptions {
  readonly endpoint: string;
  readonly authorization: TelemetryAuthorization;
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Native delivery to the Studienbuch relay.
 *
 * A native client sends no `Origin` header, so the server admits it on its session instead. The
 * acknowledgement is decoded from the shared contract, which is what lets a partially accepted
 * batch retain its remainder rather than being dropped or replayed whole.
 */
export const makeFetchTelemetryTransport = (
  options: FetchTelemetryTransportOptions,
): TelemetryDelivery["Service"] =>
  TelemetryDelivery.of({
    send: (envelope: ClientTelemetryEnvelope) =>
      Effect.tryPromise(async () => {
        const authorization = await options.authorization();
        if (
          authorization === undefined ||
          !authorization.startsWith("Bearer ") ||
          authorization.length <= "Bearer ".length ||
          authorization.length > 4_096 ||
          authorization.includes("\r") ||
          authorization.includes("\n")
        ) {
          return {
            status: "failed" as const,
            reason: "Authenticated telemetry authority is unavailable",
          };
        }
        const response = await (options.fetch ?? globalThis.fetch)(options.endpoint, {
          method: "POST",
          headers: {
            authorization,
            "content-type": "application/json",
          },
          body: JSON.stringify(envelope),
        });
        if (!response.ok) {
          return {
            status: "failed" as const,
            reason: `Telemetry relay rejected the batch (${response.status})`,
          };
        }
        const body: unknown = await response.json().catch(() => undefined);
        const acknowledgement = decodeClientTelemetryAcknowledgement(body, {
          onExcessProperty: "error",
        });
        return Option.isSome(acknowledgement) &&
          acknowledgement.value.acceptedRecords <= envelope.records.length
          ? { status: "sent" as const, accepted: acknowledgement.value.acceptedRecords }
          : {
              status: "failed" as const,
              reason: "Telemetry relay returned an invalid acknowledgement",
            };
      }).pipe(
        Effect.catchCause(() =>
          Effect.succeed({ status: "failed" as const, reason: "Telemetry delivery failed" }),
        ),
      ),
  });
