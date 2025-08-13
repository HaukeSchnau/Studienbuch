import type { DomainEvent } from "@stu/lib";
import { Effect } from "effect";
import { DomainIngestEngine } from "../../boilerplate";
import { SYSTEM_USER } from "../../constants";
import { runtime } from "../../groundswell";

type InputEvent = Omit<DomainEvent, "id" | "timestamp"> & {
  id?: string;
  timestamp?: Date;
};

export const ingestEffect = Effect.fn(
  function* (event: InputEvent, initiatorId?: string) {
    const ingestEngine = yield* DomainIngestEngine;
    event.id ??= crypto.randomUUID();
    event.timestamp ??= new Date();
    return yield* ingestEngine.ingest(event as DomainEvent, { initiatorId: initiatorId ?? SYSTEM_USER });
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
