import type { ClientTelemetryEnvelopeType } from "@stu/observability/browser";
import { Option, Schema } from "effect";
import type { TelemetryTransport } from "./outbox";

export type TelemetryAuthorization = () => Promise<string | undefined>;

export interface FetchTelemetryTransportOptions {
  readonly endpoint: string;
  readonly authorization: TelemetryAuthorization;
  readonly fetch?: typeof globalThis.fetch;
}

const TelemetryAcknowledgement = Schema.Struct({
  acceptedRecords: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
});

const decodeTelemetryAcknowledgement = Schema.decodeUnknownOption(TelemetryAcknowledgement);

export const makeFetchTelemetryTransport = (
  options: FetchTelemetryTransportOptions,
): TelemetryTransport => ({
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
      throw new Error("Authenticated telemetry authority is unavailable");
    }
    const response = await (options.fetch ?? globalThis.fetch)(options.endpoint, {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify(envelope),
    });
    if (!response.ok) throw new Error(`Telemetry relay rejected the batch (${response.status})`);
    const body = await response.json().catch(() => undefined);
    const acknowledgement = decodeTelemetryAcknowledgement(body, { onExcessProperty: "error" });
    if (
      Option.isSome(acknowledgement) &&
      acknowledgement.value.acceptedRecords <= envelope.records.length
    ) {
      return acknowledgement.value.acceptedRecords;
    }
    if (body === undefined) return envelope.records.length;
    throw new Error("Telemetry relay returned an invalid acknowledgement");
  },
});
