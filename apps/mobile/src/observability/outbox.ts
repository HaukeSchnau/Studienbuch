import {
  ClientTelemetryRecord,
  type ClientTelemetryEnvelopeType,
  type ClientTelemetryRecordType,
} from "@stu/observability/browser";
import { Option, Schema } from "effect";

export const OUTBOX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
export const OUTBOX_MAX_BYTES = 10 * 1024 * 1024;

export type TelemetryPriority = "low" | "normal" | "high";

export interface TelemetryClock {
  readonly now: () => number;
}

export interface TelemetryRandom {
  readonly next: () => number;
}

export interface TelemetryStorage {
  readonly read: () => Promise<string | undefined>;
  readonly write: (snapshot: string) => Promise<void>;
}

export interface TelemetryTransport {
  readonly send: (
    envelope: ClientTelemetryEnvelopeType,
  ) => Promise<
    | { readonly status: "sent"; readonly accepted: number }
    | { readonly status: "failed"; readonly reason: string }
  >;
}

interface StoredRecord {
  readonly id: string;
  readonly priority: TelemetryPriority;
  readonly enqueuedAt: number;
  readonly attempts: number;
  readonly nextAttemptAt: number;
  readonly record: ClientTelemetryRecordType;
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
  readonly storage: TelemetryStorage;
  readonly transport: TelemetryTransport;
  readonly clock: TelemetryClock;
  readonly random: TelemetryRandom;
  readonly serviceVersion: string;
  readonly environment: "development" | "test" | "staging" | "production";
  readonly platform: "web" | "ios" | "android";
  readonly maxAgeMs?: number;
  readonly maxBytes?: number;
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
const TelemetryPrioritySchema = Schema.Literals(["low", "normal", "high"]);
const StoredRecordSchema = Schema.Struct({
  id: Schema.String.check(Schema.isMaxLength(64)),
  priority: TelemetryPrioritySchema,
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

const priorities = new Set<TelemetryPriority>(TelemetryPrioritySchema.literals);

const decodeSnapshot = (serialized: string | undefined): Snapshot => {
  if (serialized === undefined) return emptySnapshot();
  try {
    const decoded = decodeSnapshotEnvelope(JSON.parse(serialized), exactContract);
    if (Option.isNone(decoded)) {
      return emptySnapshot();
    }
    const records: StoredRecord[] = [];
    let invalidRecords = 0;
    for (const persistedRecord of decoded.value.records) {
      const record = decodeStoredRecord(persistedRecord, exactContract);
      if (Option.isSome(record)) {
        records.push(record.value);
      } else {
        invalidRecords += 1;
      }
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

export class TelemetryOutbox {
  readonly #options: TelemetryOutboxOptions;
  #snapshot = emptySnapshot();
  #ready: Promise<void>;
  #operation: Promise<void> = Promise.resolve();

  constructor(options: TelemetryOutboxOptions) {
    this.#options = options;
    this.#ready = this.#load();
  }

  async #load(): Promise<void> {
    const stored = await this.#options.storage.read();
    this.#snapshot = decodeSnapshot(stored);
    const changed = this.#pruneExpired();
    if (changed || (stored !== undefined && stored !== JSON.stringify(this.#snapshot))) {
      await this.#persist();
    }
  }

  #serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#operation.then(async () => {
      await this.#ready;
      return operation();
    });
    this.#operation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #pruneExpired(): boolean {
    const cutoff = this.#options.clock.now() - (this.#options.maxAgeMs ?? OUTBOX_MAX_AGE_MS);
    const retained = this.#snapshot.records.filter((entry) => entry.enqueuedAt >= cutoff);
    const removed = this.#snapshot.records.length - retained.length;
    if (removed === 0) return false;
    this.#snapshot = {
      ...this.#snapshot,
      records: retained,
      dropped: this.#snapshot.dropped + removed,
    };
    return true;
  }

  #enforceCapacity(): void {
    const maxBytes = this.#options.maxBytes ?? OUTBOX_MAX_BYTES;
    for (const priority of evictionOrder) {
      while (snapshotBytes(this.#snapshot) > maxBytes) {
        const index = this.#snapshot.records.findIndex((entry) => entry.priority === priority);
        if (index === -1) break;
        const records = [...this.#snapshot.records];
        records.splice(index, 1);
        this.#snapshot = { ...this.#snapshot, records, dropped: this.#snapshot.dropped + 1 };
      }
    }
  }

  #persist(): Promise<void> {
    return this.#options.storage.write(JSON.stringify(this.#snapshot));
  }

  enqueue(
    record: ClientTelemetryRecordType,
    priority: TelemetryPriority = "normal",
  ): Promise<boolean> {
    return this.#serial(async () => {
      if (
        Option.isNone(decodeTelemetryRecord(record, exactContract)) ||
        !priorities.has(priority)
      ) {
        return false;
      }
      this.#pruneExpired();
      const sequence = this.#snapshot.sequence + 1;
      const now = this.#options.clock.now();
      this.#snapshot = {
        ...this.#snapshot,
        sequence,
        records: [
          ...this.#snapshot.records,
          {
            id: `${now.toString(36)}-${sequence.toString(36)}`,
            priority,
            enqueuedAt: now,
            attempts: 0,
            nextAttemptAt: now,
            record,
          },
        ],
      };
      this.#enforceCapacity();
      await this.#persist();
      return true;
    });
  }

  stats(): Promise<OutboxStats> {
    return this.#serial(async () => {
      const changed = this.#pruneExpired();
      if (changed) await this.#persist();
      return {
        depth: this.#snapshot.records.length,
        bytes: snapshotBytes(this.#snapshot),
        dropped: this.#snapshot.dropped,
      };
    });
  }

  flush(online: boolean): Promise<FlushResult> {
    return this.#serial(async () => {
      const pruned = this.#pruneExpired();
      if (pruned) await this.#persist();
      if (!online) {
        return { status: "offline", accepted: 0, remaining: this.#snapshot.records.length };
      }
      if (this.#snapshot.records.length === 0) {
        return { status: "empty", accepted: 0, remaining: 0 };
      }

      const now = this.#options.clock.now();
      const eligible = this.#snapshot.records
        .filter((entry) => entry.nextAttemptAt <= now)
        .slice(0, 98);
      if (eligible.length === 0) {
        return { status: "backoff", accepted: 0, remaining: this.#snapshot.records.length };
      }

      const records: ClientTelemetryRecordType[] = [
        ...eligible.map((entry) => entry.record),
        {
          type: "metric",
          name: "studienbuch_client_outbox_depth",
          kind: "gauge",
          value: this.#snapshot.records.length,
          recordedAtUnixMillis: now,
          attributes: { platform: this.#options.platform, signal: "all" },
        },
        {
          type: "metric",
          name: "studienbuch_client_outbox_dropped_total",
          kind: "counter",
          value: this.#snapshot.dropped,
          recordedAtUnixMillis: now,
          attributes: { platform: this.#options.platform, signal: "all" },
        },
      ];
      const envelope: ClientTelemetryEnvelopeType = {
        schemaVersion: 1,
        serviceName: "studienbuch-mobile",
        serviceVersion: this.#options.serviceVersion,
        environment: this.#options.environment,
        sentAtUnixMillis: now,
        records,
      };

      try {
        const delivery = await this.#options.transport.send(envelope);
        if (delivery.status === "failed") return this.#recordFailedAttempt(eligible, now);
        const acceptedTotal = Math.max(0, Math.min(records.length, delivery.accepted));
        const accepted = Math.min(eligible.length, acceptedTotal);
        const acceptedIds = new Set(eligible.slice(0, accepted).map((entry) => entry.id));
        const attemptedIds = new Set(eligible.slice(accepted).map((entry) => entry.id));
        const nextRecords = this.#snapshot.records
          .filter((entry) => !acceptedIds.has(entry.id))
          .map((entry) =>
            attemptedIds.has(entry.id)
              ? {
                  ...entry,
                  attempts: entry.attempts + 1,
                  nextAttemptAt: now + retryDelay(entry.attempts + 1, this.#options.random.next()),
                }
              : entry,
          );
        this.#snapshot = {
          ...this.#snapshot,
          records: nextRecords,
          dropped: acceptedTotal === records.length ? 0 : this.#snapshot.dropped,
        };
        await this.#persist();
        return { status: "sent", accepted, remaining: nextRecords.length };
      } catch {
        return this.#recordFailedAttempt(eligible, now);
      }
    });
  }

  async #recordFailedAttempt(
    eligible: ReadonlyArray<StoredRecord>,
    now: number,
  ): Promise<FlushResult> {
    const attemptedIds = new Set(eligible.map((entry) => entry.id));
    this.#snapshot = {
      ...this.#snapshot,
      records: this.#snapshot.records.map((entry) =>
        attemptedIds.has(entry.id)
          ? {
              ...entry,
              attempts: entry.attempts + 1,
              nextAttemptAt: now + retryDelay(entry.attempts + 1, this.#options.random.next()),
            }
          : entry,
      ),
    };
    await this.#persist();
    return { status: "failed", accepted: 0, remaining: this.#snapshot.records.length };
  }
}
