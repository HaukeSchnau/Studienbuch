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
import { DomainEvent } from "@stu/lib";
import { Duration, Effect, Layer, Logger, ManagedRuntime, pipe, Schedule } from "effect";
import { DomainCanonicalStorage, DomainServerApplicator, ingestEngine } from "./boilerplate";
import { memoryBroadcastLive } from "./broadcast";
import { getUserTopics } from "./router/events/send-missing-events";

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
    const db = yield* Database;
    return DomainServerApplicator.of({
      verify: (event, meta) =>
        pipe(
          applicators.verify(event, meta),
          Effect.provide(Repositories),
          Effect.provideService(Database, db),
          Effect.catchTags({
            DatabaseError: (error) => Effect.fail(new ValidationError({ cause: error, reason: "UNKNOWN" })),
          }),
        ),
      apply: (event, meta) =>
        pipe(
          applicators.apply(event, meta),
          Effect.provide(Repositories),
          Effect.provideService(Database, db),
          Effect.catchTags({
            DatabaseError: (error) => Effect.fail(new ApplicatorError({ cause: error })),
          }),
        ),
      getEventTopics: (event) =>
        pipe(
          applicators.getEventTopics(event),
          Effect.provide(Repositories),
          Effect.provideService(Database, db),
          Effect.orDie, // TODO: handle error
        ),
      getUserTopics: (userId) => Effect.promise(() => getUserTopics(userId)), // TODO: use effect
    });
  }),
);

export const canonicalStorageLive = DrizzleCanonicalStorage.createDrizzleCanonicalStorageLayer(DomainCanonicalStorage, {
  db: Database,
  eventSchema: DomainEvent,
});

const databaseRetrySchedule: Schedule.Schedule<number, DatabaseError, never> = Schedule.exponential("1 second", 2).pipe(
  Schedule.modifyDelay(Duration.min("8 seconds")),
  Schedule.jittered,
  Schedule.repetitions,
  Schedule.modifyDelayEffect((count, delay) =>
    Effect.as(
      Effect.logError(`[Server crashed]: Retrying in ${Duration.format(delay)} (attempt #${count + 1})`),
      delay,
    ),
  ),
);

const SyncLayerLive = pipe(
  Layer.provideMerge(ingestEngine, serverApplicatorLive),
  Layer.provideMerge(memoryBroadcastLive),
  Layer.provideMerge(canonicalStorageLive),
);

export const AppLayerLive = pipe(
  Layer.mergeAll(SyncLayerLive, Repositories),
  Layer.provideMerge(DatabaseLive.pipe(Layer.retry(databaseRetrySchedule), Layer.orDie)),
  // Layer.provide(RabbitMQClient.Default),
);
export const runtime = ManagedRuntime.make(Layer.mergeAll(AppLayerLive, Logger.pretty));
