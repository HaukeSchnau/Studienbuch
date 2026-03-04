import { CanonicalStorage as DrizzleCanonicalStorage } from "@groundswell/adapter-drizzle-postgres";
import { ApplicatorError, ValidationError } from "@groundswell/core";
import {
  AbsenceRepositoryDb,
  AuthRepositoryLive,
  applicators,
  ClassRepositoryLive,
  CourseRepositoryLive,
  Database,
  type DatabaseError,
  DatabaseLive,
  GradeRepositoryDb,
  HolidayRepositoryLive,
  PersonRepository,
  SchoolRepositoryLive,
  SemesterRepositoryLive,
  StudentRepository,
  TimetableRepository,
  YearRepositoryLive,
} from "@stu/db";
import { DomainEvent as DomainEventSchema } from "@stu/lib";
import { Effect, Layer, Logger, ManagedRuntime, pipe } from "effect";
import type { ZodSchema } from "zod";
import type { DomainEvent } from "../../db/src/domain-event";
import { DomainCanonicalStorage, DomainServerApplicator, ingestEngine } from "./boilerplate";
import { memoryBroadcastLive } from "./broadcast";
import { getUserTopics } from "./services/topic-service";

const Repositories = Layer.mergeAll(
  AuthRepositoryLive,
  SchoolRepositoryLive,
  PersonRepository.Default,
  YearRepositoryLive,
  ClassRepositoryLive,
  CourseRepositoryLive,
  HolidayRepositoryLive,
  AbsenceRepositoryDb.Default,
  GradeRepositoryDb.Default,
  TimetableRepository.Default,
  SemesterRepositoryLive,
  StudentRepository.Default,
);

const serverApplicatorLive = Layer.effect(
  DomainServerApplicator,
  Effect.gen(function* () {
    const db = yield* Effect.service(Database);
    return DomainServerApplicator.of({
      verify: (event, meta) =>
        pipe(
          applicators.verify(event, meta),
          Effect.provide(Repositories),
          Effect.provideService(Database, db),
          Effect.catchTags({
            DatabaseError: (error: DatabaseError) =>
              Effect.fail(new ValidationError({ cause: error, reason: "UNKNOWN" })),
          }),
        ) as Effect.Effect<void, ValidationError>,
      apply: (event, meta) =>
        pipe(
          applicators.apply(event, meta),
          Effect.provide(Repositories),
          Effect.provideService(Database, db),
          Effect.catchTags({
            DatabaseError: (error: DatabaseError) => Effect.fail(new ApplicatorError({ cause: error })),
          }),
        ) as Effect.Effect<void, ApplicatorError>,
      getEventTopics: (event) =>
        pipe(
          applicators.getEventTopics(event),
          Effect.provide(Repositories),
          Effect.provideService(Database, db),
          Effect.orDie, // TODO: handle error
        ) as Effect.Effect<string[]>,
      getUserTopics: (userId) => Effect.promise(() => getUserTopics(userId)), // TODO: use effect
    });
  }),
);

export const canonicalStorageLive = DrizzleCanonicalStorage.createDrizzleCanonicalStorageLayer(DomainCanonicalStorage, {
  // Transitional cast during Effect/Groundswell linked-workspace migration.
  db: Database as never,
  eventSchema: DomainEventSchema as unknown as ZodSchema<DomainEvent>,
});

const SyncLayerLive = pipe(
  Layer.provideMerge(ingestEngine, serverApplicatorLive),
  Layer.provideMerge(memoryBroadcastLive),
  Layer.provideMerge(canonicalStorageLive),
);

export const AppLayerLive = pipe(
  Layer.mergeAll(SyncLayerLive, Repositories),
  Layer.provideMerge(DatabaseLive.pipe(Layer.orDie)),
  // Layer.provide(RabbitMQClient.Default),
);
export const runtime = ManagedRuntime.make(
  Layer.mergeAll(AppLayerLive, Logger.layer([Logger.consolePretty()])) as never,
);
