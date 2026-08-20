import {
  decodeClientTelemetryAcknowledgement,
  type ClientTelemetryEnvelopeType,
  type TelemetryDelivery,
} from "@stu/observability/browser";
import { Option } from "effect";

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
): TelemetryDelivery => ({
  send: async (envelope: ClientTelemetryEnvelopeType) => {
    const authorization = await options.authorization();
    if (
      authorization === undefined ||
      !authorization.startsWith("Bearer ") ||
      authorization.length <= "Bearer ".length ||
      authorization.length > 4_096 ||
      authorization.includes("\r") ||
      authorization.includes("\n")
    ) {
      return { status: "failed", reason: "Authenticated telemetry authority is unavailable" };
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
        status: "failed",
        reason: `Telemetry relay rejected the batch (${response.status})`,
      };
    }
    const body: unknown = await response.json().catch(() => undefined);
    const acknowledgement = decodeClientTelemetryAcknowledgement(body, {
      onExcessProperty: "error",
    });
    return Option.isSome(acknowledgement) &&
      acknowledgement.value.acceptedRecords <= envelope.records.length
      ? { status: "sent", accepted: acknowledgement.value.acceptedRecords }
      : { status: "failed", reason: "Telemetry relay returned an invalid acknowledgement" };
  },
});
