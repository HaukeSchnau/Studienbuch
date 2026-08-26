import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Random from "effect/Random";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { TelemetryPriority } from "../opentelemetry/attributes.ts";
import {
  ClientTelemetryRecord,
  type ClientTelemetryEnvelope,
  clientMetricNames,
  type ServiceName,
} from "./envelope.ts";

export const OUTBOX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
export const OUTBOX_MAX_BYTES = 10 * 1024 * 1024;

/** Leaves room for the two self-report metrics added to every envelope. */
const maximumRecordsPerFlush = 98;

export type TelemetryPlatform = "web" | "ios" | "android";

export class TelemetryStorageError extends Schema.TaggedError<TelemetryStorageError>()(
  "TelemetryStorageError",
  {
    operation: Schema.Literals(["read", "write"]),
    reason: Schema.String,
  },
) {}

export class TelemetryStorage extends Context.Service<
  TelemetryStorage,
  {
    readonly read: Effect.Effect<string | undefined, TelemetryStorageError>;
    readonly write: (snapshot: string) => Effect.Effect<void, TelemetryStorageError>;
  }
>()("@stu/observability/client/outbox/TelemetryStorage") {}

export type TelemetryDeliveryResult =
  | { readonly status: "sent"; readonly accepted: number }
  | { readonly status: "failed"; readonly reason: string };

export class TelemetryDelivery extends Context.Service<
  TelemetryDelivery,
  {
    readonly send: (envelope: ClientTelemetryEnvelope) => Effect.Effect<TelemetryDeliveryResult>;
    /** Page teardown can report only whether the browser accepted the beacon. */
    readonly sendBeacon?: (envelope: ClientTelemetryEnvelope) => boolean;
  }
>()("@stu/observability/client/outbox/TelemetryDelivery") {}

interface StoredRecord {
  readonly id: string;
  readonly priority: TelemetryPriority;
  readonly enqueuedAt: number;
  readonly attempts: number;
  readonly nextAttemptAt: number;
  readonly record: ClientTelemetryRecord;
}

interface Snapshot {
  readonly version: 1;
  readonly sequence: number;
  readonly records: ReadonlyArray<StoredRecord>;
  readonly dropped: number;
}

export interface OutboxStats {
  readonly depth: number;
  readonly bytes: number;
  readonly dropped: number;
}

export interface FlushResult {
  readonly status: "empty" | "offline" | "backoff" | "sent" | "failed";
  readonly accepted: number;
  readonly remaining: number;
}

export interface TelemetryOutboxOptions {
  readonly serviceName: ServiceName;
  readonly serviceVersion: string;
  readonly instanceId?: string;
  readonly environment: "development" | "test" | "staging" | "production";
  readonly platform: TelemetryPlatform;
  readonly maxAgeMs?: number;
  readonly maxBytes?: number;
  readonly maxRecords?: number;
}

export class TelemetryOutbox extends Context.Service<
  TelemetryOutbox,
  {
    readonly enqueue: (
      record: ClientTelemetryRecord,
      priority?: TelemetryPriority,
    ) => Effect.Effect<boolean, TelemetryStorageError>;
    readonly stats: Effect.Effect<OutboxStats, TelemetryStorageError>;
    readonly flush: (options?: {
      readonly online?: boolean;
      readonly preferBeacon?: boolean;
    }) => Effect.Effect<FlushResult, TelemetryStorageError>;
  }
>()("@stu/observability/client/outbox/TelemetryOutbox") {}

/** Non-durable storage for a browser tab or a focused test. */
export function memoryTelemetryStorage(): TelemetryStorage["Service"] {
  let contents: string | undefined;
  return TelemetryStorage.of({
    read: Effect.sync(() => contents),
    write: (snapshot) =>
      Effect.sync(() => {
        contents = snapshot;
      }),
  });
}

const emptySnapshot = (): Snapshot => ({ version: 1, sequence: 0, records: [], dropped: 0 });

const utf8Bytes = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
};

const snapshotBytes = (snapshot: Snapshot): number => utf8Bytes(JSON.stringify(snapshot));

const SafeInteger = Schema.Finite.check(Schema.isInt());
const StoredRecordSchema = Schema.Struct({
  id: Schema.String.check(Schema.isMaxLength(64)),
  priority: TelemetryPriority,
  enqueuedAt: SafeInteger,
  attempts: SafeInteger,
  nextAttemptAt: SafeInteger,
  record: ClientTelemetryRecord,
});
const SnapshotEnvelopeSchema = Schema.Struct({
  version: Schema.Literal(1),
  sequence: SafeInteger,
  records: Schema.Array(Schema.Unknown),
  dropped: Schema.Finite,
});
const decodeTelemetryRecord = Schema.decodeUnknownOption(ClientTelemetryRecord);
const decodeStoredRecord = Schema.decodeUnknownOption(StoredRecordSchema);
const decodeSnapshotEnvelope = Schema.decodeUnknownOption(SnapshotEnvelopeSchema);
const exactContract = { onExcessProperty: "error" } as const;
const priorities = new Set<TelemetryPriority>(TelemetryPriority.literals);

const decodeSnapshot = (serialized: string | undefined): Snapshot => {
  if (serialized === undefined) return emptySnapshot();
  try {
    const decoded = decodeSnapshotEnvelope(JSON.parse(serialized), exactContract);
    if (Option.isNone(decoded)) return emptySnapshot();

    const records: StoredRecord[] = [];
    let invalidRecords = 0;
    for (const persistedRecord of decoded.value.records) {
      const record = decodeStoredRecord(persistedRecord, exactContract);
      if (Option.isSome(record)) records.push(record.value);
      else invalidRecords += 1;
    }
    return {
      version: 1,
      sequence: decoded.value.sequence,
      records,
      dropped: Math.max(0, decoded.value.dropped) + invalidRecords,
    };
  } catch {
    return emptySnapshot();
  }
};

const retryDelay = (attempt: number, random: number): number => {
  const base = Math.min(5 * 60_000, 1_000 * 2 ** Math.min(attempt, 8));
  const boundedRandom = Math.min(1, Math.max(0, random));
  return Math.floor(base * (0.8 + boundedRandom * 0.4));
};

const evictionOrder: ReadonlyArray<TelemetryPriority> = ["low", "normal", "high"];

const pruneExpired = (snapshot: Snapshot, now: number, maxAgeMs: number) => {
  const retained = snapshot.records.filter((entry) => entry.enqueuedAt >= now - maxAgeMs);
  const removed = snapshot.records.length - retained.length;
  return removed === 0
    ? { changed: false as const, snapshot }
    : {
        changed: true as const,
        snapshot: { ...snapshot, records: retained, dropped: snapshot.dropped + removed },
      };
};

const enforceCapacity = (
  initial: Snapshot,
  options: Pick<TelemetryOutboxOptions, "maxBytes" | "maxRecords">,
): Snapshot => {
  const overCapacity = (snapshot: Snapshot) =>
    snapshotBytes(snapshot) > (options.maxBytes ?? OUTBOX_MAX_BYTES) ||
    (options.maxRecords !== undefined && snapshot.records.length > options.maxRecords);
  const evict = (snapshot: Snapshot, priorityIndex: number): Snapshot => {
    if (!overCapacity(snapshot) || priorityIndex >= evictionOrder.length) return snapshot;
    const priority = evictionOrder[priorityIndex];
    const index = snapshot.records.findIndex((entry) => entry.priority === priority);
    if (index === -1) return evict(snapshot, priorityIndex + 1);
    const records = snapshot.records.filter((_, recordIndex) => recordIndex !== index);
    return evict({ ...snapshot, records, dropped: snapshot.dropped + 1 }, priorityIndex);
  };
  return evict(initial, 0);
};

const markAttempts = (
  snapshot: Snapshot,
  attemptedIds: ReadonlySet<string>,
  now: number,
  random: (typeof Random.Random)["Service"],
): Effect.Effect<Snapshot> =>
  Effect.forEach(snapshot.records, (entry) =>
    attemptedIds.has(entry.id)
      ? Effect.sync(() => random.nextDoubleUnsafe()).pipe(
          Effect.map((random) => ({
            ...entry,
            attempts: entry.attempts + 1,
            nextAttemptAt: now + retryDelay(entry.attempts + 1, random),
          })),
        )
      : Effect.succeed(entry),
  ).pipe(Effect.map((records) => ({ ...snapshot, records })));

/** Builds the shared outbox with Effect-owned state, time, randomness and serialization. */
export const makeTelemetryOutbox = (
  options: TelemetryOutboxOptions,
): Effect.Effect<
  TelemetryOutbox["Service"],
  TelemetryStorageError,
  TelemetryDelivery | TelemetryStorage
> =>
  Effect.gen(function* () {
    const storage = yield* TelemetryStorage;
    const delivery = yield* TelemetryDelivery;
    const clock = yield* Clock.Clock;
    const random = yield* Random.Random;
    const serialized = yield* Semaphore.make(1);
    const stored = yield* storage.read.pipe(
      Effect.catchTag("TelemetryStorageError", (error) =>
        Effect.logWarning(
          "Telemetry storage could not be read; starting with an empty outbox",
        ).pipe(Effect.annotateLogs({ operation: error.operation }), Effect.as(undefined)),
      ),
    );
    const now = yield* clock.currentTimeMillis;
    const loaded = pruneExpired(decodeSnapshot(stored), now, options.maxAgeMs ?? OUTBOX_MAX_AGE_MS);
    if (loaded.changed || (stored !== undefined && stored !== JSON.stringify(loaded.snapshot))) {
      yield* storage.write(JSON.stringify(loaded.snapshot));
    }
    const state = yield* Ref.make(loaded.snapshot);

    const commit = (snapshot: Snapshot) =>
      storage.write(JSON.stringify(snapshot)).pipe(Effect.andThen(Ref.set(state, snapshot)));

    const withLock = <A>(effect: Effect.Effect<A, TelemetryStorageError>) =>
      serialized.withPermits(1)(effect);

    const pruneCurrent = Effect.gen(function* () {
      const current = yield* Ref.get(state);
      const currentTime = yield* clock.currentTimeMillis;
      const pruned = pruneExpired(current, currentTime, options.maxAgeMs ?? OUTBOX_MAX_AGE_MS);
      if (pruned.changed) yield* commit(pruned.snapshot);
      return pruned.snapshot;
    });

    const recordFailedAttempt = (
      snapshot: Snapshot,
      eligible: ReadonlyArray<StoredRecord>,
      failedAt: number,
    ) =>
      markAttempts(snapshot, new Set(eligible.map((entry) => entry.id)), failedAt, random).pipe(
        Effect.tap(commit),
        Effect.map((next) => ({
          status: "failed" as const,
          accepted: 0,
          remaining: next.records.length,
        })),
      );

    return TelemetryOutbox.of({
      enqueue: (record, priority = "normal") =>
        withLock(
          Effect.gen(function* () {
            if (
              Option.isNone(decodeTelemetryRecord(record, exactContract)) ||
              !priorities.has(priority)
            ) {
              return false;
            }
            const current = yield* pruneCurrent;
            const enqueuedAt = yield* clock.currentTimeMillis;
            const sequence = current.sequence + 1;
            const next = enforceCapacity(
              {
                ...current,
                sequence,
                records: [
                  ...current.records,
                  {
                    id: `${enqueuedAt.toString(36)}-${sequence.toString(36)}`,
                    priority,
                    enqueuedAt,
                    attempts: 0,
                    nextAttemptAt: enqueuedAt,
                    record,
                  },
                ],
              },
              options,
            );
            yield* commit(next);
            return true;
          }),
        ),
      stats: withLock(
        pruneCurrent.pipe(
          Effect.map((snapshot) => ({
            depth: snapshot.records.length,
            bytes: snapshotBytes(snapshot),
            dropped: snapshot.dropped,
          })),
        ),
      ),
      flush: (flushOptions) =>
        withLock(
          Effect.gen(function* () {
            const snapshot = yield* pruneCurrent;
            if (flushOptions?.online === false) {
              return {
                status: "offline" as const,
                accepted: 0,
                remaining: snapshot.records.length,
              };
            }
            if (snapshot.records.length === 0) {
              return { status: "empty" as const, accepted: 0, remaining: 0 };
            }

            const attemptedAt = yield* clock.currentTimeMillis;
            const preferBeacon = flushOptions?.preferBeacon ?? false;
            const eligible = snapshot.records
              .filter((entry) => preferBeacon || entry.nextAttemptAt <= attemptedAt)
              .slice(0, maximumRecordsPerFlush);
            if (eligible.length === 0) {
              return {
                status: "backoff" as const,
                accepted: 0,
                remaining: snapshot.records.length,
              };
            }

            const records: ClientTelemetryRecord[] = [
              ...eligible.map((entry) => entry.record),
              {
                type: "metric",
                name: clientMetricNames.outboxDepth,
                kind: "gauge",
                value: snapshot.records.length,
                recordedAtUnixMillis: attemptedAt,
                attributes: { platform: options.platform, signal: "all" },
              },
              {
                type: "metric",
                name: clientMetricNames.outboxDropped,
                kind: "counter",
                value: snapshot.dropped,
                recordedAtUnixMillis: attemptedAt,
                attributes: { platform: options.platform, signal: "all" },
              },
            ];
            const envelope: ClientTelemetryEnvelope = {
              schemaVersion: 1,
              serviceName: options.serviceName,
              serviceVersion: options.serviceVersion,
              instanceId: options.instanceId,
              environment: options.environment,
              sentAtUnixMillis: attemptedAt,
              records,
            };

            const beacon = preferBeacon ? delivery.sendBeacon : undefined;
            const result =
              beacon === undefined
                ? yield* delivery.send(envelope)
                : beacon(envelope)
                  ? ({ status: "sent", accepted: records.length } as const)
                  : ({ status: "failed", reason: "beacon rejected" } as const);
            if (result.status === "failed") {
              return yield* recordFailedAttempt(snapshot, eligible, attemptedAt);
            }

            const acceptedTotal = Math.max(0, Math.min(records.length, result.accepted));
            const accepted = Math.min(eligible.length, acceptedTotal);
            const acceptedIds = new Set(eligible.slice(0, accepted).map((entry) => entry.id));
            const unacceptedIds = new Set(eligible.slice(accepted).map((entry) => entry.id));
            const retained = {
              ...snapshot,
              records: snapshot.records.filter((entry) => !acceptedIds.has(entry.id)),
              dropped: acceptedTotal === records.length ? 0 : snapshot.dropped,
            };
            const next = yield* markAttempts(retained, unacceptedIds, attemptedAt, random);
            yield* commit(next);
            return { status: "sent" as const, accepted, remaining: next.records.length };
          }),
        ),
    });
  });

export const telemetryOutboxLayer = (
  options: TelemetryOutboxOptions,
): Layer.Layer<TelemetryOutbox, TelemetryStorageError, TelemetryDelivery | TelemetryStorage> =>
  Layer.effect(TelemetryOutbox, makeTelemetryOutbox(options));
