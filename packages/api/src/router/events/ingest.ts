import { Effect } from "effect";
import { DomainIngestEngine } from "../../boilerplate";
import type { DomainEvent } from "@stu/lib";
import { runtime } from "../../groundswell";

export const ingestEffect = Effect.fn(
  function* (event: DomainEvent, initiatorId: string) {
    const ingestEngine = yield* DomainIngestEngine;
    return yield* ingestEngine.ingest(event, { initiatorId });
  },
  Effect.catchTags({
    // TODO: handle these errors maybe?
    ApplicatorError: (error) => Effect.die(error),
    CanonicalStorageError: (error) => Effect.die(error),
    BroadcastError: (error) => Effect.die(error),
    DuplicateEventError: (error) => Effect.die(error),
    UserNotFoundError: (error) => Effect.die(error),
  }),
);

export const ingest = (event: DomainEvent, initiatorId: string) =>
  runtime.runPromiseExit(ingestEffect(event, initiatorId));
