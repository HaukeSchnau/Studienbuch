import { describe, expect, it } from "vite-plus/test";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/unstable/http/HttpClient";
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type { ClientTelemetryEnvelope } from "./envelope.ts";
import { makeTelemetryHttpDelivery } from "./http-delivery.ts";

const envelope: ClientTelemetryEnvelope = {
  schemaVersion: 1,
  serviceName: "studienbuch-mobile",
  serviceVersion: "test",
  environment: "test",
  sentAtUnixMillis: 1_800_000_000_000,
  records: [
    {
      type: "metric",
      name: "studienbuch_client_canary_total",
      kind: "counter",
      value: 1,
      recordedAtUnixMillis: 1_800_000_000_000,
      attributes: { platform: "ios", signal: "all" },
    },
  ],
};

const fixture = (response: Response, sessionCookie?: Effect.Effect<string | undefined>) => {
  const requests: HttpClientRequest.HttpClientRequest[] = [];
  const client = HttpClient.make((request) => {
    requests.push(request);
    return Effect.succeed(HttpClientResponse.fromWeb(request, response));
  });
  const delivery = Effect.runSync(
    makeTelemetryHttpDelivery({
      endpoint: "https://studienbuch.test/api/observability/v1/telemetry",
      sessionCookie,
    }).pipe(Effect.provideService(HttpClient.HttpClient, client)),
  );
  return { delivery, requests };
};

describe("Effect HTTP telemetry delivery", () => {
  it("posts the bounded envelope with native session authority", async () => {
    const { delivery, requests } = fixture(
      Response.json({ acceptedRecords: 1 }),
      Effect.succeed("better-auth.session_token=signed"),
    );

    await expect(Effect.runPromise(delivery.send(envelope))).resolves.toEqual({
      status: "sent",
      accepted: 1,
    });
    expect(requests).toHaveLength(1);
    const request = requests[0];
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("https://studienbuch.test/api/observability/v1/telemetry");
    expect(request?.headers.cookie).toBe("better-auth.session_token=signed");
    expect(request?.headers["content-type"]).toBe("application/json");
    expect(request?.body._tag).toBe("Uint8Array");
    if (request?.body._tag === "Uint8Array") {
      expect(JSON.parse(new TextDecoder().decode(request.body.body))).toEqual(envelope);
    }
  });

  it("does not send without valid native session authority", async () => {
    const { delivery, requests } = fixture(
      Response.json({ acceptedRecords: 1 }),
      Effect.as(Effect.void, undefined),
    );

    await expect(Effect.runPromise(delivery.send(envelope))).resolves.toEqual({
      status: "failed",
      reason: "Authenticated telemetry authority is unavailable",
    });
    expect(requests).toHaveLength(0);
  });

  it("keeps non-success statuses in the outbox retry contract", async () => {
    const { delivery } = fixture(Response.json({ error: "busy" }, { status: 503 }));

    await expect(Effect.runPromise(delivery.send(envelope))).resolves.toEqual({
      status: "failed",
      reason: "Telemetry ingress rejected the batch (503)",
    });
  });

  it("rejects acknowledgements larger than the submitted batch", async () => {
    const { delivery } = fixture(Response.json({ acceptedRecords: 2 }));

    await expect(Effect.runPromise(delivery.send(envelope))).resolves.toEqual({
      status: "failed",
      reason: "Telemetry ingress returned an invalid acknowledgement",
    });
  });
});
