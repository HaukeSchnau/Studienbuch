import { describe, expect, it } from "vite-plus/test";
import type { ClientTelemetryEnvelope, ClientTelemetryRecord } from "./client-envelope.ts";
import {
  OUTBOX_MAX_AGE_MS,
  TelemetryOutbox,
  memoryTelemetryStorage,
  type TelemetryDelivery,
  type TelemetryStorage,
} from "./outbox.ts";

class MemoryStorage implements TelemetryStorage {
  value: string | undefined;
  read = async () => this.value;
  write = async (value: string) => {
    this.value = value;
  };
}

const metric = (value: number, recordedAtUnixMillis: number): ClientTelemetryRecord => ({
  type: "metric",
  name: "studienbuch_client_canary_total",
  kind: "counter",
  value,
  recordedAtUnixMillis,
  attributes: { platform: "ios", signal: "all" },
});

const setup = (overrides?: {
  storage?: MemoryStorage;
  delivery?: TelemetryDelivery;
  maxBytes?: number;
  maxRecords?: number;
}) => {
  let now = 1_800_000_000_000;
  const storage = overrides?.storage ?? new MemoryStorage();
  const envelopes: ClientTelemetryEnvelope[] = [];
  const delivery =
    overrides?.delivery ??
    ({
      send: async (envelope: ClientTelemetryEnvelope) => {
        envelopes.push(envelope);
        return { status: "sent", accepted: envelope.records.length } as const;
      },
    } satisfies TelemetryDelivery);
  const outbox = new TelemetryOutbox({
    storage,
    delivery,
    clock: { now: () => now },
    random: { next: () => 0.5 },
    serviceName: "studienbuch-mobile",
    serviceVersion: "test",
    environment: "test",
    platform: "ios",
    maxBytes: overrides?.maxBytes,
    maxRecords: overrides?.maxRecords,
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

  it("does not invoke delivery while offline", async () => {
    let sends = 0;
    const test = setup({
      delivery: { send: async () => ({ status: "sent", accepted: (sends += 1) }) },
    });
    await test.outbox.enqueue(metric(1, test.now()));

    expect(await test.outbox.flush({ online: false })).toMatchObject({
      status: "offline",
      remaining: 1,
    });
    expect(sends).toBe(0);
  });

  it("expires records after seven days across restart", async () => {
    const first = setup();
    await first.outbox.enqueue(metric(1, first.now()));
    first.advance(OUTBOX_MAX_AGE_MS + 1);

    const restarted = new TelemetryOutbox({
      storage: first.storage,
      delivery: { send: async () => ({ status: "sent", accepted: 0 }) },
      clock: { now: first.now },
      random: { next: () => 0.5 },
      serviceName: "studienbuch-mobile",
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

    await test.outbox.flush();
    const values = test.envelopes[0]?.records.flatMap((record) =>
      record.type === "metric" && record.name === "studienbuch_client_canary_total"
        ? [record.value]
        : [],
    );
    expect(values).toContain(2);
    expect(values).not.toContain(1);
    expect((await test.outbox.stats()).dropped).toBe(0);
  });

  it("bounds the queue by record count for clients that cannot persist", async () => {
    const test = setup({ maxRecords: 2 });
    await test.outbox.enqueue(metric(1, test.now()), "low");
    test.advance(1);
    await test.outbox.enqueue(metric(2, test.now()), "low");
    test.advance(1);
    await test.outbox.enqueue(metric(3, test.now()), "low");

    expect(await test.outbox.stats()).toMatchObject({ depth: 2, dropped: 1 });
  });

  it("retains a partially accepted suffix and applies backoff", async () => {
    let sends = 0;
    const test = setup({
      delivery: {
        send: async () => {
          sends += 1;
          return { status: "sent", accepted: 1 } as const;
        },
      },
    });
    await test.outbox.enqueue(metric(1, test.now()));
    await test.outbox.enqueue(metric(2, test.now()));
    await test.outbox.enqueue(metric(3, test.now()));

    expect(await test.outbox.flush()).toMatchObject({
      status: "sent",
      accepted: 1,
      remaining: 2,
    });
    expect(await test.outbox.flush()).toMatchObject({ status: "backoff", remaining: 2 });
    expect(sends).toBe(1);
    test.advance(2_000);
    expect(await test.outbox.flush()).toMatchObject({ status: "sent", accepted: 1 });
  });

  it("persists delivery failures and emits bounded self-metrics", async () => {
    const storage = new MemoryStorage();
    const failed = setup({
      storage,
      delivery: { send: async () => ({ status: "failed", reason: "down" }) },
    });
    await failed.outbox.enqueue(metric(1, failed.now()));
    expect(await failed.outbox.flush()).toMatchObject({ status: "failed", remaining: 1 });

    failed.advance(2_000);
    const recovered = setup({ storage });
    // The restarted clock begins before the saved retry time, so advance it too.
    recovered.advance(2_000);
    await recovered.outbox.flush();
    const names = recovered.envelopes[0]?.records.map((record) =>
      record.type === "metric" ? record.name : undefined,
    );
    expect(names).toContain("studienbuch_client_outbox_depth");
    expect(names).toContain("studienbuch_client_outbox_dropped_total");
  });

  it("ignores backoff for a teardown beacon, since there is no later attempt", async () => {
    const beaconed: ClientTelemetryEnvelope[] = [];
    const test = setup({
      delivery: {
        send: async () => ({ status: "failed", reason: "down" }),
        sendBeacon: (envelope) => {
          beaconed.push(envelope);
          return true;
        },
      },
    });
    await test.outbox.enqueue(metric(1, test.now()));
    expect(await test.outbox.flush()).toMatchObject({ status: "failed" });
    // Backoff would normally suppress this attempt entirely.
    expect(await test.outbox.flush()).toMatchObject({ status: "backoff" });

    expect(await test.outbox.flush({ preferBeacon: true })).toMatchObject({ status: "sent" });
    expect(beaconed).toHaveLength(1);
    expect(await test.outbox.stats()).toMatchObject({ depth: 0 });
  });

  it("keeps records queued when a beacon is refused", async () => {
    const test = setup({
      delivery: {
        send: async () => ({ status: "sent", accepted: 1 }),
        sendBeacon: () => false,
      },
    });
    await test.outbox.enqueue(metric(1, test.now()));

    expect(await test.outbox.flush({ preferBeacon: true })).toMatchObject({ status: "failed" });
    expect(await test.outbox.stats()).toMatchObject({ depth: 1 });
  });

  it("keeps non-durable storage behind the same contract", async () => {
    const outbox = new TelemetryOutbox({
      storage: memoryTelemetryStorage(),
      delivery: { send: async () => ({ status: "sent", accepted: 3 }) },
      clock: { now: () => 1_800_000_000_000 },
      random: { next: () => 0.5 },
      serviceName: "studienbuch-web-client",
      serviceVersion: "test",
      environment: "test",
      platform: "web",
    });
    await outbox.enqueue(metric(1, 1_800_000_000_000));

    expect(await outbox.flush()).toMatchObject({ status: "sent", remaining: 0 });
  });
});
