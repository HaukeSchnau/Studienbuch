import { describe, expect, it } from "vite-plus/test";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Random from "effect/Random";
import type { ClientTelemetryEnvelope, ClientTelemetryRecord } from "./envelope.ts";
import {
  OUTBOX_MAX_AGE_MS,
  TelemetryDelivery,
  TelemetryOutbox,
  TelemetryStorage,
  memoryTelemetryStorage,
  telemetryOutboxLayer,
  type TelemetryDeliveryResult,
} from "./outbox.ts";

class MemoryStorage {
  value: string | undefined;

  readonly service = TelemetryStorage.of({
    read: Effect.sync(() => this.value),
    write: (value) =>
      Effect.sync(() => {
        this.value = value;
      }),
  });
}

interface TestDelivery {
  readonly send: (envelope: ClientTelemetryEnvelope) => Promise<TelemetryDeliveryResult>;
  readonly sendBeacon?: (envelope: ClientTelemetryEnvelope) => boolean;
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
  storage?: MemoryStorage | TelemetryStorage["Service"];
  delivery?: TestDelivery;
  initialNow?: number;
  maxBytes?: number;
  maxRecords?: number;
}) => {
  let now = overrides?.initialNow ?? 1_800_000_000_000;
  const storage = overrides?.storage ?? new MemoryStorage();
  const storageService = storage instanceof MemoryStorage ? storage.service : storage;
  const envelopes: ClientTelemetryEnvelope[] = [];
  const delivery =
    overrides?.delivery ??
    ({
      send: async (envelope: ClientTelemetryEnvelope) => {
        envelopes.push(envelope);
        return { status: "sent", accepted: envelope.records.length } as const;
      },
    } satisfies TestDelivery);
  const clock: Clock.Clock = {
    currentTimeMillisUnsafe: () => now,
    currentTimeMillis: Effect.sync(() => now),
    currentTimeNanosUnsafe: () => BigInt(now) * 1_000_000n,
    currentTimeNanos: Effect.sync(() => BigInt(now) * 1_000_000n),
    monotonicTimeNanosUnsafe: () => BigInt(now) * 1_000_000n,
    monotonicTimeNanos: Effect.sync(() => BigInt(now) * 1_000_000n),
    sleep: () => Effect.void,
  };
  const runtime = ManagedRuntime.make(
    telemetryOutboxLayer({
      serviceName: "studienbuch-mobile",
      serviceVersion: "test",
      environment: "test",
      platform: "ios",
      maxBytes: overrides?.maxBytes,
      maxRecords: overrides?.maxRecords,
    }).pipe(
      Layer.provide([
        Layer.succeed(Clock.Clock, clock),
        Layer.succeed(Random.Random, { nextDoubleUnsafe: () => 0.5, nextIntUnsafe: () => 1 }),
        Layer.succeed(TelemetryStorage, storageService),
        Layer.succeed(
          TelemetryDelivery,
          TelemetryDelivery.of({
            send: (envelope) => Effect.promise(() => delivery.send(envelope)),
            sendBeacon: delivery.sendBeacon,
          }),
        ),
      ]),
    ),
  );
  const run = <A, E>(use: (service: TelemetryOutbox["Service"]) => Effect.Effect<A, E>) =>
    runtime.runPromise(Effect.flatMap(TelemetryOutbox, use));
  const outbox = {
    enqueue: (record: ClientTelemetryRecord, priority?: "low" | "normal" | "high") =>
      run((service) => service.enqueue(record, priority)),
    stats: () => run((service) => service.stats),
    flush: (options?: { readonly online?: boolean; readonly preferBeacon?: boolean }) =>
      run((service) => service.flush(options)),
  };
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

    const restarted = setup({ storage: first.storage, initialNow: first.now() });
    expect(await restarted.outbox.stats()).toMatchObject({ depth: 0, dropped: 1 });
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
    const test = setup({
      storage: memoryTelemetryStorage(),
      delivery: { send: async () => ({ status: "sent", accepted: 3 }) },
    });
    await test.outbox.enqueue(metric(1, 1_800_000_000_000));

    expect(await test.outbox.flush()).toMatchObject({ status: "sent", remaining: 0 });
  });
});
