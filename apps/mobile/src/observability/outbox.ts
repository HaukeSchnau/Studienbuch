import type {
  ClientTelemetryEnvelopeType,
  ClientTelemetryRecordType,
} from "@stu/observability/browser";

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
  readonly send: (envelope: ClientTelemetryEnvelopeType) => Promise<number>;
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

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const priorities = new Set<TelemetryPriority>(["low", "normal", "high"]);
const exactKeys = (value: Record<string, unknown>, allowed: ReadonlyArray<string>): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));
const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const isUnixMillis = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const isHex = (value: unknown, length: number): value is string =>
  typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
const clientAttributeValues: Readonly<Record<string, ReadonlySet<string>>> = {
  "app.operation": new Set(["navigation", "request", "render", "telemetry.flush"]),
  "error.type": new Set(["network", "timeout", "decode", "unknown"]),
  "http.method": new Set(["GET", "POST"]),
  "http.route": new Set(["/", "/api/observability/v1/telemetry"]),
  outcome: new Set(["success", "failure", "interrupt"]),
  "screen.name": new Set(["overview", "schedule", "tasks", "courses", "profile", "setup"]),
  "telemetry.priority": priorities,
};
const metricAttributeValues: Readonly<Record<string, ReadonlySet<string>>> = {
  operation: clientAttributeValues["app.operation"]!,
  outcome: clientAttributeValues.outcome!,
  platform: new Set(["web", "ios", "android"]),
  signal: new Set(["traces", "logs", "metrics", "all"]),
};
const hasAllowedAttributes = (
  value: unknown,
  allowed: Readonly<Record<string, ReadonlySet<string>>>,
): boolean =>
  isObject(value) &&
  Object.entries(value).every(
    ([key, attribute]) => allowed[key] !== undefined && allowed[key].has(attribute as string),
  );

const isTelemetryRecord = (value: unknown): value is ClientTelemetryRecordType => {
  if (!isObject(value)) return false;
  if (value.type === "span") {
    return (
      exactKeys(value, [
        "type",
        "name",
        "traceId",
        "spanId",
        "parentSpanId",
        "startedAtUnixMillis",
        "durationMillis",
        "status",
        "attributes",
      ]) &&
      new Set([
        "client.navigation",
        "client.request",
        "client.render",
        "client.telemetry.flush",
      ]).has(value.name as string) &&
      isHex(value.traceId, 32) &&
      isHex(value.spanId, 16) &&
      (value.parentSpanId === undefined || isHex(value.parentSpanId, 16)) &&
      isUnixMillis(value.startedAtUnixMillis) &&
      isFiniteNonNegative(value.durationMillis) &&
      new Set(["unset", "ok", "error"]).has(value.status as string) &&
      hasAllowedAttributes(value.attributes, clientAttributeValues)
    );
  }
  if (value.type === "log") {
    return (
      exactKeys(value, [
        "type",
        "event",
        "severity",
        "occurredAtUnixMillis",
        "traceId",
        "spanId",
        "attributes",
      ]) &&
      new Set(["client.request.failed", "client.telemetry.canary", "client.telemetry.dropped"]).has(
        value.event as string,
      ) &&
      new Set(["debug", "info", "warn", "error"]).has(value.severity as string) &&
      isUnixMillis(value.occurredAtUnixMillis) &&
      (value.traceId === undefined || isHex(value.traceId, 32)) &&
      (value.spanId === undefined || isHex(value.spanId, 16)) &&
      hasAllowedAttributes(value.attributes, clientAttributeValues)
    );
  }
  if (value.type === "metric") {
    return (
      exactKeys(value, ["type", "name", "kind", "value", "recordedAtUnixMillis", "attributes"]) &&
      new Set([
        "studienbuch_client_canary_total",
        "studienbuch_client_request_duration_ms",
        "studienbuch_client_outbox_depth",
        "studienbuch_client_outbox_dropped_total",
      ]).has(value.name as string) &&
      new Set(["counter", "gauge", "histogram"]).has(value.kind as string) &&
      isFiniteNonNegative(value.value) &&
      isUnixMillis(value.recordedAtUnixMillis) &&
      hasAllowedAttributes(value.attributes, metricAttributeValues)
    );
  }
  return false;
};

// Persisted state is an untrusted boundary. Be deliberately conservative: a
// malformed entry is discarded rather than ever being forwarded.
const isStoredRecord = (value: unknown): value is StoredRecord => {
  if (!isObject(value) || !isTelemetryRecord(value.record)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length <= 64 &&
    priorities.has(value.priority as TelemetryPriority) &&
    Number.isSafeInteger(value.enqueuedAt) &&
    Number.isSafeInteger(value.attempts) &&
    Number.isSafeInteger(value.nextAttemptAt)
  );
};

const decodeSnapshot = (serialized: string | undefined): Snapshot => {
  if (serialized === undefined) return emptySnapshot();
  try {
    const value: unknown = JSON.parse(serialized);
    if (
      !isObject(value) ||
      value.version !== 1 ||
      !Number.isSafeInteger(value.sequence) ||
      !Number.isFinite(value.dropped) ||
      !Array.isArray(value.records)
    ) {
      return emptySnapshot();
    }
    const records = value.records.filter(isStoredRecord);
    const invalidRecords = value.records.length - records.length;
    return {
      version: 1,
      sequence: value.sequence as number,
      records,
      dropped: Math.max(0, value.dropped as number) + invalidRecords,
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
  ): Promise<void> {
    return this.#serial(async () => {
      if (!isTelemetryRecord(record) || !priorities.has(priority)) {
        throw new TypeError("Telemetry record is outside the allowlisted client contract");
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
        const acceptedTotal = Math.max(
          0,
          Math.min(records.length, await this.#options.transport.send(envelope)),
        );
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
    });
  }
}
