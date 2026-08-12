import { describe, expect, it } from "vite-plus/test";
import type {
  ClientTelemetryEnvelopeType,
  ClientTelemetryRecordType,
} from "@stu/observability/browser";
import {
  OUTBOX_MAX_AGE_MS,
  TelemetryOutbox,
  type TelemetryStorage,
  type TelemetryTransport,
} from "./outbox";

class MemoryStorage implements TelemetryStorage {
  value: string | undefined;
  read = async () => this.value;
  write = async (value: string) => {
    this.value = value;
  };
}

const metric = (value: number, recordedAtUnixMillis: number): ClientTelemetryRecordType => ({
  type: "metric",
  name: "studienbuch_client_canary_total",
  kind: "counter",
  value,
  recordedAtUnixMillis,
  attributes: { platform: "ios", signal: "all" },
});

const setup = (overrides?: {
  storage?: MemoryStorage;
  transport?: TelemetryTransport;
  maxBytes?: number;
}) => {
  let now = 1_800_000_000_000;
  const storage = overrides?.storage ?? new MemoryStorage();
  const envelopes: ClientTelemetryEnvelopeType[] = [];
  const transport =
    overrides?.transport ??
    ({
      send: async (envelope: ClientTelemetryEnvelopeType) => {
        envelopes.push(envelope);
        return envelope.records.length;
      },
    } satisfies TelemetryTransport);
  const outbox = new TelemetryOutbox({
    storage,
    transport,
    clock: { now: () => now },
    random: { next: () => 0.5 },
    serviceVersion: "test",
    environment: "test",
    platform: "ios",
    maxBytes: overrides?.maxBytes,
  });
  return {
    outbox,
    storage,
    envelopes,
    now: () => now,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
};

describe("TelemetryOutbox", () => {
  it("survives a process restart", async () => {
    const first = setup();
    await first.outbox.enqueue(metric(1, first.now()));

    const second = setup({ storage: first.storage });
    expect(await second.outbox.stats()).toMatchObject({ depth: 1, dropped: 0 });
  });

  it("rejects persisted records containing non-contract fields", async () => {
    const storage = new MemoryStorage();
    storage.value = JSON.stringify({
      version: 1,
      sequence: 1,
      dropped: 0,
      records: [
        {
          id: "unsafe",
          priority: "normal",
          enqueuedAt: 1_800_000_000_000,
          attempts: 0,
          nextAttemptAt: 1_800_000_000_000,
          record: {
            ...metric(1, 1_800_000_000_000),
            studentFreeText: "must never leave the device",
          },
        },
      ],
    });

    expect(await setup({ storage }).outbox.stats()).toMatchObject({ depth: 0, dropped: 1 });
  });

  it("salvages valid persisted siblings while counting malformed records", async () => {
    const storage = new MemoryStorage();
    storage.value = JSON.stringify({
      version: 1,
      sequence: 2,
      dropped: 0,
      records: [
        {
          id: "valid",
          priority: "normal",
          enqueuedAt: 1_800_000_000_000,
          attempts: 0,
          nextAttemptAt: 1_800_000_000_000,
          record: metric(1, 1_800_000_000_000),
        },
        {
          id: "invalid",
          priority: "normal",
          enqueuedAt: 1_800_000_000_000,
          attempts: 0,
          nextAttemptAt: 1_800_000_000_000,
          record: { ...metric(2, 1_800_000_000_000), studentFreeText: "must stay local" },
        },
      ],
    });

    expect(await setup({ storage }).outbox.stats()).toMatchObject({ depth: 1, dropped: 1 });
  });

  it("does not invoke transport while offline", async () => {
    let sends = 0;
    const test = setup({
      transport: { send: async () => (sends += 1) },
    });
    await test.outbox.enqueue(metric(1, test.now()));

    expect(await test.outbox.flush(false)).toMatchObject({ status: "offline", remaining: 1 });
    expect(sends).toBe(0);
  });

  it("expires records after seven days across restart", async () => {
    const first = setup();
    await first.outbox.enqueue(metric(1, first.now()));
    first.advance(OUTBOX_MAX_AGE_MS + 1);

    const restarted = new TelemetryOutbox({
      storage: first.storage,
      transport: { send: async () => 0 },
      clock: { now: first.now },
      random: { next: () => 0.5 },
      serviceVersion: "test",
      environment: "test",
      platform: "ios",
    });
    expect(await restarted.stats()).toMatchObject({ depth: 0, dropped: 1 });
  });

  it("evicts oldest low-priority records before high-priority records", async () => {
    const test = setup({ maxBytes: 620 });
    await test.outbox.enqueue(metric(1, test.now()), "low");
    test.advance(1);
    await test.outbox.enqueue(metric(2, test.now()), "high");
    test.advance(1);
    await test.outbox.enqueue(metric(3, test.now()), "low");

    await test.outbox.flush(true);
    const values = test.envelopes[0]?.records.flatMap((record) =>
      record.type === "metric" && record.name === "studienbuch_client_canary_total"
        ? [record.value]
        : [],
    );
    expect(values).toContain(2);
    expect(values).not.toContain(1);
    expect((await test.outbox.stats()).dropped).toBe(0);
  });

  it("retains a partially accepted suffix and applies backoff", async () => {
    let sends = 0;
    const test = setup({
      transport: {
        send: async () => {
          sends += 1;
          return 1;
        },
      },
    });
    await test.outbox.enqueue(metric(1, test.now()));
    await test.outbox.enqueue(metric(2, test.now()));
    await test.outbox.enqueue(metric(3, test.now()));

    expect(await test.outbox.flush(true)).toMatchObject({
      status: "sent",
      accepted: 1,
      remaining: 2,
    });
    expect(await test.outbox.flush(true)).toMatchObject({ status: "backoff", remaining: 2 });
    expect(sends).toBe(1);
    test.advance(2_000);
    expect(await test.outbox.flush(true)).toMatchObject({ status: "sent", accepted: 1 });
  });

  it("persists transport failures and emits bounded self-metrics", async () => {
    const storage = new MemoryStorage();
    const failed = setup({
      storage,
      transport: { send: async () => Promise.reject(new Error("down")) },
    });
    await failed.outbox.enqueue(metric(1, failed.now()));
    expect(await failed.outbox.flush(true)).toMatchObject({ status: "failed", remaining: 1 });

    failed.advance(2_000);
    const recovered = setup({ storage });
    // The restarted clock begins before the saved retry time, so advance it too.
    recovered.advance(2_000);
    await recovered.outbox.flush(true);
    const names = recovered.envelopes[0]?.records.map((record) =>
      record.type === "metric" ? record.name : undefined,
    );
    expect(names).toContain("studienbuch_client_outbox_depth");
    expect(names).toContain("studienbuch_client_outbox_dropped_total");
  });
});
