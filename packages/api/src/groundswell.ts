import { CanonicalStorage as DrizzleCanonicalStorage } from "@groundswell/adapter-drizzle-postgres";
import { ApplicatorError } from "@groundswell/core";
import { ServerValidationError } from "@groundswell/core-server";
import {
  AuthRepository,
  applicators,
  ClassRepository,
  CourseRepository,
  Database,
  type DatabaseError,
  DatabaseLive,
  HolidayRepository,
  PersonRepository,
  SchoolRepository,
  SemesterRepository,
  StudentRepository,
  TimetableRepository,
  YearRepository,
} from "@stu/db";
import { DomainEvent } from "@stu/lib";
import { Duration, Effect, Layer, Logger, ManagedRuntime, pipe, Schedule } from "effect";
import { DomainCanonicalStorage, DomainServerApplicator, ingestEngine } from "./boilerplate";
import { memoryBroadcastLive } from "./broadcast";
import { RabbitMQClient } from "./rabbitmq";
import { getUserTopics } from "./router/events/send-missing-events";

const repositories = Layer.mergeAll(
  AuthRepository.Default,
  SchoolRepository.Default,
  PersonRepository.Default,
  YearRepository.Default,
  ClassRepository.Default,
  CourseRepository.Default,
  HolidayRepository.Default,
  TimetableRepository.Default,
  SemesterRepository.Default,
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
          Effect.provide(repositories),
          Effect.provideService(Database, db),
          Effect.catchTags({
            DatabaseError: (error) => Effect.fail(new ServerValidationError({ cause: error, reason: "UNKNOWN" })),
            ValidationError: (error) => Effect.fail(new ServerValidationError({ cause: error, reason: error.reason })),
          }),
        ),
      apply: (event, meta) =>
        pipe(
          applicators.apply(event, meta),
          Effect.provide(repositories),
          Effect.provideService(Database, db),
          Effect.catchTags({
            DatabaseError: (error) => Effect.fail(new ApplicatorError({ cause: error })),
          }),
        ),
      getEventTopics: (event) =>
        pipe(
          applicators.getEventTopics(event),
          Effect.provide(repositories),
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

export const AppLayerLive = pipe(
  Layer.provide(ingestEngine, serverApplicatorLive),
  Layer.provideMerge(memoryBroadcastLive),
  Layer.provide(canonicalStorageLive),
  Layer.provideMerge(DatabaseLive.pipe(Layer.retry(databaseRetrySchedule), Layer.orDie)),
  Layer.provide(RabbitMQClient.Default),
);
export const runtime = ManagedRuntime.make(Layer.mergeAll(AppLayerLive, repositories, Logger.pretty));
