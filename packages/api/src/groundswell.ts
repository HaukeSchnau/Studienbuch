import { CanonicalStorage as DrizzleCanonicalStorage } from "@groundswell/adapter-drizzle-postgres";
import { ApplicatorError } from "@groundswell/core";
import type { CanonicalStorage } from "@groundswell/core-server";
import { BroadcastError, ServerValidationError } from "@groundswell/core-server";
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
import { Duration, Effect, Layer, ManagedRuntime, PubSub, pipe, Schedule, Stream } from "effect";
import { DomainBroadcast, DomainCanonicalStorage, DomainServerApplicator, ingestEngine } from "./boilerplate";
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

const initializeEventStream = (userId: string, canonicalStorage: CanonicalStorage<DomainEvent>) => {
  return Effect.gen(function* () {
    const events = yield* canonicalStorage.getEventsSentToUser(userId);
    return events;
  });
};

export const memoryBroadcastLive = Layer.effect(
  DomainBroadcast,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<DomainEvent>();
    const canonicalStorage = yield* DomainCanonicalStorage;

    return DomainBroadcast.of({
      publishToTopics: (topics, event) => {
        console.log("publishing to topics", topics, event);
        return pubsub.publish(event);
      }, // Simple broadcast, ignores topics
      publishToUser: (userId, event) => {
        console.log("publishing to user", userId, event);
        return pubsub.publishAll(event);
      }, // Simple broadcast, ignores topics
      subscribe: (userId) => {
        const initStream = Stream.fromIterableEffect(
          initializeEventStream(userId, canonicalStorage).pipe(
            Effect.catchTag("CanonicalStorageError", (error) => {
              return Effect.fail(new BroadcastError({ cause: error }));
            }),
          ),
        );
        return pipe(Stream.concat(initStream, Stream.fromPubSub(pubsub)));
      },
    });
  }),
);

export const canonicalStorageLive = DrizzleCanonicalStorage.createDrizzleCanonicalStorageLayer(DomainCanonicalStorage, {
  db: Database,
  eventSchema: DomainEvent,
});

export const appServerLayer = Layer.provide(ingestEngine, serverApplicatorLive);

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

const appServerLayerLive = appServerLayer.pipe(
  Layer.provideMerge(memoryBroadcastLive),
  Layer.provideMerge(canonicalStorageLive),
  Layer.provideMerge(DatabaseLive.pipe(Layer.retry(databaseRetrySchedule), Layer.orDie)),
);
export const runtime = ManagedRuntime.make(appServerLayerLive);
