import type { Broadcast, CanonicalStorage, IngestEngine, ServerApplicator } from "@groundswell/core-server";
import { ingestEngineLive } from "@groundswell/core-server";
import { ServiceMap } from "effect";
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

export const ingestEngine = ingestEngineLive(
  DomainIngestEngine,
  DomainServerApplicator,
  DomainCanonicalStorage,
  DomainBroadcast,
);
