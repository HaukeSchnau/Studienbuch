import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { describe, expect, it } from "vite-plus/test";
import { outcomeFromExit, resourceAttributes } from "../src/index.ts";
import {
  ClientTelemetryEnvelope,
  decodeClientTelemetryEnvelope,
  externalSpanFromHeaders,
} from "../src/browser.ts";

const validEnvelope = {
  schemaVersion: 1,
  serviceName: "studienbuch-web-client",
  serviceVersion: "2026.08.12",
  environment: "test",
  sentAtUnixMillis: 1_786_483_200_000,
  records: [
    {
      type: "span",
      name: "client.navigation",
      traceId: "0123456789abcdef0123456789abcdef",
      spanId: "0123456789abcdef",
      startedAtUnixMillis: 1_786_483_200_000,
      durationMillis: 12,
      status: "ok",
      attributes: {
        "app.operation": "navigation",
        "http.route": "/",
        outcome: "success",
      },
    },
  ],
} as const;

describe("client telemetry envelope", () => {
  it("accepts the bounded allowlisted contract", async () => {
    const decoded = await Effect.runPromise(decodeClientTelemetryEnvelope(validEnvelope));
    expect(decoded).toEqual(validEnvelope);
  });

  it("rejects forbidden attributes", async () => {
    const envelope = structuredClone(validEnvelope);
    Object.assign(envelope.records[0].attributes, { authorization: "Bearer secret" });

    const exit = await Effect.runPromiseExit(decodeClientTelemetryEnvelope(envelope));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects oversized batches and arbitrary metric names", async () => {
    const tooMany = {
      ...validEnvelope,
      records: Array.from({ length: 101 }, () => validEnvelope.records[0]),
    };
    const arbitraryMetric = {
      ...validEnvelope,
      records: [
        {
          type: "metric",
          name: "student_123_grade",
          kind: "counter",
          value: 1,
          recordedAtUnixMillis: 1_786_483_200_000,
          attributes: {},
        },
      ],
    };

    expect(
      Exit.isFailure(await Effect.runPromiseExit(decodeClientTelemetryEnvelope(tooMany))),
    ).toBe(true);
    expect(
      Exit.isFailure(await Effect.runPromiseExit(decodeClientTelemetryEnvelope(arbitraryMetric))),
    ).toBe(true);
  });

  it("exports a schema value that can be reused by server boundaries", () => {
    expect(ClientTelemetryEnvelope.ast).toBeDefined();
  });
});

describe("resource and trace policy", () => {
  it("uses the canonical resource vocabulary", () => {
    expect(
      resourceAttributes({
        serviceName: "studienbuch-server",
        serviceVersion: "release-1",
        environment: "production",
        instanceId: "instance-1",
      }),
    ).toEqual({
      "service.namespace": "studienbuch",
      "deployment.environment.name": "production",
      "service.instance.id": "instance-1",
    });
    expect(
      resourceAttributes({
        serviceName: "studienbuch-server",
        serviceVersion: "release-1",
        environment: "production",
      }),
    ).toEqual({
      "service.namespace": "studienbuch",
      "deployment.environment.name": "production",
    });
  });

  it("decodes valid W3C context and rejects malformed context", () => {
    const valid = externalSpanFromHeaders({
      traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
    });
    const malformed = externalSpanFromHeaders({ traceparent: "student-data" });

    expect(Option.isSome(valid)).toBe(true);
    if (Option.isSome(valid)) {
      expect(valid.value.traceId).toBe("0123456789abcdef0123456789abcdef");
      expect(valid.value.spanId).toBe("0123456789abcdef");
    }
    expect(Option.isNone(malformed)).toBe(true);
  });

  it("maps exits to bounded outcomes", () => {
    expect(outcomeFromExit(Exit.succeed(undefined))).toBe("success");
    expect(outcomeFromExit(Exit.fail("expected"))).toBe("failure");
  });
});
