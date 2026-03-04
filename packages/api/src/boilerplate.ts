import type { Broadcast, CanonicalStorage, IngestEngine, ServerApplicator } from "@groundswell/core-server";
import { ingestEngineLive } from "@groundswell/core-server";
import { Effect, Layer, ServiceMap } from "effect";
import type { DomainEvent } from "../../db/src/domain-event";

export class DomainCanonicalStorage extends ServiceMap.Service<DomainCanonicalStorage, CanonicalStorage<DomainEvent>>()(
  "CanonicalStorage",
) {}

export class DomainServerApplicator extends ServiceMap.Service<DomainServerApplicator, ServerApplicator<DomainEvent>>()(
  "ServerApplicator",
) {}

export class DomainBroadcast extends ServiceMap.Service<DomainBroadcast, Broadcast<DomainEvent>>()("Broadcast") {}

export class DomainIngestEngine extends ServiceMap.Service<DomainIngestEngine, IngestEngine<DomainEvent>>()(
  "IngestEngine",
) {}

class DomainIngestCanonicalStorage extends ServiceMap.Service<
  DomainIngestCanonicalStorage,
  CanonicalStorage<DomainEvent>
>()("IngestCanonicalStorage") {}

const isCanonicalStorageCauseType = (error: { cause: unknown }, expectedType: string) =>
  typeof error.cause === "object" && error.cause !== null && "type" in error.cause && error.cause.type === expectedType;

const ingestCanonicalStorageLive = Layer.effect(
  DomainIngestCanonicalStorage,
  Effect.gen(function* () {
    const canonicalStorage = yield* DomainCanonicalStorage;

    return DomainIngestCanonicalStorage.of({
      ...canonicalStorage,
      markEventAsSentToUser: (eventId, userId) =>
        canonicalStorage.markEventAsSentToUser(eventId, userId).pipe(
          Effect.catchTag("CanonicalStorageError", (error) =>
            isCanonicalStorageCauseType(error, "unique_violation") ? Effect.void : Effect.fail(error),
          ),
        ),
    });
  }),
);

export const ingestEngine = ingestEngineLive(
  DomainIngestEngine,
  DomainServerApplicator,
  DomainIngestCanonicalStorage,
  DomainBroadcast,
).pipe(Layer.provideMerge(ingestCanonicalStorageLive));
