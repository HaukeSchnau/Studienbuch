import type { Broadcast, CanonicalStorage, IngestEngine, ServerApplicator } from "@groundswell/core-server";
import { ingestEngineLive } from "@groundswell/core-server";
import type { DomainEvent } from "@stu/lib";
import { Context, Layer, ManagedRuntime } from "effect";

export class DomainCanonicalStorage extends Context.Tag("CanonicalStorage")<
  DomainCanonicalStorage,
  CanonicalStorage<DomainEvent>
>() {}

export class DomainServerApplicator extends Context.Tag("ServerApplicator")<
  DomainServerApplicator,
  ServerApplicator<DomainEvent>
>() {}

export class DomainBroadcast extends Context.Tag("Broadcast")<DomainBroadcast, Broadcast<DomainEvent>>() {}

export class DomainIngestEngine extends Context.Tag("IngestEngine")<DomainIngestEngine, IngestEngine<DomainEvent>>() {}

export const ingestEngine = ingestEngineLive(
  DomainIngestEngine,
  DomainServerApplicator,
  DomainCanonicalStorage,
  DomainBroadcast,
);
